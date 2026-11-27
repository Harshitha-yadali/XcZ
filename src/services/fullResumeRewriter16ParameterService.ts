/**
 * Full Resume Rewriter - 16 Parameter Optimization Service
 * 
 * This service FULLY REWRITES the resume using AI (Gemini/EdenAI) based on
 * the 16 ATS scoring parameters for maximum interview chances.
 * 
 * FLOW:
 * 1. Score the original resume against 16 parameters
 * 2. Use AI (geminiService.optimizeResume) to fully rewrite the resume
 * 3. Score the AI-optimized resume against 16 parameters
 * 4. If any parameter is below 90%, apply targeted fixes
 * 5. Return the final optimized resume with before/after scores
 * 
 * THE 16 PARAMETERS:
 * 1. Contact & Title — clear contact, professional title that matches JD
 * 2. Summary / Objective — present & aligned to role
 * 3. Role Title Match — role keywords match JD (seniority & exact role)
 * 4. Skills Match (hard skills) — coverage of technical skills from JD
 * 5. Skills Match (soft skills) — communication, teamwork etc. from JD
 * 6. Section Order — optimal ordering of resume sections for ATS
 * 7. Word Variety — no excessive word repetition across bullets
 * 8. Quantified Results — presence of metrics (%, #, time) in bullets
 * 9. Action Verbs & Impact-first Bullets — lead with verbs + outcome
 * 10. Keyword Density / ATS Hits — presence of JD keywords in natural contexts
 * 11. Formatting & Readability — bullet length, headers, spacing
 * 12. Section Completeness — required sections exist
 * 13. Chronology & Dates — dates present & consistent
 * 14. Relevance Filtering — de-prioritize unrelated low-value items
 * 15. Tools & Versions — specific tools & versions mentioned
 * 16. Project Technical Depth — technical complexity and depth of projects
 */

import { ResumeData, UserType } from '../types/resume';
import {
  categorizeSkill,
  formatSkillName as taxonomyFormatSkill,
  SKILL_CATEGORIES,
  SOFT_SKILLS
} from '../constants/skillsTaxonomy';
// Note: AI optimization (geminiOptimizeResume) is called in enhancedJdOptimizerService.ts
// This service only handles scoring and targeted fixes for the 16 parameters

// ============================================================================
// TYPES
// ============================================================================

export interface Parameter16Score {
  parameter: string;
  parameterNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  suggestions: string[];
}

// ============================================================================
// POWER VERBS BY CATEGORY (Impact-first language)
// ============================================================================

const IMPACT_VERBS = {
  achievement: ['Achieved', 'Exceeded', 'Surpassed', 'Attained', 'Accomplished', 'Delivered', 'Generated', 'Produced'],
  leadership: ['Spearheaded', 'Led', 'Directed', 'Orchestrated', 'Championed', 'Pioneered', 'Drove', 'Headed'],
  development: ['Engineered', 'Architected', 'Developed', 'Built', 'Designed', 'Implemented', 'Created', 'Constructed'],
  improvement: ['Optimized', 'Enhanced', 'Streamlined', 'Accelerated', 'Transformed', 'Revamped', 'Modernized', 'Boosted'],
  analysis: ['Analyzed', 'Evaluated', 'Assessed', 'Identified', 'Diagnosed', 'Investigated', 'Researched', 'Discovered'],
  collaboration: ['Collaborated', 'Partnered', 'Coordinated', 'Facilitated', 'Unified', 'Integrated', 'Aligned', 'Synergized'],
  management: ['Managed', 'Oversaw', 'Supervised', 'Administered', 'Controlled', 'Governed', 'Maintained', 'Regulated'],
  innovation: ['Innovated', 'Invented', 'Conceptualized', 'Devised', 'Formulated', 'Established', 'Introduced', 'Launched'],
};

// Weak verbs to replace
const WEAK_VERBS_MAP: Record<string, string> = {
  'worked': 'Delivered', 'helped': 'Enabled', 'assisted': 'Supported', 'did': 'Executed',
  'made': 'Created', 'got': 'Achieved', 'used': 'Leveraged', 'was responsible': 'Managed',
  'responsible for': 'Owned', 'involved in': 'Contributed to', 'participated': 'Engaged in',
  'handled': 'Managed', 'dealt with': 'Resolved', 'took care of': 'Administered',
  'worked on': 'Developed', 'helped with': 'Facilitated', 'was part of': 'Contributed to',
};

// ============================================================================
// SOFT SKILLS EXTRACTION
// ============================================================================

const SOFT_SKILLS_PATTERNS = [
  'communication', 'teamwork', 'collaboration', 'leadership', 'problem-solving',
  'problem solving', 'critical thinking', 'time management', 'adaptability',
  'flexibility', 'creativity', 'attention to detail', 'organization', 'interpersonal',
  'negotiation', 'conflict resolution', 'decision making', 'decision-making',
  'emotional intelligence', 'work ethic', 'self-motivated', 'initiative',
  'presentation', 'public speaking', 'mentoring', 'coaching', 'customer service',
  'stakeholder management', 'cross-functional', 'agile', 'scrum', 'project management',
];

// ============================================================================
// TECHNICAL SKILLS WHITELIST
// ============================================================================

const TECH_SKILLS = new Set([
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'sql', 'bash', 'shell',
  // Frontend
  'react', 'react.js', 'angular', 'vue', 'vue.js', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby', 'html', 'html5', 'css', 'css3', 'sass', 'scss', 'tailwind', 'bootstrap', 'material-ui', 'redux', 'mobx', 'webpack', 'vite',
  // Backend
  'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', '.net', 'rails', 'laravel', 'graphql', 'rest', 'restful', 'microservices',
  // Databases
  'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'sqlite', 'oracle', 'firebase', 'supabase',
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions', 'gitlab', 'circleci',
  // Testing
  'jest', 'mocha', 'cypress', 'selenium', 'playwright', 'pytest', 'junit',
  // Data & ML
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'jupyter', 'spark', 'hadoop', 'kafka',
  // Tools
  'git', 'github', 'jira', 'confluence', 'figma', 'postman', 'swagger', 'linux', 'nginx',
]);

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class FullResumeRewriter16ParameterService {
  
  /**
   * Main entry point - fully rewrite resume based on 16 parameters
   * Uses AI (Gemini/EdenAI) for the actual rewriting, then scores against 16 parameters
   */

  /**
   * Score resume only (no rewriting) - Used by ATS Score Checker for unified scoring
   * Returns the same 16 parameters used by the JD Optimizer
   */
  static async scoreOnly(
    resumeText: string,
    jobDescription: string,
    targetRole?: string
  ): Promise<{ scores: Parameter16Score[]; overallScore: number }> {
    console.log('📊 16-Parameter Score Only (no rewriting)...');
    console.log('📝 Resume text first 500 chars:', resumeText.substring(0, 500));
    console.log('📝 Resume text length:', resumeText.length);
    
    // Parse resume text into ResumeData structure
    const resumeData = this.parseResumeText(resumeText);
    
    console.log('📊 Parsed resume data:', {
      name: resumeData.name,
      email: resumeData.email,
      phone: resumeData.phone,
      summary: resumeData.summary?.substring(0, 50) || '(none)',
      skillsCategories: resumeData.skills?.length || 0,
      skillsTotal: resumeData.skills?.reduce((sum, s) => sum + (s.list?.length || 0), 0) || 0,
      workExperience: resumeData.workExperience?.length || 0,
      projects: resumeData.projects?.length || 0,
      education: resumeData.education?.length || 0,
      certifications: resumeData.certifications?.length || 0
    });
    
    // Extract JD requirements
    const jdAnalysis = this.analyzeJobDescription(jobDescription);
    
    // Score the resume
    const scores = this.scoreResume(resumeData, jdAnalysis);
    const overallScore = this.calculateOverallScore(scores);
    
    console.log('📊 Score Only Result:', overallScore + '%');
    console.log('📊 Individual scores:', scores.map(s => `${s.parameter}: ${s.percentage}%`).join(', '));
    
    return { scores, overallScore };
  }

  /**
   * Score resume using already-parsed resume data (more accurate than text parsing)
   * This method skips the text parsing step and uses structured data directly
   * ParsedResume extends ResumeData, so we can use it directly with some normalization
   */
  static async scoreWithParsedData(
    parsedResume: any, // ParsedResume type from edenResumeParserService (extends ResumeData)
    jobDescription: string,
    targetRole?: string
  ): Promise<{ scores: Parameter16Score[]; overallScore: number }> {
    console.log('📊 16-Parameter Score with PARSED DATA...');
    console.log('📊 Input parsedResume:', {
      name: parsedResume?.name,
      email: parsedResume?.email,
      skillsRaw: parsedResume?.skills,
      workExpRaw: parsedResume?.workExperience?.length,
      projectsRaw: parsedResume?.projects?.length
    });
    
    // ParsedResume extends ResumeData, so we can use it directly
    // Just ensure all fields have proper defaults and normalize any variations
    const resumeData: ResumeData = {
      name: parsedResume.name || '',
      email: parsedResume.email || '',
      phone: parsedResume.phone || '',
      location: parsedResume.location || '',
      linkedin: parsedResume.linkedin || '',
      github: parsedResume.github || '',
      summary: parsedResume.summary || parsedResume.careerObjective || '',
      careerObjective: parsedResume.careerObjective || '',
      targetRole: parsedResume.targetRole || targetRole || '',
      // Work experience - normalize field names
      workExperience: (parsedResume.workExperience || []).map((exp: any) => ({
        company: exp.company || '',
        role: exp.role || exp.title || '',
        year: exp.year || exp.dates || '',
        location: exp.location || '',
        bullets: exp.bullets || exp.responsibilities || []
      })),
      // Education - normalize field names
      education: (parsedResume.education || []).map((edu: any) => ({
        degree: edu.degree || '',
        school: edu.school || edu.institution || '',
        year: edu.year || edu.dates || '',
        cgpa: edu.cgpa || edu.gpa || '',
        location: edu.location || ''
      })),
      // Skills - already in correct format from edenResumeParserService
      skills: (parsedResume.skills || []).map((skill: any) => {
        if (typeof skill === 'string') {
          return { category: 'Technical', count: 1, list: [skill] };
        }
        // Ensure list is an array
        const list = Array.isArray(skill.list) ? skill.list : 
                     Array.isArray(skill.skills) ? skill.skills : [];
        return {
          category: skill.category || 'Technical',
          count: list.length,
          list: list
        };
      }),
      // Projects - normalize field names
      projects: (parsedResume.projects || []).map((proj: any) => ({
        title: proj.title || proj.name || '',
        bullets: Array.isArray(proj.bullets) ? proj.bullets : 
                 (proj.description ? [proj.description] : []),
        description: proj.description || '',
        techStack: proj.techStack || proj.technologies || []
      })),
      // Certifications - normalize field names
      certifications: (parsedResume.certifications || []).map((cert: any) => {
        if (typeof cert === 'string') {
          return { title: cert, description: '' };
        }
        return {
          title: cert.title || cert.name || '',
          description: cert.description || ''
        };
      }),
      achievements: parsedResume.achievements || []
    };
    
    console.log('📊 Normalized ResumeData:', {
      name: resumeData.name,
      email: resumeData.email,
      summary: resumeData.summary?.substring(0, 50) || '(none)',
      skillsCategories: resumeData.skills?.length || 0,
      skillsTotal: resumeData.skills?.reduce((sum, s) => sum + (s.list?.length || 0), 0) || 0,
      skillsDetails: resumeData.skills?.map(s => `${s.category}: ${s.list?.length || 0} items`),
      workExperience: resumeData.workExperience?.length || 0,
      workExpDetails: resumeData.workExperience?.map(w => `${w.role} @ ${w.company}`),
      projects: resumeData.projects?.length || 0,
      projectDetails: resumeData.projects?.map(p => p.title),
      education: resumeData.education?.length || 0,
      certifications: resumeData.certifications?.length || 0
    });
    
    // Extract JD requirements
    const jdAnalysis = this.analyzeJobDescription(jobDescription);
    console.log('📊 JD Analysis:', {
      hardSkills: jdAnalysis.hardSkills.length,
      softSkills: jdAnalysis.softSkills.length,
      roleKeywords: jdAnalysis.roleKeywords.length
    });
    
    // Score the resume using the same method as JD Optimizer
    const scores = this.scoreResume(resumeData, jdAnalysis);
    const overallScore = this.calculateOverallScore(scores);
    
    console.log('📊 Score with Parsed Data Result:', overallScore + '%');
    console.log('📊 Individual scores:', scores.map(s => `${s.parameterNumber}. ${s.parameter}: ${s.percentage}%`).join(', '));
    
    return { scores, overallScore };
  }

  /**
   * Parse plain text resume into ResumeData structure
   * Enhanced parsing to handle various resume formats
   */
  private static parseResumeText(text: string): ResumeData {
    console.log('📝 parseResumeText: Parsing resume text of length:', text.length);
    console.log('📝 Text preview (first 300 chars):', text.substring(0, 300));
    
    // Normalize text - handle different line endings and clean up
    let normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/  +/g, ' ');
    
    // If text has very few line breaks, try to add them before common section headers
    const lineCount = (normalizedText.match(/\n/g) || []).length;
    console.log('📝 Line count:', lineCount);
    
    if (lineCount < 10) {
      console.log('📝 Few line breaks detected, adding breaks before section headers');
      // Add line breaks before common section headers
      normalizedText = normalizedText
        .replace(/(Career Objective|Professional Summary|Summary|Objective|Skills|Technical Skills|Work Experience|Professional Experience|Experience|Education|Projects|Certifications|Achievements)/gi, '\n$1')
        .replace(/\n\n+/g, '\n');
    }
    
    const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('📝 Total lines after normalization:', lines.length);
    
    // Basic parsing - extract sections
    const resume: ResumeData = {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      summary: '',
      workExperience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      achievements: [],
    };
    
    // Extract name (usually first line that's not a section header)
    for (const line of lines.slice(0, 5)) {
      if (!this.isSectionHeader(line) && line.length > 2 && line.length < 50) {
        resume.name = line;
        break;
      }
    }
    
    // Extract contact info
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) resume.email = emailMatch[0];
    
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) resume.phone = phoneMatch[0];
    
    const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
    if (linkedinMatch) resume.linkedin = linkedinMatch[0];
    
    const githubMatch = text.match(/github\.com\/[\w-]+/i);
    if (githubMatch) resume.github = githubMatch[0];
    
    // Find section boundaries using normalized text
    const sectionBoundaries = this.findSectionBoundaries(normalizedText);
    console.log('📝 Found sections:', Object.keys(sectionBoundaries));
    
    // Extract summary/objective
    const summarySection = sectionBoundaries['summary'] || sectionBoundaries['objective'] || 
                          sectionBoundaries['career objective'] || sectionBoundaries['professional summary'] ||
                          sectionBoundaries['profile'] || sectionBoundaries['about'];
    if (summarySection) {
      resume.summary = summarySection.trim();
      console.log('📝 Found summary:', resume.summary.substring(0, 50) + '...');
    }
    
    // Extract skills with categories
    const skillsSection = sectionBoundaries['skills'] || sectionBoundaries['technical skills'] || 
                         sectionBoundaries['core competencies'] || sectionBoundaries['technologies'];
    if (skillsSection) {
      resume.skills = this.parseSkillsSection(skillsSection);
      console.log('📝 Found skills categories:', resume.skills.length);
    }
    
    // Extract work experience
    const expSection = sectionBoundaries['work experience'] || sectionBoundaries['experience'] || 
                      sectionBoundaries['professional experience'] || sectionBoundaries['employment'] ||
                      sectionBoundaries['employment history'];
    if (expSection) {
      resume.workExperience = this.parseWorkExperience(expSection);
      console.log('📝 Found work experience entries:', resume.workExperience.length);
    }
    
    // Extract education
    const eduSection = sectionBoundaries['education'] || sectionBoundaries['academic'] || 
                      sectionBoundaries['academic background'];
    if (eduSection) {
      resume.education = this.parseEducation(eduSection);
      console.log('📝 Found education entries:', resume.education.length);
    }
    
    // Extract projects
    const projSection = sectionBoundaries['projects'] || sectionBoundaries['portfolio'] || 
                       sectionBoundaries['academic projects'] || sectionBoundaries['personal projects'];
    if (projSection) {
      resume.projects = this.parseProjects(projSection);
      console.log('📝 Found project entries:', resume.projects.length);
    }
    
    // Extract certifications
    const certSection = sectionBoundaries['certifications'] || sectionBoundaries['certificates'] ||
                       sectionBoundaries['licenses'];
    if (certSection) {
      resume.certifications = this.parseCertifications(certSection);
      console.log('📝 Found certifications:', resume.certifications.length);
    }
    
    // FALLBACK: If no sections found, try to extract data directly from text
    if (Object.keys(sectionBoundaries).length === 0) {
      console.log('📝 No sections found, using fallback extraction');
      this.fallbackExtraction(resume, normalizedText);
    }
    
    console.log('📝 parseResumeText complete:', {
      name: resume.name,
      email: resume.email,
      skills: resume.skills.length,
      workExp: resume.workExperience.length,
      projects: resume.projects.length,
      education: resume.education.length
    });
    
    return resume;
  }
  
  /**
   * Fallback extraction when section headers aren't found
   */
  private static fallbackExtraction(resume: ResumeData, text: string): void {
    console.log('📝 Running fallback extraction...');
    
    // Extract skills from text (look for common tech keywords)
    const techSkillsPattern = /\b(javascript|typescript|python|java|react|angular|vue|node\.?js|express|django|flask|aws|azure|gcp|docker|kubernetes|sql|mongodb|postgresql|mysql|redis|git|github|html|css|sass|tailwind|bootstrap|graphql|rest|api|microservices|ci\/cd|jenkins|terraform|linux|agile|scrum)\b/gi;
    const foundSkills = [...new Set((text.match(techSkillsPattern) || []).map(s => s.toLowerCase()))];
    
    if (foundSkills.length > 0 && resume.skills.length === 0) {
      resume.skills = [{ category: 'Technical Skills', count: foundSkills.length, list: foundSkills }];
      console.log('📝 Fallback: Found', foundSkills.length, 'skills');
    }
    
    // Extract work experience indicators
    const rolePatterns = /\b(software engineer|developer|intern|analyst|manager|lead|architect|consultant|designer)\b/gi;
    const foundRoles = text.match(rolePatterns) || [];
    
    if (foundRoles.length > 0 && resume.workExperience.length === 0) {
      // Look for date patterns near roles
      const datePattern = /(\d{4}\s*[-–]\s*(?:\d{4}|present|current|ongoing))/gi;
      const dates = text.match(datePattern) || [];
      
      resume.workExperience = foundRoles.slice(0, 3).map((role, i) => ({
        role: role,
        company: '',
        year: dates[i] || '',
        bullets: []
      }));
      console.log('📝 Fallback: Found', resume.workExperience.length, 'work experience entries');
    }
    
    // Extract education
    const eduPattern = /\b(bachelor|master|phd|b\.?tech|m\.?tech|b\.?s\.?|m\.?s\.?|mba|bca|mca|diploma)\b/gi;
    const foundEdu = text.match(eduPattern) || [];
    
    if (foundEdu.length > 0 && resume.education.length === 0) {
      resume.education = foundEdu.slice(0, 2).map(degree => ({
        degree: degree,
        school: '',
        year: ''
      }));
      console.log('📝 Fallback: Found', resume.education.length, 'education entries');
    }
    
    // Extract summary if not found (look for first paragraph-like text)
    if (!resume.summary) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50 && s.trim().length < 500);
      if (sentences.length > 0) {
        resume.summary = sentences[0].trim();
        console.log('📝 Fallback: Found summary');
      }
    }
    
    // Look for project indicators
    const projectIndicators = text.match(/\b(built|developed|created|implemented|designed)\s+(?:a\s+)?([^.]+)/gi) || [];
    if (projectIndicators.length > 0 && resume.projects.length === 0) {
      resume.projects = projectIndicators.slice(0, 3).map(proj => ({
        title: proj.substring(0, 50),
        bullets: [proj]
      }));
      console.log('📝 Fallback: Found', resume.projects.length, 'project indicators');
    }
  }
  
  /**
   * Check if a line is a section header
   */
  private static isSectionHeader(line: string): boolean {
    const headers = [
      'summary', 'objective', 'career objective', 'professional summary', 'profile', 'about',
      'skills', 'technical skills', 'core competencies', 'technologies',
      'experience', 'work experience', 'professional experience', 'employment',
      'education', 'academic', 'projects', 'portfolio', 'certifications', 'certificates',
      'achievements', 'awards', 'languages', 'interests', 'hobbies', 'references'
    ];
    const lineLower = line.toLowerCase().replace(/[:\-_]/g, '').trim();
    return headers.some(h => lineLower === h || lineLower.startsWith(h + ' '));
  }
  
  /**
   * Find section boundaries in the resume text
   */
  private static findSectionBoundaries(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = text.split('\n');
    
    console.log('📝 findSectionBoundaries: Total lines:', lines.length);
    console.log('📝 First 10 lines:', lines.slice(0, 10));
    
    // Common section headers (case-insensitive) - more flexible patterns
    const sectionPatterns = [
      { pattern: /^(career\s*objective|objective)/i, name: 'career objective' },
      { pattern: /^(professional\s*summary|summary)/i, name: 'summary' },
      { pattern: /^(profile|about)/i, name: 'profile' },
      { pattern: /^(technical\s*skills|skills|core\s*competencies|technologies)/i, name: 'skills' },
      { pattern: /^(work\s*experience|professional\s*experience|experience|employment)/i, name: 'work experience' },
      { pattern: /^(education|academic)/i, name: 'education' },
      { pattern: /^(projects|portfolio|academic\s*projects|personal\s*projects)/i, name: 'projects' },
      { pattern: /^(certifications?|certificates?|licenses?)/i, name: 'certifications' },
      { pattern: /^(achievements?|awards?)/i, name: 'achievements' },
      // Additional patterns for common variations
      { pattern: /^(soft\s*skills)/i, name: 'soft skills' },
      { pattern: /^(programming\s*languages)/i, name: 'skills' },
      { pattern: /^(frontend\s*technologies)/i, name: 'skills' },
      { pattern: /^(backend\s*technologies)/i, name: 'skills' },
      { pattern: /^(cloud\s*&?\s*devops)/i, name: 'skills' },
      { pattern: /^(tools\s*&?\s*platforms)/i, name: 'skills' },
    ];
    
    let currentSection: string | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if this line is a section header
      let foundSection: string | null = null;
      for (const { pattern, name } of sectionPatterns) {
        if (pattern.test(trimmedLine.replace(/[:\-_]/g, ' ').trim())) {
          foundSection = name;
          break;
        }
      }
      
      if (foundSection) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = foundSection;
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(trimmedLine);
      }
    }
    
    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n');
    }
    
    console.log('📝 findSectionBoundaries: Found sections:', Object.keys(sections));
    console.log('📝 Section content lengths:', Object.entries(sections).map(([k, v]) => `${k}: ${v.length} chars`));
    
    return sections;
  }
  
  /**
   * Parse skills section into categorized skills
   */
  private static parseSkillsSection(skillsText: string): Array<{ category: string; count: number; list: string[] }> {
    const skills: Array<{ category: string; count: number; list: string[] }> = [];
    const lines = skillsText.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Check for category: skills format (e.g., "Programming Languages: JavaScript, Python")
      const categoryMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (categoryMatch) {
        const category = categoryMatch[1].trim();
        const skillList = categoryMatch[2].split(/[,;|]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
        if (skillList.length > 0) {
          skills.push({ category, count: skillList.length, list: skillList });
        }
      } else {
        // Single line of skills without category
        const skillList = line.split(/[,;|•·]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 50);
        if (skillList.length > 0) {
          // Add to existing "Technical" category or create new
          const techCategory = skills.find(s => s.category === 'Technical');
          if (techCategory) {
            techCategory.list.push(...skillList);
            techCategory.count = techCategory.list.length;
          } else {
            skills.push({ category: 'Technical', count: skillList.length, list: skillList });
          }
        }
      }
    }
    
    return skills;
  }
  
  /**
   * Parse work experience section
   */
  private static parseWorkExperience(expText: string): Array<{ company: string; role: string; year: string; bullets: string[]; location?: string }> {
    const experiences: Array<{ company: string; role: string; year: string; bullets: string[]; location?: string }> = [];
    const lines = expText.split('\n').filter(l => l.trim());
    
    let currentExp: { company: string; role: string; year: string; bullets: string[]; location?: string } | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for date pattern (indicates new job entry)
      const dateMatch = trimmedLine.match(/(\d{4}\s*[-–]\s*(?:\d{4}|present|ongoing|current)|\w+\s+\d{4}\s*[-–]\s*(?:\w+\s+\d{4}|present|ongoing|current))/i);
      
      // Check for role/company pattern
      const roleCompanyMatch = trimmedLine.match(/^([^|]+)\s*[|]\s*([^|]+)/);
      
      if (dateMatch || roleCompanyMatch) {
        // Save previous experience
        if (currentExp && (currentExp.role || currentExp.company)) {
          experiences.push(currentExp);
        }
        
        // Start new experience
        currentExp = { company: '', role: '', year: '', bullets: [] };
        
        if (roleCompanyMatch) {
          currentExp.role = roleCompanyMatch[1].trim();
          currentExp.company = roleCompanyMatch[2].trim();
        } else {
          // Try to extract role from line
          const roleMatch = trimmedLine.match(/([A-Za-z\s]+(?:Engineer|Developer|Manager|Analyst|Designer|Lead|Intern|Architect|Consultant|Specialist|Director|Coordinator))/i);
          if (roleMatch) {
            currentExp.role = roleMatch[1].trim();
          }
        }
        
        if (dateMatch) {
          currentExp.year = dateMatch[1].trim();
        }
      } else if (currentExp) {
        // Check if it's a bullet point
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || 
            trimmedLine.match(/^[A-Z][a-z]+ed\s/) || trimmedLine.match(/^[A-Z][a-z]+ing\s/)) {
          currentExp.bullets.push(trimmedLine.replace(/^[•\-*]\s*/, ''));
        } else if (!currentExp.company && trimmedLine.length < 100) {
          // Might be company name
          currentExp.company = trimmedLine;
        }
      }
    }
    
    // Save last experience
    if (currentExp && (currentExp.role || currentExp.company)) {
      experiences.push(currentExp);
    }
    
    return experiences;
  }
  
  /**
   * Parse education section
   */
  private static parseEducation(eduText: string): Array<{ degree: string; school: string; year: string; cgpa?: string; location?: string }> {
    const education: Array<{ degree: string; school: string; year: string; cgpa?: string; location?: string }> = [];
    const lines = eduText.split('\n').filter(l => l.trim());
    
    let currentEdu: { degree: string; school: string; year: string; cgpa?: string; location?: string } | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for degree pattern
      const degreeMatch = trimmedLine.match(/(Bachelor|Master|PhD|B\.?S\.?|M\.?S\.?|B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|MBA|BBA|BCA|MCA|Diploma)/i);
      
      if (degreeMatch) {
        // Save previous education
        if (currentEdu && currentEdu.degree) {
          education.push(currentEdu);
        }
        
        currentEdu = { degree: trimmedLine, school: '', year: '' };
        
        // Extract year if present
        const yearMatch = trimmedLine.match(/(\d{4}\s*[-–]\s*(?:\d{4}|present|ongoing)|\d{4})/i);
        if (yearMatch) {
          currentEdu.year = yearMatch[1];
        }
        
        // Extract CGPA if present
        const cgpaMatch = trimmedLine.match(/(?:CGPA|GPA|Grade)[:\s]*([0-9.]+)/i);
        if (cgpaMatch) {
          currentEdu.cgpa = cgpaMatch[1];
        }
      } else if (currentEdu && !currentEdu.school && trimmedLine.length > 5) {
        currentEdu.school = trimmedLine;
        
        // Extract year from school line if not found
        if (!currentEdu.year) {
          const yearMatch = trimmedLine.match(/(\d{4}\s*[-–]\s*(?:\d{4}|present|ongoing)|\d{4})/i);
          if (yearMatch) {
            currentEdu.year = yearMatch[1];
          }
        }
      }
    }
    
    // Save last education
    if (currentEdu && currentEdu.degree) {
      education.push(currentEdu);
    }
    
    return education;
  }
  
  /**
   * Parse projects section
   */
  private static parseProjects(projText: string): Array<{ title: string; bullets: string[]; description?: string; techStack?: string[] }> {
    const projects: Array<{ title: string; bullets: string[]; description?: string; techStack?: string[] }> = [];
    const lines = projText.split('\n').filter(l => l.trim());
    
    let currentProj: { title: string; bullets: string[]; description?: string; techStack?: string[] } | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if it's a project title (usually starts with capital, not a bullet)
      const isBullet = trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*');
      const isTechUsed = trimmedLine.toLowerCase().startsWith('tech used') || trimmedLine.toLowerCase().startsWith('technologies');
      
      if (!isBullet && !isTechUsed && trimmedLine.length > 5 && trimmedLine.length < 100 && 
          (trimmedLine.match(/^[A-Z]/) || trimmedLine.includes(' - '))) {
        // Save previous project
        if (currentProj && currentProj.title) {
          projects.push(currentProj);
        }
        
        currentProj = { title: trimmedLine, bullets: [] };
      } else if (currentProj) {
        if (isTechUsed) {
          // Extract tech stack
          const techMatch = trimmedLine.match(/(?:tech used|technologies)[:\s]*(.+)/i);
          if (techMatch) {
            currentProj.techStack = techMatch[1].split(/[,;|]/).map(t => t.trim()).filter(t => t.length > 0);
          }
        } else if (isBullet || trimmedLine.match(/^[A-Z][a-z]+ed\s/)) {
          currentProj.bullets.push(trimmedLine.replace(/^[•\-*]\s*/, ''));
        }
      }
    }
    
    // Save last project
    if (currentProj && currentProj.title) {
      projects.push(currentProj);
    }
    
    return projects;
  }
  
  /**
   * Parse certifications section
   */
  private static parseCertifications(certText: string): Array<{ title: string; description: string }> {
    const certifications: Array<{ title: string; description: string }> = [];
    const lines = certText.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim().replace(/^[•\-*]\s*/, '');
      if (trimmedLine.length > 5 && trimmedLine.length < 200) {
        certifications.push({ title: trimmedLine, description: '' });
      }
    }
    
    return certifications;
  }


  // ============================================================================
  // JD ANALYSIS
  // ============================================================================

  private static analyzeJobDescription(jd: string): JDAnalysis {
    const jdLower = jd.toLowerCase();
    
    // Extract hard skills (technical)
    const hardSkills: string[] = [];
    TECH_SKILLS.forEach(skill => {
      if (jdLower.includes(skill.toLowerCase())) {
        hardSkills.push(skill);
      }
    });
    
    // Also extract from patterns
    const techPatterns = /\b(react\.?js|angular\.?js|vue\.?js|next\.?js|node\.?js|typescript|javascript|python|java|golang|rust|aws|azure|gcp|docker|kubernetes|terraform|jenkins|git|mysql|postgresql|mongodb|redis|graphql|rest|microservices|ci\/cd|agile|scrum)\b/gi;
    const techMatches = jd.match(techPatterns) || [];
    techMatches.forEach(match => {
      const normalized = match.toLowerCase();
      if (!hardSkills.includes(normalized)) {
        hardSkills.push(normalized);
      }
    });
    
    // Extract soft skills
    const softSkills: string[] = [];
    SOFT_SKILLS_PATTERNS.forEach(skill => {
      if (jdLower.includes(skill.toLowerCase())) {
        softSkills.push(skill);
      }
    });
    
    // Extract role keywords
    const roleKeywords: string[] = [];
    const rolePatterns = /\b(engineer|developer|architect|lead|senior|junior|manager|analyst|specialist|consultant|designer|administrator|devops|sre|full.?stack|front.?end|back.?end|data|ml|ai|cloud|platform|software|web|mobile|ios|android)\b/gi;
    const roleMatches = jd.match(rolePatterns) || [];
    roleMatches.forEach(match => {
      const normalized = match.toLowerCase();
      if (!roleKeywords.includes(normalized)) {
        roleKeywords.push(normalized);
      }
    });
    
    // Determine seniority level
    let seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'principal' = 'mid';
    if (/\b(principal|staff|distinguished|director)\b/i.test(jd)) {
      seniorityLevel = 'principal';
    } else if (/\b(lead|tech lead|team lead|engineering lead)\b/i.test(jd)) {
      seniorityLevel = 'lead';
    } else if (/\b(senior|sr\.?|experienced)\b/i.test(jd)) {
      seniorityLevel = 'senior';
    } else if (/\b(junior|jr\.?|entry|fresher|graduate|intern)\b/i.test(jd)) {
      seniorityLevel = 'entry';
    }
    
    // Extract years of experience requirement
    const yearsMatch = jd.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
    const yearsRequired = yearsMatch ? parseInt(yearsMatch[1]) : 0;
    
    // Extract key responsibilities
    const responsibilities: string[] = [];
    const respPatterns = /(?:responsible for|will be|you will|duties include|responsibilities include)[:\s]*([^.]+)/gi;
    let respMatch;
    while ((respMatch = respPatterns.exec(jd)) !== null) {
      responsibilities.push(respMatch[1].trim());
    }
    
    return {
      hardSkills: [...new Set(hardSkills)],
      softSkills: [...new Set(softSkills)],
      roleKeywords: [...new Set(roleKeywords)],
      seniorityLevel,
      yearsRequired,
      responsibilities,
      rawText: jd,
    };
  }

  // ============================================================================
  // SCORING (16 Parameters)
  // ============================================================================

  private static scoreResume(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score[] {
    return [
      this.scoreContactAndTitle(resume, jdAnalysis),
      this.scoreSummaryObjective(resume, jdAnalysis),
      this.scoreRoleTitleMatch(resume, jdAnalysis),
      this.scoreHardSkillsMatch(resume, jdAnalysis),
      this.scoreSoftSkillsMatch(resume, jdAnalysis),
      this.scoreSectionOrder(resume, jdAnalysis),
      this.scoreRepeatedWords(resume),
      this.scoreQuantifiedResults(resume),
      this.scoreActionVerbsImpact(resume),
      this.scoreKeywordDensity(resume, jdAnalysis),
      this.scoreFormattingReadability(resume),
      this.scoreSectionCompleteness(resume),
      this.scoreChronologyDates(resume),
      this.scoreRelevanceFiltering(resume, jdAnalysis),
      this.scoreToolsVersions(resume, jdAnalysis),
      this.scoreProjectTechnicalDepth(resume, jdAnalysis),
    ];
  }

  private static calculateOverallScore(scores: Parameter16Score[]): number {
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const maxScore = scores.reduce((sum, s) => sum + s.maxScore, 0);
    return Math.round((totalScore / maxScore) * 100);
  }

  // Individual parameter scoring methods
  private static scoreContactAndTitle(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    if (resume.email && resume.email.includes('@')) score += 3;
    else suggestions.push('Add a professional email address');
    
    if (resume.phone && resume.phone.length >= 10) score += 2;
    else suggestions.push('Add a phone number');
    
    if (resume.linkedin) score += 2;
    else suggestions.push('Add LinkedIn profile URL');
    
    const hasMatchingTitle = jdAnalysis.roleKeywords.some(kw => 
      resume.targetRole?.toLowerCase().includes(kw) ||
      resume.workExperience?.[0]?.role?.toLowerCase().includes(kw)
    );
    if (hasMatchingTitle) score += 3;
    else suggestions.push('Align your title with the job role');
    
    return { parameter: 'Contact & Title', parameterNumber: 1, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreSummaryObjective(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    if (resume.summary && resume.summary.length > 50) {
      score += 4;
      
      const summaryLower = resume.summary.toLowerCase();
      const keywordMatches = jdAnalysis.hardSkills.filter(s => summaryLower.includes(s.toLowerCase())).length;
      score += Math.min(keywordMatches, 3);
      
      if (/\d+/.test(resume.summary)) score += 2;
      else suggestions.push('Add metrics to your summary');
      
      if (jdAnalysis.roleKeywords.some(kw => summaryLower.includes(kw))) score += 1;
    } else {
      suggestions.push('Add a professional summary aligned with the job');
    }
    
    return { parameter: 'Summary / Objective', parameterNumber: 2, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreRoleTitleMatch(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    const roles = resume.workExperience?.map(e => e.role?.toLowerCase() || '') || [];
    const allRolesText = roles.join(' ');
    
    const matchingKeywords = jdAnalysis.roleKeywords.filter(kw => allRolesText.includes(kw));
    score += Math.min(matchingKeywords.length * 2, 6);
    
    // Seniority match
    const seniorityTerms: Record<string, string[]> = {
      'entry': ['junior', 'intern', 'associate', 'trainee'],
      'mid': ['developer', 'engineer', 'analyst'],
      'senior': ['senior', 'sr', 'lead'],
      'lead': ['lead', 'principal', 'staff', 'architect'],
      'principal': ['principal', 'staff', 'distinguished', 'director'],
    };
    
    const expectedTerms = seniorityTerms[jdAnalysis.seniorityLevel] || [];
    if (expectedTerms.some(term => allRolesText.includes(term))) {
      score += 4;
    } else {
      suggestions.push(`Align role titles with ${jdAnalysis.seniorityLevel} level expectations`);
    }
    
    return { parameter: 'Role Title Match', parameterNumber: 3, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreHardSkillsMatch(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 15;
    const suggestions: string[] = [];
    
    const resumeSkills = resume.skills?.flatMap(s => s.list.map(sk => sk.toLowerCase())) || [];
    const resumeText = this.getFullResumeText(resume).toLowerCase();
    
    const matchedSkills = jdAnalysis.hardSkills.filter(skill => 
      resumeSkills.includes(skill.toLowerCase()) || resumeText.includes(skill.toLowerCase())
    );
    
    const matchPercentage = jdAnalysis.hardSkills.length > 0 
      ? matchedSkills.length / jdAnalysis.hardSkills.length 
      : 0;
    
    score = Math.round(matchPercentage * maxScore);
    
    const missingSkills = jdAnalysis.hardSkills.filter(s => !matchedSkills.includes(s));
    if (missingSkills.length > 0) {
      suggestions.push(`Add missing skills: ${missingSkills.slice(0, 5).join(', ')}`);
    }
    
    return { parameter: 'Skills Match (Hard Skills)', parameterNumber: 4, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreSoftSkillsMatch(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 8;
    const suggestions: string[] = [];
    
    const resumeText = this.getFullResumeText(resume).toLowerCase();
    
    const matchedSoftSkills = jdAnalysis.softSkills.filter(skill => 
      resumeText.includes(skill.toLowerCase())
    );
    
    const matchPercentage = jdAnalysis.softSkills.length > 0 
      ? matchedSoftSkills.length / jdAnalysis.softSkills.length 
      : 0.5; // Default if no soft skills in JD
    
    score = Math.round(matchPercentage * maxScore);
    
    if (matchedSoftSkills.length < 3) {
      suggestions.push('Demonstrate soft skills like teamwork, communication, leadership');
    }
    
    return { parameter: 'Skills Match (Soft Skills)', parameterNumber: 5, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreSectionOrder(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 12;
    const suggestions: string[] = [];
    
    // Optimal section order for ATS:
    // 1. Contact Info (always first)
    // 2. Summary/Objective
    // 3. Skills (for technical roles) OR Experience (for senior roles)
    // 4. Experience OR Skills
    // 5. Projects
    // 6. Education
    // 7. Certifications
    
    // Check if contact info exists (should be first)
    if (resume.name && (resume.email || resume.phone)) {
      score += 2;
    } else {
      suggestions.push('Ensure contact information is at the top');
    }
    
    // Check if summary exists (should be near top)
    if (resume.summary && resume.summary.length > 50) {
      score += 2;
    } else {
      suggestions.push('Add a professional summary after contact info');
    }
    
    // For technical roles, skills should come before or right after experience
    const isTechnicalRole = jdAnalysis.hardSkills.length > 5;
    if (isTechnicalRole && resume.skills && resume.skills.length > 0) {
      score += 3;
    } else if (!isTechnicalRole) {
      score += 2; // Less important for non-technical roles
    } else {
      suggestions.push('Add a skills section for technical roles');
    }
    
    // Experience section should exist and be prominent
    if (resume.workExperience && resume.workExperience.length > 0) {
      score += 3;
    } else {
      suggestions.push('Add work experience section');
    }
    
    // Projects section (important for technical roles)
    if (resume.projects && resume.projects.length > 0) {
      score += 1;
    }
    
    // Education section
    if (resume.education && resume.education.length > 0) {
      score += 1;
    }
    
    return { parameter: 'Section Order', parameterNumber: 6, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  /**
   * Parameter 7: Word Variety / No Repetition
   * Checks for repeated words across resume bullets to ensure variety
   * Penalizes overuse of the same words (excluding common stop words)
   */
  private static scoreRepeatedWords(resume: ResumeData): Parameter16Score {
    let score = 10; // Start with max score and deduct for repetitions
    const maxScore = 10;
    const suggestions: string[] = [];
    
    // Collect all text from bullets
    const allBullets = [
      ...(resume.workExperience?.flatMap(e => e.bullets || []) || []),
      ...(resume.projects?.flatMap(p => p.bullets || []) || []),
    ];
    
    if (allBullets.length === 0) {
      return { parameter: 'Word Variety', parameterNumber: 7, score: 10, maxScore, percentage: 100, suggestions: [] };
    }
    
    // Common stop words to ignore (these are expected to repeat)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'that', 'which', 'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'i', 'we', 'you', 'he', 'she', 'they', 'them', 'their', 'our', 'my', 'your', 'his', 'her', 'using', 'used', 'based', 'including', 'such', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over', 'out', 'up', 'down', 'off', 'then', 'than', 'so', 'if', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any', 'no', 'not', 'only', 'own', 'same', 'also', 'just', 'even', 'because', 'while', 'although', 'though', 'since', 'until', 'unless', 'per', 'via', 'within', 'across', 'along', 'among', 'around', 'about'
    ]);
    
    // Count word frequencies across all bullets
    const wordCounts: Record<string, number> = {};
    const repeatedWords: string[] = [];
    
    allBullets.forEach(bullet => {
      // Extract words (alphanumeric only, lowercase)
      const words = bullet.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
    
    // Find words that appear too many times (more than 3 times is excessive)
    const maxAllowedRepetitions = 3;
    
    Object.entries(wordCounts).forEach(([word, count]) => {
      if (count > maxAllowedRepetitions) {
        repeatedWords.push(`"${word}" (${count}x)`);
        // Deduct 1 point for each excessively repeated word, max deduction of 8
        score = Math.max(score - 1, 2);
      }
    });
    
    // Check for repeated starting words in bullets (same action verb used multiple times)
    const startingWords: Record<string, number> = {};
    allBullets.forEach(bullet => {
      const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase();
      if (firstWord && firstWord.length > 2) {
        startingWords[firstWord] = (startingWords[firstWord] || 0) + 1;
      }
    });
    
    const repeatedStarters: string[] = [];
    Object.entries(startingWords).forEach(([word, count]) => {
      if (count > 2) { // Same starting word more than twice
        repeatedStarters.push(`"${word}" starts ${count} bullets`);
        score = Math.max(score - 1, 2);
      }
    });
    
    // Generate suggestions
    if (repeatedWords.length > 0) {
      suggestions.push(`Reduce repetition of: ${repeatedWords.slice(0, 5).join(', ')}`);
    }
    
    if (repeatedStarters.length > 0) {
      suggestions.push(`Vary your action verbs: ${repeatedStarters.slice(0, 3).join(', ')}`);
    }
    
    if (score >= 8) {
      // Good variety - no suggestions needed
    } else if (score >= 5) {
      suggestions.push('Use synonyms and varied vocabulary to improve readability');
    } else {
      suggestions.push('Significant word repetition detected - rewrite bullets with more variety');
    }
    
    return { 
      parameter: 'Word Variety', 
      parameterNumber: 7, 
      score, 
      maxScore, 
      percentage: Math.round((score/maxScore)*100), 
      suggestions 
    };
  }

  private static scoreQuantifiedResults(resume: ResumeData): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    const allBullets = [
      ...(resume.workExperience?.flatMap(e => e.bullets || []) || []),
      ...(resume.projects?.flatMap(p => p.bullets || []) || []),
    ];
    
    const quantifiedPattern = /\d+%|\$\d+|\d+\s*(users?|customers?|clients?|team|people|million|k\b|x\b|hours?|days?|weeks?|months?|engineers?|developers?|projects?)/i;
    
    const quantifiedBullets = allBullets.filter(b => quantifiedPattern.test(b)).length;
    const totalBullets = allBullets.length || 1;
    
    const quantifiedPercentage = quantifiedBullets / totalBullets;
    score = Math.round(quantifiedPercentage * maxScore);
    
    if (quantifiedPercentage < 0.5) {
      suggestions.push('Add metrics (%, $, numbers) to at least 50% of your bullets');
    }
    
    return { parameter: 'Quantified Results', parameterNumber: 8, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreActionVerbsImpact(resume: ResumeData): Parameter16Score {
    let score = 0;
    const maxScore = 8;
    const suggestions: string[] = [];
    
    const allBullets = [
      ...(resume.workExperience?.flatMap(e => e.bullets || []) || []),
      ...(resume.projects?.flatMap(p => p.bullets || []) || []),
    ];
    
    const allPowerVerbs = Object.values(IMPACT_VERBS).flat().map(v => v.toLowerCase());
    
    const bulletsWithPowerVerbs = allBullets.filter(bullet => {
      const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase();
      return allPowerVerbs.some(pv => firstWord === pv.toLowerCase() || firstWord?.startsWith(pv.toLowerCase().slice(0, -2)));
    }).length;
    
    const totalBullets = allBullets.length || 1;
    const powerVerbPercentage = bulletsWithPowerVerbs / totalBullets;
    
    score = Math.round(powerVerbPercentage * maxScore);
    
    if (powerVerbPercentage < 0.7) {
      suggestions.push('Start bullets with strong action verbs (Engineered, Spearheaded, Optimized)');
    }
    
    return { parameter: 'Action Verbs & Impact-first Bullets', parameterNumber: 9, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreKeywordDensity(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    const resumeText = this.getFullResumeText(resume).toLowerCase();
    const wordCount = resumeText.split(/\s+/).length;
    
    let keywordOccurrences = 0;
    jdAnalysis.hardSkills.forEach(skill => {
      const regex = new RegExp(skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = resumeText.match(regex);
      keywordOccurrences += matches?.length || 0;
    });
    
    // Score based on keyword COVERAGE (100% coverage = 100% score)
    const presentKeywords = jdAnalysis.hardSkills.filter(skill => 
      resumeText.includes(skill.toLowerCase())
    );
    
    const coveragePercentage = jdAnalysis.hardSkills.length > 0 
      ? (presentKeywords.length / jdAnalysis.hardSkills.length) * 100 
      : 100;
    
    if (coveragePercentage >= 90) {
      score = maxScore;
    } else if (coveragePercentage >= 70) {
      score = 8;
      suggestions.push(`Add ${jdAnalysis.hardSkills.length - presentKeywords.length} more JD keywords`);
    } else if (coveragePercentage >= 50) {
      score = 6;
      suggestions.push(`Missing ${jdAnalysis.hardSkills.length - presentKeywords.length} JD keywords`);
    } else if (coveragePercentage >= 30) {
      score = 4;
      suggestions.push('Add more JD keywords throughout your resume');
    } else {
      score = 2;
      suggestions.push('Resume is missing most JD keywords');
    }
    
    return { parameter: 'Keyword Density / ATS Hits', parameterNumber: 10, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreFormattingReadability(resume: ResumeData): Parameter16Score {
    let score = 0;
    const maxScore = 10;
    const suggestions: string[] = [];
    
    // Check bullet formatting
    const allBullets = [
      ...(resume.workExperience?.flatMap(e => e.bullets || []) || []),
      ...(resume.projects?.flatMap(p => p.bullets || []) || []),
    ];
    
    if (allBullets.length === 0) {
      // No bullets but has sections - give partial score
      if (resume.workExperience?.length || resume.projects?.length) {
        score = 5;
        suggestions.push('Add bullet points to experience and projects');
      } else {
        suggestions.push('Add bullet points to experience and projects');
        return { parameter: 'Formatting & Readability', parameterNumber: 11, score: 0, maxScore, percentage: 0, suggestions };
      }
    } else {
      // Check bullet length (ideal: 5-50 words - more lenient)
      const goodLengthBullets = allBullets.filter(b => {
        const wordCount = b.split(/\s+/).length;
        return wordCount >= 5 && wordCount <= 50;
      }).length;
      
      const lengthRatio = goodLengthBullets / allBullets.length;
      score += lengthRatio * 3;
      
      // Check bullets start with capital
      const capitalBullets = allBullets.filter(b => b[0] === b[0]?.toUpperCase()).length;
      const capitalRatio = capitalBullets / allBullets.length;
      score += capitalRatio * 2;
      
      // Check bullets end with period or punctuation
      const periodBullets = allBullets.filter(b => /[.!?]$/.test(b.trim())).length;
      const periodRatio = periodBullets / allBullets.length;
      score += periodRatio * 2;
      
      // Log for debugging
      console.log(`📊 Formatting: ${goodLengthBullets}/${allBullets.length} good length, ${capitalBullets}/${allBullets.length} capital, ${periodBullets}/${allBullets.length} period`);
    }
    
    // Check sections exist (3 points total)
    if (resume.workExperience && resume.workExperience.length > 0) score += 1;
    if (resume.skills && resume.skills.length > 0) score += 1;
    if (resume.education && resume.education.length > 0) score += 1;
    
    // Ensure score is within bounds
    score = Math.min(Math.round(score), maxScore);
    
    // Generate suggestions only if score is low
    if (score < 9 && allBullets.length > 0) {
      const goodLengthBullets = allBullets.filter(b => {
        const wordCount = b.split(/\s+/).length;
        return wordCount >= 5 && wordCount <= 50;
      }).length;
      const capitalBullets = allBullets.filter(b => b[0] === b[0]?.toUpperCase()).length;
      const periodBullets = allBullets.filter(b => /[.!?]$/.test(b.trim())).length;
      
      if (goodLengthBullets < allBullets.length * 0.8) suggestions.push('Ensure bullets are 5-50 words');
      if (capitalBullets < allBullets.length) suggestions.push('Start all bullets with capital letters');
      if (periodBullets < allBullets.length) suggestions.push('End all bullets with periods');
    }
    
    return { parameter: 'Formatting & Readability', parameterNumber: 11, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreSectionCompleteness(resume: ResumeData): Parameter16Score {
    let score = 0;
    const maxScore = 8;
    const suggestions: string[] = [];
    
    if (resume.workExperience && resume.workExperience.length > 0) score += 2;
    else suggestions.push('Add work experience section');
    
    if (resume.projects && resume.projects.length > 0) score += 2;
    else suggestions.push('Add projects section');
    
    if (resume.education && resume.education.length > 0) score += 1;
    else suggestions.push('Add education section');
    
    if (resume.skills && resume.skills.length > 0) score += 2;
    else suggestions.push('Add skills section');
    
    if (resume.email && resume.phone) score += 1;
    else suggestions.push('Complete contact information');
    
    return { parameter: 'Section Completeness', parameterNumber: 12, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreChronologyDates(resume: ResumeData): Parameter16Score {
    let score = 0;
    const maxScore = 5;
    const suggestions: string[] = [];
    
    const experiencesWithDates = resume.workExperience?.filter(e => e.year && e.year.trim().length > 0).length || 0;
    const totalExperiences = resume.workExperience?.length || 0;
    
    if (totalExperiences > 0 && experiencesWithDates === totalExperiences) {
      score += 3;
    } else if (experiencesWithDates > 0) {
      score += 1;
      suggestions.push('Add dates to all work experiences');
    } else {
      suggestions.push('Add employment dates');
    }
    
    // Check education dates
    const eduWithDates = resume.education?.filter(e => e.year && e.year.trim().length > 0).length || 0;
    if (eduWithDates > 0) score += 2;
    
    return { parameter: 'Chronology & Dates', parameterNumber: 13, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreRelevanceFiltering(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 5;
    const suggestions: string[] = [];
    
    const totalExperiences = resume.workExperience?.length || 0;
    
    // If no work experiences, check other sections for relevance
    if (totalExperiences === 0) {
      // Check skills and projects for relevance instead
      const resumeText = this.getFullResumeText(resume).toLowerCase();
      const hasRelevantSkills = jdAnalysis.hardSkills.some(s => resumeText.includes(s.toLowerCase()));
      const hasRelevantKeywords = jdAnalysis.roleKeywords.some(k => resumeText.includes(k.toLowerCase()));
      
      if (hasRelevantSkills && hasRelevantKeywords) {
        score = maxScore;
      } else if (hasRelevantSkills || hasRelevantKeywords) {
        score = 3;
        suggestions.push('Add work experience to demonstrate relevance to the role');
      } else {
        score = 1;
        suggestions.push('Add relevant work experience or skills matching the job description');
      }
      
      return { parameter: 'Relevance Filtering', parameterNumber: 14, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
    }
    
    // Check if experiences are relevant
    const relevantExperiences = resume.workExperience?.filter(exp => {
      const expText = `${exp.role || ''} ${exp.bullets?.join(' ') || ''}`.toLowerCase();
      // Check hard skills
      const hasHardSkill = jdAnalysis.hardSkills.some(s => expText.includes(s.toLowerCase()));
      // Check role keywords
      const hasRoleKeyword = jdAnalysis.roleKeywords.some(k => expText.includes(k.toLowerCase()));
      // Also check company and description if available
      const companyText = (exp.company || '').toLowerCase();
      const hasCompanyMatch = jdAnalysis.roleKeywords.some(k => companyText.includes(k.toLowerCase()));
      
      return hasHardSkill || hasRoleKeyword || hasCompanyMatch;
    }).length || 0;
    
    const relevanceRatio = relevantExperiences / totalExperiences;
    
    // More generous scoring - even partial relevance should score
    if (relevanceRatio >= 0.8) {
      score = maxScore;
    } else if (relevanceRatio >= 0.5) {
      score = 4;
      suggestions.push('Consider highlighting more relevant experiences');
    } else if (relevanceRatio >= 0.3) {
      score = 3;
      suggestions.push('Focus on experiences most relevant to the target role');
    } else if (relevanceRatio > 0) {
      score = 2;
      suggestions.push('Add more experiences relevant to the job description');
    } else {
      // No matching experiences - but check if resume text has relevant content
      const resumeText = this.getFullResumeText(resume).toLowerCase();
      const hasAnyRelevance = jdAnalysis.hardSkills.some(s => resumeText.includes(s.toLowerCase())) ||
                              jdAnalysis.roleKeywords.some(k => resumeText.includes(k.toLowerCase()));
      score = hasAnyRelevance ? 2 : 1;
      suggestions.push('Tailor your experience bullets to include relevant keywords from the job description');
    }
    
    return { parameter: 'Relevance Filtering', parameterNumber: 14, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreToolsVersions(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 5;
    const suggestions: string[] = [];
    
    const resumeText = this.getFullResumeText(resume);
    
    // Check for version numbers
    const versionPattern = /\b(v?\d+\.\d+|\d+\.\d+\.\d+|ES\d+|Python\s*[23]|React\s*\d+|Node\s*\d+|Java\s*\d+)\b/gi;
    const versionMatches = resumeText.match(versionPattern) || [];
    
    if (versionMatches.length >= 3) {
      score = maxScore;
    } else if (versionMatches.length >= 1) {
      score = 3;
      suggestions.push('Add specific tool versions where relevant (e.g., React 18, Node.js 20)');
    } else {
      score = 1;
      suggestions.push('Mention specific tool versions to show current knowledge');
    }
    
    return { parameter: 'Tools & Versions', parameterNumber: 15, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static scoreProjectTechnicalDepth(resume: ResumeData, jdAnalysis: JDAnalysis): Parameter16Score {
    let score = 0;
    const maxScore = 7;
    const suggestions: string[] = [];
    
    if (!resume.projects || resume.projects.length === 0) {
      suggestions.push('Add projects with technical depth and complexity');
      return { parameter: 'Project Technical Depth', parameterNumber: 16, score: 0, maxScore, percentage: 0, suggestions };
    }
    
    // Technical depth indicators
    const depthIndicators = {
      architecture: ['microservices', 'distributed', 'scalable', 'architecture', 'system design', 'api', 'rest', 'graphql'],
      complexity: ['algorithm', 'optimization', 'performance', 'caching', 'concurrent', 'async', 'parallel', 'real-time'],
      infrastructure: ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'deployment', 'infrastructure'],
      database: ['database', 'sql', 'nosql', 'mongodb', 'postgresql', 'redis', 'elasticsearch', 'data modeling'],
      testing: ['testing', 'unit test', 'integration', 'e2e', 'tdd', 'coverage', 'jest', 'cypress'],
    };
    
    let totalDepthScore = 0;
    
    resume.projects.forEach(project => {
      const projectText = [
        project.title,
        project.description,
        ...(project.bullets || []),
        ...(project.techStack || []),
      ].join(' ').toLowerCase();
      
      let projectDepth = 0;
      
      // Check for depth indicators
      Object.values(depthIndicators).forEach(indicators => {
        const matches = indicators.filter(ind => projectText.includes(ind)).length;
        if (matches > 0) projectDepth += 1;
      });
      
      // Check for tech stack depth
      if (project.techStack && project.techStack.length >= 3) projectDepth += 1;
      if (project.techStack && project.techStack.length >= 5) projectDepth += 1;
      
      // Check for JD skill alignment
      const jdSkillMatches = jdAnalysis.hardSkills.filter(s => projectText.includes(s.toLowerCase())).length;
      if (jdSkillMatches >= 2) projectDepth += 1;
      
      totalDepthScore += Math.min(projectDepth, 3); // Cap per project
    });
    
    // Normalize score
    const avgDepth = totalDepthScore / resume.projects.length;
    score = Math.min(Math.round(avgDepth * 2.5), maxScore);
    
    if (score < 4) {
      suggestions.push('Add more technical details to projects (architecture, tech stack, complexity)');
    }
    if (score < 6) {
      suggestions.push('Include system design decisions and technical challenges solved');
    }
    
    return { parameter: 'Project Technical Depth', parameterNumber: 16, score, maxScore, percentage: Math.round((score/maxScore)*100), suggestions };
  }

  private static getFullResumeText(resume: ResumeData): string {
    const parts: string[] = [];
    
    if (resume.name) parts.push(resume.name);
    if (resume.targetRole) parts.push(resume.targetRole);
    if (resume.summary) parts.push(resume.summary);
    if (resume.careerObjective) parts.push(resume.careerObjective);
    
    resume.skills?.forEach(s => {
      parts.push(s.category);
      parts.push(s.list.join(' '));
    });
    
    resume.workExperience?.forEach(exp => {
      if (exp.role) parts.push(exp.role);
      if (exp.company) parts.push(exp.company);
      exp.bullets?.forEach(b => parts.push(b));
    });
    
    resume.projects?.forEach(proj => {
      if (proj.title) parts.push(proj.title);
      if (proj.description) parts.push(proj.description);
      proj.bullets?.forEach(b => parts.push(b));
      proj.techStack?.forEach(t => parts.push(t));
    });
    
    resume.education?.forEach(edu => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.school) parts.push(edu.school);
      if (edu.field) parts.push(edu.field);
    });
    
    return parts.join(' ');
  }

  private static formatSkillName(skill: string): string {
    const lowerSkill = skill.toLowerCase();
    
    const specialCases: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'nodejs': 'Node.js',
      'node.js': 'Node.js',
      'node': 'Node.js',
      'reactjs': 'React',
      'react.js': 'React',
      'react': 'React',
      'vuejs': 'Vue.js',
      'vue.js': 'Vue.js',
      'vue': 'Vue',
      'angularjs': 'AngularJS',
      'angular': 'Angular',
      'nextjs': 'Next.js',
      'next.js': 'Next.js',
      'nuxtjs': 'Nuxt.js',
      'nuxt.js': 'Nuxt.js',
      'nestjs': 'NestJS',
      'nest.js': 'NestJS',
      'expressjs': 'Express',
      'express.js': 'Express',
      'express': 'Express',
      'aws': 'AWS',
      'gcp': 'GCP',
      'azure': 'Azure',
      'html': 'HTML',
      'html5': 'HTML5',
      'css': 'CSS',
      'css3': 'CSS3',
      'sass': 'Sass',
      'scss': 'SCSS',
      'sql': 'SQL',
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'postgres': 'PostgreSQL',
      'mongodb': 'MongoDB',
      'redis': 'Redis',
      'graphql': 'GraphQL',
      'rest': 'REST',
      'restful': 'RESTful',
      'api': 'API',
      'apis': 'APIs',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'k8s': 'Kubernetes',
      'git': 'Git',
      'github': 'GitHub',
      'gitlab': 'GitLab',
      'jira': 'Jira',
      'jenkins': 'Jenkins',
      'terraform': 'Terraform',
      'ci/cd': 'CI/CD',
      'cicd': 'CI/CD',
      'devops': 'DevOps',
      'agile': 'Agile',
      'scrum': 'Scrum',
      'python': 'Python',
      'java': 'Java',
      'golang': 'Go',
      'go': 'Go',
      'rust': 'Rust',
      'ruby': 'Ruby',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'scala': 'Scala',
      'c++': 'C++',
      'c#': 'C#',
      '.net': '.NET',
      'dotnet': '.NET',
      'django': 'Django',
      'flask': 'Flask',
      'fastapi': 'FastAPI',
      'spring': 'Spring',
      'spring boot': 'Spring Boot',
      'rails': 'Rails',
      'laravel': 'Laravel',
      'tailwind': 'Tailwind CSS',
      'tailwindcss': 'Tailwind CSS',
      'bootstrap': 'Bootstrap',
      'webpack': 'Webpack',
      'vite': 'Vite',
      'babel': 'Babel',
      'eslint': 'ESLint',
      'jest': 'Jest',
      'cypress': 'Cypress',
      'selenium': 'Selenium',
      'pytest': 'Pytest',
      'junit': 'JUnit',
      'figma': 'Figma',
      'postman': 'Postman',
      'swagger': 'Swagger',
      'linux': 'Linux',
      'nginx': 'Nginx',
      'elasticsearch': 'Elasticsearch',
      'dynamodb': 'DynamoDB',
      'firebase': 'Firebase',
      'supabase': 'Supabase',
      'kafka': 'Kafka',
      'rabbitmq': 'RabbitMQ',
      'microservices': 'Microservices',
      'machine learning': 'Machine Learning',
      'deep learning': 'Deep Learning',
      'tensorflow': 'TensorFlow',
      'pytorch': 'PyTorch',
      'pandas': 'Pandas',
      'numpy': 'NumPy',
    };
    
    return specialCases[lowerSkill] || skill.charAt(0).toUpperCase() + skill.slice(1);
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface JDAnalysis {
  hardSkills: string[];
  softSkills: string[];
  roleKeywords: string[];
  seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'principal';
  yearsRequired: number;
  responsibilities: string[];
  rawText: string;
}

export default FullResumeRewriter16ParameterService;
