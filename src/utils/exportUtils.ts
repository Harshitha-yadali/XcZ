// src/utils/exportUtils.ts
// The named export, not the default: jsPDF ships CommonJS, and Node hands a
// default import the whole namespace object rather than the constructor. The
// worker renders the same PDF as the browser, so this file has to load in both.
import { jsPDF } from 'jspdf';
import { ResumeData, Certification } from '../types/resume'; // Import Certification type
import { saveAs } from 'file-saver';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { UserType } from '../types/resume';
import { getCertificationDisplayParts } from './certificationFormatting';
import { toPdfSafe } from './pdfText';
import { buildResumeDocx, DOCX_MIME } from './resumeDocx';

// Map font family names to jsPDF compatible fonts
const mapFontFamily = (fontFamily: string): string => {
  const fontMap: Record<string, string> = {
    'Times New Roman': 'times',
    'Arial': 'helvetica',
    'Verdana': 'helvetica',
    'Georgia': 'times',
    'Calibri': 'helvetica',
    'Helvetica': 'helvetica',
    'Courier': 'courier',
    'Courier New': 'courier'
  };
  return fontMap[fontFamily] || 'helvetica';
};

// Professional PDF Layout Constants - Updated to meet specifications
const createPDFConfig = (options: ExportOptions) => {
  // Paper size dimensions in mm
  const isLetter = options.paperSize === 'letter';
  const pageWidth = isLetter ? 215.9 : 210; // Letter: 8.5" = 215.9mm, A4: 210mm
  const pageHeight = isLetter ? 279.4 : 297; // Letter: 11" = 279.4mm, A4: 297mm

  return {
    pageWidth,
    pageHeight,

    // Professional margins in mm (0.7 inch = 17.78mm) - ATS Optimized
    margins: {
      top: options.layoutType === 'compact' ? 12 : options.layoutType === 'ats-optimized' ? 17.78 : 17.78,
      // Use a consistent 4mm bottom margin so content can go lower on the page
      bottom: 4,
      left: options.layoutType === 'compact' ? 12 : options.layoutType === 'ats-optimized' ? 17.78 : 17.78,
      right: options.layoutType === 'compact' ? 12 : options.layoutType === 'ats-optimized' ? 17.78 : 17.78
    },

    // Calculated content area
    get contentWidth() { return this.pageWidth - this.margins.left - this.margins.right; },
    get contentHeight() { return this.pageHeight - this.margins.top - this.margins.bottom; },

    // Typography settings - Professional specifications
    fonts: {
      name: { size: options.nameSize, weight: 'bold' },
      contact: { size: options.bodyTextSize - 0.5, weight: 'normal' },
      sectionTitle: { size: options.sectionHeaderSize, weight: 'bold' },
      jobTitle: { size: options.subHeaderSize, weight: 'bold' },
      company: { size: options.subHeaderSize, weight: 'normal' },
      year: { size: options.subHeaderSize, weight: 'normal' },
      body: { size: options.bodyTextSize, weight: 'normal' }
    },
    spacing: {
      nameFromTop: 10,
      afterName: 0,
      afterContact: 2,
      sectionSpacingBefore: options.sectionSpacing,
      sectionSpacingAfter: 2,
      bulletListSpacing: 0.5,
      afterSubsection: 3,
      lineHeight: options.layoutType === 'ats-optimized' ? 1.1 : 1.2,
      bulletIndent: 5,
      entrySpacing: options.entrySpacing
    },
    colors: {
      primary: [0, 0, 0],
      secondary: [80, 80, 80],
      accent: [37, 99, 235]
    },
    fontFamily: mapFontFamily(options.fontFamily)
  };
};

interface DrawPosition {
  x: number;
  y: number;
}

interface PageState {
  currentPage: number;
  currentY: number;
  doc: jsPDF;
}

// NEW: Helper function to validate fields
const isValidField = (field?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'): boolean => {
  if (!field || field.trim() === '') {
    return false;
  }
  const lowercasedField = field.trim().toLowerCase();
  const invalidValues = ['n/a', 'not specified', 'none'];
  if (invalidValues.includes(lowercasedField)) {
    return false;
  }
  
  switch (fieldType) {
    case 'phone':
      const digitCount = (field.match(/\d/g) || []).length;
      return digitCount > 6;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field);
    case 'url':
      // Accept URLs with or without protocol, including LinkedIn and GitHub URLs
      return /^https?:\/\//.test(field) ||
             /linkedin\.com\/in\//i.test(field) ||
             /github\.com\//i.test(field) ||
             /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(field);
    case 'text':
    default:
      return true;
  }
};

// Helper function to detect mobile device
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Safely convert unknown values to displayable text
const toPlainText = (value: any): string => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  if (typeof value === 'object') {
    const candidates = ['text', 'name', 'title', 'value'];
    for (const key of candidates) {
      const v = (value as any)[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }
  return String(value);
};

// Helper to detect placeholder/empty-ish text consistently (kept in sync with ResumePreview)
const isPlaceholderText = (s?: string): boolean => {
  if (!s) return true;
  const v = s.trim().toLowerCase();
  return v === '' || v === 'n/a' || v === 'none' || v === 'not specified' || v === 'not provided' || v === 'available upon request';
};

// Limit bullet text to a maximum number of words (for concise bullets in PDF)
const shortenBulletText = (text: string, maxWords: number = 10): string => {
  const clean = (text || '').trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(' ') + '...';
};

// Normalize certifications input and provide sensible fallbacks from other sections
const getEffectiveCertifications = (data: ResumeData): (string | Certification)[] => {
  const primary = Array.isArray((data as any).certifications) ? (data as any).certifications as (string | Certification)[] : [];
  if (primary && primary.length > 0) return primary;

  // Fallback 1: Additional Sections titled like "Certifications" or "Licenses"
  const fromAdditional = (data.additionalSections || [])
    .filter(sec => typeof sec?.title === 'string' && /cert|licen/i.test(sec.title))
    .flatMap(sec => Array.isArray(sec.bullets) ? sec.bullets : [])
    .filter(b => typeof b === 'string' && b.trim().length > 0);
  if (fromAdditional.length > 0) return fromAdditional;

  // Fallback 2: Skills category named like "Certifications"/"Certificates"/"Licenses"
  const fromSkills = (data.skills || [])
    .filter(cat => typeof cat?.category === 'string' && /cert|licen/i.test(cat.category))
    .flatMap(cat => Array.isArray(cat.list) ? cat.list : [])
    .filter(b => typeof b === 'string' && b.trim().length > 0);
  if (fromSkills.length > 0) return fromSkills;

  return [];
};

// Helper function to trigger download on mobile
const triggerMobileDownload = (blob: Blob, filename: string): void => {
  try {
    // For mobile devices, use a more reliable download method
    if (isMobileDevice()) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';

      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the URL object after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } else {
      // For desktop, use saveAs
      saveAs(blob, filename);
    }
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: try to open in new window
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
};

// Helper function to check if content fits on current page
function checkPageSpace(state: PageState, requiredHeight: number, PDF_CONFIG: any): boolean {
  const maxY = PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom; // Corrected calculation
  return (state.currentY + requiredHeight) <= maxY;
}

// Add new page and reset position
function addNewPage(state: PageState, PDF_CONFIG: any): void {
  state.doc.addPage();
  state.currentPage++;
  state.currentY = PDF_CONFIG.margins.top;

  // Add page number
  const pageText = `Page ${state.currentPage}`;
  state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
  state.doc.setFontSize(9);
  state.doc.setTextColor(128, 128, 128); // Gray

  const pageWidth = state.doc.internal.pageSize.getWidth();
  const textWidth = state.doc.getTextWidth(pageText);
  state.doc.text(pageText, pageWidth - PDF_CONFIG.margins.right - textWidth, PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2); // Adjusted Y for page number
}

// Draw text with automatic wrapping and return height used
function drawText(
  state: PageState,
  text: string,
  x: number,
  PDF_CONFIG: any,
  options: {
    fontSize?: number;
    fontWeight?: string;
    color?: number[];
    maxWidth?: number;
    align?: 'left' | 'center' | 'right';
  } = {}
): number {
  const {
    fontSize = PDF_CONFIG.fonts.body.size,
    fontWeight = 'normal',
    color = PDF_CONFIG.colors.primary,
    maxWidth = PDF_CONFIG.contentWidth,
    align = 'left'
  } = options;

  // Debug: Log font settings being applied
  console.log(`[drawText] Font: ${PDF_CONFIG.fontFamily}, Weight: ${fontWeight}, Size: ${fontSize}pt, Text: "${text.substring(0, 30)}..."`);
  
  state.doc.setFont(PDF_CONFIG.fontFamily, fontWeight);
  state.doc.setFontSize(fontSize);
  state.doc.setTextColor(color[0], color[1], color[2]);

  // Split text to fit width
  const lines = state.doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * PDF_CONFIG.spacing.lineHeight * 0.352778; // Convert pt to mm
  const totalHeight = lines.length * lineHeight;

  // Check if we need a new page
  if (!checkPageSpace(state, totalHeight, PDF_CONFIG)) {
    addNewPage(state, PDF_CONFIG);
  }

  // Calculate x position based on alignment
  let textX = x;
  if (align === 'center') {
    textX = PDF_CONFIG.margins.left + (PDF_CONFIG.contentWidth / 2);
  } else if (align === 'right') {
    textX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth;
  }

  // Draw each line
  lines.forEach((line: string, index: number) => {
    const yPos = state.currentY + (index * lineHeight);

    if (align === 'center') {
      const lineWidth = state.doc.getTextWidth(line);
      state.doc.text(line, textX - (lineWidth / 2), yPos);
    } else if (align === 'right') {
      const lineWidth = state.doc.getTextWidth(line);
      state.doc.text(line, textX - lineWidth, yPos);
    } else {
      state.doc.text(line, textX, yPos);
    }
  });

  state.currentY += totalHeight;
  return totalHeight;
}
// Certifications renderer with title + description structure
function renderCertificationsForPDF(state: PageState, certifications: (string | Certification)[], PDF_CONFIG: any): number {
  // Accept strings or objects with any reasonable text field
  const filtered = (certifications || []).filter((c) => {
    if (typeof c === 'string') return c.trim().length > 0 && !isPlaceholderText(c);
    if (c && typeof c === 'object') {
      // Try whole object (toPlainText handles name/title/text/value) or description
      const anyC: any = c;
      const primary = toPlainText(anyC);
      const desc = toPlainText(anyC?.description);
      return (!!primary && !isPlaceholderText(primary)) || (!!desc && !isPlaceholderText(desc));
    }
    return false;
  });

  if (!filtered.length) return 0;

  let totalHeight = drawSectionTitle(state, 'Certifications', PDF_CONFIG);

  filtered.forEach((cert) => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const { title, description } = getCertificationDisplayParts(
      cert as string | Record<string, unknown>,
    );
    const primary = title || description;

    if (primary) {
      const titleHeight = drawText(state, `• ${primary}`, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
        fontWeight: 'bold',
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
      });
      totalHeight += titleHeight;

      if (description && title && description !== title) {
        state.currentY += 1;
        const descHeight = drawText(state, description, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent * 2, PDF_CONFIG, {
          maxWidth: PDF_CONFIG.contentWidth - (PDF_CONFIG.spacing.bulletIndent * 2)
        });
        totalHeight += descHeight + 1;
      }
    }
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
  });

  return totalHeight;
}
// Clean replacement for certifications rendering without placeholder text
function renderCertificationsLegacyUnused(state: PageState, certifications: (string | Certification)[], PDF_CONFIG: any): number {
  const normalized: { title: string; description: string }[] = (certifications || [])
    .map((c: any) => {
      if (typeof c === 'string') {
        const t = toPlainText(c);
        return isPlaceholderText(t) ? null : { title: t, description: '' };
      }
      if (c && typeof c === 'object') {
        const t = toPlainText(c.title);
        const d = toPlainText(c.description);
        const title = isPlaceholderText(t) ? '' : t;
        const description = isPlaceholderText(d) ? '' : d;
        if (!title && !description) return null;
        return { title, description };
      }
      return null;
    })
    .filter(Boolean) as { title: string; description: string }[];

  if (!normalized.length) return 0;

  let totalHeight = drawSectionTitle(state, 'Certifications', PDF_CONFIG);

  normalized.forEach((item) => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const primary = item.title || item.description;
    const titleHeight = drawText(state, `- ${primary}`, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
      fontWeight: 'bold',
      maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
    });
    totalHeight += titleHeight;

    if (item.description && item.title && item.description !== item.title) {
      state.currentY += 1;
      const descHeight = drawText(state, item.description, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent * 2, PDF_CONFIG, {
        maxWidth: PDF_CONFIG.contentWidth - (PDF_CONFIG.spacing.bulletIndent * 2)
      });
      totalHeight += descHeight + 1;
    }

    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
  });

  return totalHeight;
}

// FIXED: Draw section title with underline and proper spacing - prevents black bar on page 2
function drawSectionTitle(state: PageState, title: string, PDF_CONFIG: any): number {
  // Calculate the FULL height needed for this section header as an atomic unit:
  // - Initial spacing before title (1mm)
  // - Title line height
  // - Underline space
  // - Spacing after section header
  // - Minimum breathing room (5mm) to prevent drawing too close to page edge
  const lineHeight = PDF_CONFIG.fonts.sectionTitle.size * PDF_CONFIG.spacing.lineHeight * 0.352778;
  const underlineSpace = 1; // Space for the underline itself
  const minimumBreathingRoom = 5; // Minimum mm from page bottom
  const estimatedSectionHeaderHeight = 1 + lineHeight + underlineSpace + PDF_CONFIG.spacing.sectionSpacingAfter + minimumBreathingRoom;
  
  // Check if we have enough space BEFORE adding initial spacing
  if (!checkPageSpace(state, estimatedSectionHeaderHeight, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
  }

  // Now add initial spacing
  state.currentY += 1;

  // Ensure bold font is explicitly set for section titles
  state.doc.setFont(PDF_CONFIG.fontFamily, 'bold');
  state.doc.setFontSize(PDF_CONFIG.fonts.sectionTitle.size);
  state.doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);

  const titleText = title.toUpperCase();
  state.doc.text(titleText, PDF_CONFIG.margins.left, state.currentY);

  state.currentY += lineHeight;

  // Draw underline - use thinner line width for subtlety
  const underlineY = state.currentY - (PDF_CONFIG.fonts.sectionTitle.size * 0.2);
  state.doc.setDrawColor(64, 64, 64);
  state.doc.setLineWidth(0.25); // Reduced from 0.5 for a more subtle underline
  state.doc.line(PDF_CONFIG.margins.left, underlineY, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth, underlineY);
  state.currentY += PDF_CONFIG.spacing.sectionSpacingAfter;

  return lineHeight + PDF_CONFIG.spacing.sectionSpacingBefore + PDF_CONFIG.spacing.sectionSpacingAfter;
}

// Helper to extract short display text from URLs
// The whole address, as an applicant tracking system has to recognise it.
function getLinkText(url: string): string {
  return url.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

// Draw contact information - two lines: basic info on line 1, links on line 2
function drawContactInfo(state: PageState, resumeData: ResumeData, PDF_CONFIG: any): number {
  interface ContactItem {
    text: string;
    url?: string;
  }
  
  // Line 1: Location, Phone, Email
  const line1Items: ContactItem[] = [];
  // Line 2: LinkedIn, GitHub
  const line2Items: ContactItem[] = [];
  
  if (isValidField(resumeData.location)) {
    line1Items.push({ text: resumeData.location!.trim() });
  }

  if (isValidField(resumeData.phone, 'phone')) {
    line1Items.push({ text: resumeData.phone!, url: `tel:${resumeData.phone}` });
  }

  if (isValidField(resumeData.email, 'email')) {
    line1Items.push({ text: resumeData.email!, url: `mailto:${resumeData.email}` });
  }

  if (isValidField(resumeData.linkedin, 'url')) {
    const linkedinUrl = resumeData.linkedin!.startsWith('http') ? resumeData.linkedin! : `https://${resumeData.linkedin}`;
    line2Items.push({ text: getLinkText(resumeData.linkedin!), url: linkedinUrl });
  }

  if (isValidField(resumeData.github, 'url')) {
    const githubUrl = resumeData.github!.startsWith('http') ? resumeData.github! : `https://${resumeData.github}`;
    line2Items.push({ text: getLinkText(resumeData.github!), url: githubUrl });
  }

  if (line1Items.length === 0 && line2Items.length === 0) return 0;
  
  // Set font for contact info - BOLD
  state.doc.setFont(PDF_CONFIG.fontFamily, 'bold');
  state.doc.setFontSize(PDF_CONFIG.fonts.contact.size);
  state.doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
  
  const separator = ' | ';
  const separatorWidth = state.doc.getTextWidth(separator);
  const lineHeight = PDF_CONFIG.fonts.contact.size * PDF_CONFIG.spacing.lineHeight * 0.352778;
  let totalHeight = 0;
  
  // Helper function to draw a line of contact items centered
  const drawContactLine = (items: ContactItem[]) => {
    if (items.length === 0) return;
    
    // Calculate total width
    let totalWidth = 0;
    items.forEach((item, index) => {
      totalWidth += state.doc.getTextWidth(item.text);
      if (index < items.length - 1) {
        totalWidth += separatorWidth;
      }
    });
    
    // Start X position for centered text
    let currentX = PDF_CONFIG.margins.left + (PDF_CONFIG.contentWidth - totalWidth) / 2;
    
    // Draw each item
    items.forEach((item, index) => {
      const textWidth = state.doc.getTextWidth(item.text);
      
      // Draw the text
      state.doc.text(item.text, currentX, state.currentY);
      
      // Add hyperlink if URL exists
      if (item.url) {
        const linkHeight = PDF_CONFIG.fonts.contact.size * 0.352778;
        state.doc.link(currentX, state.currentY - linkHeight + 1, textWidth, linkHeight + 1, { url: item.url });
      }
      
      currentX += textWidth;
      
      // Draw separator if not last item
      if (index < items.length - 1) {
        state.doc.text(separator, currentX, state.currentY);
        currentX += separatorWidth;
      }
    });
    
    state.currentY += lineHeight;
    totalHeight += lineHeight;
  };
  
  drawContactLine(line1Items);
  drawContactLine(line2Items);
  
  // Reset font to normal
  state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
  
  // Add spacing after contact info
  state.currentY += PDF_CONFIG.spacing.afterContact;
  totalHeight += PDF_CONFIG.spacing.afterContact;
  
  return totalHeight;
}

// Draw work experience section
function drawWorkExperience(state: PageState, workExperience: any[], userType: UserType = 'experienced', PDF_CONFIG: any): number {
  if (!workExperience || workExperience.length === 0) return 0;

  // Add extra 1.5mm spacing before Work Experience section
  state.currentY += 1.5;

  const sectionTitle = (userType === 'fresher' || userType === 'student') ? 'Work Experience' : 'Professional Experience';
  let totalHeight = drawSectionTitle(state, sectionTitle, PDF_CONFIG) + 1.5;

  workExperience.forEach((job, index) => {
    const estimatedJobHeaderHeight = (PDF_CONFIG.fonts.jobTitle.size) * PDF_CONFIG.spacing.lineHeight * 0.352778;
    const estimatedMinBulletHeight = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * 0.352778;
    if (!checkPageSpace(state, estimatedJobHeaderHeight + estimatedMinBulletHeight + PDF_CONFIG.spacing.bulletListSpacing * 2 + PDF_CONFIG.spacing.afterSubsection, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const initialYForJob = state.currentY;
    const combinedTitle = `${job.role} | ${job.company}${isValidField(job.location) ? `, ${job.location}` : ''}`;

    const yearText = job.year;
    
    let yearWidth = 0;
    if (isValidField(yearText)) {
      state.doc.setFont(PDF_CONFIG.fontFamily, 'bold');
      state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
      yearWidth = state.doc.getTextWidth(yearText);
    }

    drawText(state, combinedTitle, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: 'bold', // Changed to bold
      maxWidth: PDF_CONFIG.contentWidth - yearWidth - 5
    });
    // Written after the title and on its baseline, so it reads as "title, date".
    if (isValidField(yearText)) {
      state.doc.setFont(PDF_CONFIG.fontFamily, 'bold');
      state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
      state.doc.text(yearText, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth, initialYForJob);
      state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
    }

    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    if (job.bullets && job.bullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      job.bullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
          fontSize: PDF_CONFIG.fonts.body.size,
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
        });
        totalHeight += bulletHeight;
      });
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
    }

    if (index < workExperience.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}

// Draw education section
function drawEducation(state: PageState, education: any[], PDF_CONFIG: any): number {
  if (!education || education.length === 0) return 0;
  let totalHeight = drawSectionTitle(state, 'Education', PDF_CONFIG);

  education.forEach((edu, index) => {
    if (!checkPageSpace(state, 20, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }
    const initialYForEdu = state.currentY;
    const degreeHeight = drawText(state, edu.degree, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight // Already bold
    });
    if (isValidField(edu.year)) {
      state.doc.setFont(PDF_CONFIG.fontFamily, 'bold');
      state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
      const yearWidth = state.doc.getTextWidth(edu.year);
      state.doc.text(edu.year, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth, initialYForEdu);
      state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
    }
    const schoolText = `${edu.school}${isValidField(edu.location) ? `, ${edu.location}` : ''}`;
    const schoolHeight = drawText(state, schoolText, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.company.size,
      fontWeight: 'normal', // Changed to normal
      color: PDF_CONFIG.colors.primary
    });
    let cgpaHeight = 0;
    if (isValidField(edu.cgpa)) {
      cgpaHeight = drawText(state, `CGPA: ${edu.cgpa}`, PDF_CONFIG.margins.left, PDF_CONFIG, {
        fontSize: PDF_CONFIG.fonts.body.size,
        fontWeight: PDF_CONFIG.fonts.body.weight,
        color: PDF_CONFIG.colors.secondary
      });
    }
    totalHeight += degreeHeight + schoolHeight + cgpaHeight;
    if (index < education.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });
  return totalHeight;
}


// Draw projects section
function drawProjects(state: PageState, projects: any[], PDF_CONFIG: any): number {
  if (!projects || projects.length === 0) return 0;

  const githubProjects = projects.filter(project => project.githubUrl);
  let totalHeight = drawSectionTitle(state, 'Projects', PDF_CONFIG);

  projects.forEach((project, index) => {
    if (!checkPageSpace(state, 25, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const titleHeight = drawText(state, project.title, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight // Already bold
    });
    totalHeight += titleHeight;
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    if (project.bullets && project.bullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      project.bullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
          fontSize: PDF_CONFIG.fonts.body.size,
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
        });
        totalHeight += bulletHeight;
      });
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
    }

    if (index < projects.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}


// Draw skills section
function drawSkills(state: PageState, skills: any[], PDF_CONFIG: any): number {
  if (!skills || skills.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'Skills', PDF_CONFIG);
  const estimatedSkillLineHeight = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * 0.352778;

  skills.forEach((skill, index) => {
    if (!checkPageSpace(state, 15, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const x = PDF_CONFIG.margins.left;
    const categoryText = `${skill.category}: `;
    const listText = skill.list ? skill.list.join(', ') : '';

    state.doc.setFont(PDF_CONFIG.fontFamily, 'bold'); // Already bold
    state.doc.setFontSize(PDF_CONFIG.fonts.body.size);
    state.doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);

    const categoryWidth = state.doc.getTextWidth(categoryText);
    state.doc.text(categoryText, x, state.currentY);
    state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');

    const remainingWidth = PDF_CONFIG.contentWidth - categoryWidth;
    const lines = state.doc.splitTextToSize(listText, remainingWidth);

    lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
            state.doc.text(line, x + categoryWidth, state.currentY);
        } else {
            state.doc.text(line, x, state.currentY + (lineIndex * estimatedSkillLineHeight));
        }
    });

    state.currentY += lines.length * estimatedSkillLineHeight;
    totalHeight += lines.length * estimatedSkillLineHeight;

    if (index < skills.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}


// Draw certifications section
function drawCertifications(state: PageState, certifications: (string | Certification)[], PDF_CONFIG: any): number {
  let totalHeight = drawSectionTitle(state, 'Certifications', PDF_CONFIG);

  if (!certifications || certifications.length === 0) {
    const placeholderHeight = drawText(state, 'Available upon request', PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.body.size,
      maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
    });
    totalHeight += placeholderHeight;
    return totalHeight;
  }

  certifications.forEach((cert) => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    if (typeof cert === 'object' && cert !== null && 'title' in cert) { // Check for 'title' property
      const titleText = `• ${cert.title}`;
      const titleHeight = drawText(state, titleText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
        fontWeight: 'bold',
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
      });
      totalHeight += titleHeight;

      if ('description' in cert && cert.description) { // Check for 'description' property
        state.currentY += 1; // Small gap
        const descHeight = drawText(state, cert.description, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent * 2, PDF_CONFIG, {
          maxWidth: PDF_CONFIG.contentWidth - (PDF_CONFIG.spacing.bulletIndent * 2)
        });
        totalHeight += descHeight + 1;
      }
    } else {
      const bulletText = `• ${String(cert)}`;
      const certHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
        fontSize: PDF_CONFIG.fonts.body.size,
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
      });
      totalHeight += certHeight;
    }
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
  });

  return totalHeight;
}

// Draw professional summary section
function drawProfessionalSummary(state: PageState, summary: string, PDF_CONFIG: any): number {
  if (!summary) return 0;

  let totalHeight = drawSectionTitle(state, 'Professional Summary', PDF_CONFIG);
  const summaryHeight = drawText(state, summary, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth
  });
  totalHeight += summaryHeight;
  state.currentY += 3;
  return totalHeight;
}

// Draw career objective section for students
function drawCareerObjective(state: PageState, objective: string, PDF_CONFIG: any): number {
  if (!objective) return 0;
  let totalHeight = drawSectionTitle(state, 'Career Objective', PDF_CONFIG);
  state.currentY += 3;
  const objectiveHeight = drawText(state, objective, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth
  });
  totalHeight += objectiveHeight;
  state.currentY += 3;
  return totalHeight;
}

// MODIFIED: Simplified to only draw achievements
function drawAchievementsAndExtras(state: PageState, resumeData: ResumeData, PDF_CONFIG: any): number {
  const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;
  if (!hasAchievements) return 0;

  let totalHeight = drawSectionTitle(state, 'Achievements', PDF_CONFIG);

  resumeData.achievements!.forEach(item => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }
    const itemHeight = drawText(state, `• ${item}`, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.body.size,
      maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
    });
    totalHeight += itemHeight;
  });

  state.currentY += 2;
  return totalHeight;
}

// Draw additional sections dynamically
function drawAdditionalSection(state: PageState, section: { title: string; bullets: string[] }, PDF_CONFIG: any): number {
  if (!section || !section.title || !section.bullets || section.bullets.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, section.title, PDF_CONFIG);

  section.bullets.forEach(bullet => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }
    const bulletHeight = drawText(state, `• ${bullet}`, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.body.size,
      maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
    });
    totalHeight += bulletHeight;
  });

  state.currentY += 2;
  return totalHeight;
}


// Draws the resume into a jsPDF document; the callers decide what to do with it.
const renderResumePDF = async (sourceResume: ResumeData, userType: UserType = 'experienced', options: ExportOptions = defaultExportOptions): Promise<jsPDF> => {
  // Validate resume data before attempting export
  const resumeData = toPdfSafe(sourceResume);
  if (!resumeData) {
    throw new Error('Resume data is required for PDF export');
  }

  if (!resumeData.name || resumeData.name.trim() === '') {
    throw new Error('Resume must have a name to export');
  }

  // CRITICAL: Create PDF_CONFIG with the received options
  // Log to verify options are being received
  console.log('🔴 EXPORT PDF CALLED WITH OPTIONS:', {
    fontFamily: options.fontFamily,
    nameSize: options.nameSize,
    bodyTextSize: options.bodyTextSize,
    sectionHeaderSize: options.sectionHeaderSize
  });
  
  const PDF_CONFIG = createPDFConfig(options);
  
  // Verify PDF_CONFIG was created correctly
  console.log('🔵 PDF_CONFIG CREATED:', {
    fontFamily: PDF_CONFIG.fontFamily,
    nameSize: PDF_CONFIG.fonts.name.size,
    bodySize: PDF_CONFIG.fonts.body.size,
    sectionSize: PDF_CONFIG.fonts.sectionTitle.size
  });

  try {
    if (isMobileDevice()) {
      console.log('Starting PDF generation for mobile device...');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 PDF EXPORT - OPTIONS RECEIVED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Export options:', JSON.stringify(options, null, 2));
    console.log('Paper size:', options.paperSize);
    console.log('Font family (original):', options.fontFamily);
    console.log('Font family (mapped):', PDF_CONFIG.fontFamily);
    console.log('Font sizes:');
    console.log('  - Name:', options.nameSize, '→ PDF_CONFIG:', PDF_CONFIG.fonts.name.size);
    console.log('  - Section Header:', options.sectionHeaderSize, '→ PDF_CONFIG:', PDF_CONFIG.fonts.sectionTitle.size);
    console.log('  - Sub Header:', options.subHeaderSize, '→ PDF_CONFIG:', PDF_CONFIG.fonts.jobTitle.size);
    console.log('  - Body Text:', options.bodyTextSize, '→ PDF_CONFIG:', PDF_CONFIG.fonts.body.size);
    console.log('Spacing:');
    console.log('  - Section:', options.sectionSpacing, '→ PDF_CONFIG:', PDF_CONFIG.spacing.sectionSpacingBefore);
    console.log('  - Entry:', options.entrySpacing, '→ PDF_CONFIG:', PDF_CONFIG.spacing.entrySpacing);
    console.log('═══════════════════════════════════════════════════════════');
    
    // Use paper size from options (a4 or letter)
    const paperFormat = options.paperSize === 'letter' ? 'letter' : 'a4';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: paperFormat, compress: true });
    
    // Initialize font immediately after creating document
    console.log(`[PDF] Initializing font: ${PDF_CONFIG.fontFamily}`);
    doc.setFont(PDF_CONFIG.fontFamily, 'normal');
    doc.setFontSize(PDF_CONFIG.fonts.body.size);
    
    const state: PageState = { currentPage: 1, currentY: PDF_CONFIG.margins.top, doc };
    doc.setProperties({
      title: `${resumeData.name} - Resume`,
      subject: 'Professional Resume',
      author: resumeData.name,
      creator: 'Resume Optimizer'
    });

    state.currentY = PDF_CONFIG.spacing.nameFromTop;
    drawText(state, resumeData.name.toUpperCase(), PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.name.size,
      fontWeight: PDF_CONFIG.fonts.name.weight,
      align: 'center'
    });
    state.currentY += PDF_CONFIG.spacing.afterName;

    drawContactInfo(state, resumeData, PDF_CONFIG);
    
    state.currentY += 3;

    if (userType === 'experienced' && resumeData.summary && resumeData.summary.trim() !== '') {
      drawProfessionalSummary(state, resumeData.summary, PDF_CONFIG);
    } else if ((userType === 'student' || userType === 'fresher') && resumeData.careerObjective && resumeData.careerObjective.trim() !== '') {
      drawCareerObjective(state, resumeData.careerObjective, PDF_CONFIG);
    }

    // Helper: draw section safely without breaking export
    const safeDraw = (label: string, fn: () => void) => {
      try { fn(); } catch (err) { console.error(`[PDF] Section failed: ${label}`, err); }
    };

    // ATS-Compliant section order
    if (userType === 'experienced') {
        // ATS Order: Summary → Skills → Experience → Projects → Education
        safeDraw('Skills', () => drawSkills(state, resumeData.skills, PDF_CONFIG));
        safeDraw('WorkExperience', () => drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG));
        safeDraw('Projects', () => drawProjects(state, resumeData.projects, PDF_CONFIG));
        safeDraw('Education', () => drawEducation(state, resumeData.education, PDF_CONFIG));
        safeDraw('Certifications', () => renderCertificationsForPDF(state, getEffectiveCertifications(resumeData), PDF_CONFIG));
    } else if (userType === 'student') {
        // ATS Order: Career Objective → Education → Skills → Projects → Experience
        safeDraw('Education', () => drawEducation(state, resumeData.education, PDF_CONFIG));
        safeDraw('Skills', () => drawSkills(state, resumeData.skills, PDF_CONFIG));
        safeDraw('Projects', () => drawProjects(state, resumeData.projects, PDF_CONFIG));
        safeDraw('WorkExperience', () => drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG));
        safeDraw('Certifications', () => renderCertificationsForPDF(state, getEffectiveCertifications(resumeData), PDF_CONFIG));
        safeDraw('Achievements', () => drawAchievementsAndExtras(state, resumeData, PDF_CONFIG));
    } else { // Fresher
        // ATS Order: Career Objective → Skills → Experience → Projects → Education
        safeDraw('Skills', () => drawSkills(state, resumeData.skills, PDF_CONFIG));
        safeDraw('WorkExperience', () => drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG));
        safeDraw('Projects', () => drawProjects(state, resumeData.projects, PDF_CONFIG));
        safeDraw('Education', () => drawEducation(state, resumeData.education, PDF_CONFIG));
        safeDraw('Certifications', () => renderCertificationsForPDF(state, getEffectiveCertifications(resumeData), PDF_CONFIG));
        safeDraw('Achievements', () => drawAchievementsAndExtras(state, resumeData, PDF_CONFIG));
    }

    if (resumeData.additionalSections && resumeData.additionalSections.length > 0) {
      resumeData.additionalSections.forEach(section => {
        drawAdditionalSection(state, section, PDF_CONFIG);
      });
    }

    const totalPages = state.currentPage;
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        if (i > 1) { doc.setPage(i); }
        const pageText = `Page ${i} of ${totalPages}`;
        doc.setFont(PDF_CONFIG.fontFamily, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const textWidth = doc.getTextWidth(pageText);
        doc.text(pageText, PDF_CONFIG.pageWidth / 2 - textWidth / 2, PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2);
      }
    }

    return doc;

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    if (error instanceof Error) {
      if (error.message.includes('jsPDF')) {
        throw new Error('PDF generation failed. Please try again or contact support if the issue persists.');
      } else {
        throw new Error('An error occurred while creating the PDF. Please try again.');
      }
    } else {
      throw new Error('An unexpected error occurred while exporting PDF. Please try again.');
    }
  }
};

// Main export function with mobile optimization
export const exportToPDF = async (resumeData: ResumeData, userType: UserType = 'experienced', options: ExportOptions = defaultExportOptions): Promise<void> => {
  const doc = await renderResumePDF(resumeData, userType, options);
  const fileName = getFileName(resumeData, 'pdf');
  if (isMobileDevice()) {
    triggerMobileDownload(doc.output('blob'), fileName);
  } else {
    doc.save(fileName);
  }
};

/** The same PDF as exportToPDF, returned instead of downloaded (for uploading). */
export const exportToPDFBlob = async (resumeData: ResumeData, userType: UserType = 'experienced', options: ExportOptions = defaultExportOptions): Promise<Blob> =>
  (await renderResumePDF(resumeData, userType, options)).output('blob');

// Centralized getFileName function (from exportUtils.ts)
export const getFileName = (resumeData: ResumeData, fileExtension: 'pdf' | 'docx'): string => {
    const namePart = resumeData.name.replace(/\s+/g, '_');
    const rolePart = resumeData.targetRole ? `_${resumeData.targetRole.replace(/\s+/g, '_')}` : '';
    // Clean filename: Name_Role_Resume.pdf (no "Optimized" suffix)
    return `${namePart}${rolePart}_Resume.${fileExtension}`;
};

// Generate Word document with mobile optimization
export const exportToWord = async (resumeData: ResumeData, userType: UserType = 'experienced'): Promise<void> => {
  // Validate resume data before attempting export
  if (!resumeData) {
    throw new Error('Resume data is required for Word export');
  }

  if (!resumeData.name || resumeData.name.trim() === '') {
    throw new Error('Resume must have a name to export');
  }

  const fileName = getFileName(resumeData, 'docx');
  try {
    console.log('Generating Word document...');
    const blob = new Blob([buildResumeDocx({ ...resumeData, certifications: getEffectiveCertifications(resumeData) }, userType) as BlobPart], {
      type: DOCX_MIME,
    });
    triggerMobileDownload(blob, fileName);
    console.log('Word document downloaded successfully');
  } catch (error) {
    console.error('Error exporting to Word:', error);
    if (error instanceof Error) {
      throw new Error(`Word export failed: ${error.message}`);
    }
    throw new Error('Word export failed. Please try again.');
  }
};
