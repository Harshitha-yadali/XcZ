import { strToU8, zipSync } from 'fflate';
import type { ResumeData, UserType } from '../types/resume';
import { getCertificationDisplayParts } from './certificationFormatting';

// A plain single-column Word document: real headings and real bullets, no
// tables, text boxes or headers, which applicant tracking systems skip.

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const xml = (value: unknown): string =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const run = (text: string, bold = false) =>
  `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const paragraph = (content: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${content}</w:p>`;
const heading = (text: string) => paragraph(run(text.toUpperCase()), 'Heading1');
const bullets = (lines: string[] | undefined) =>
  (lines || []).filter((line) => line?.trim()).map((line) => paragraph(run(line.trim()), 'ListBullet')).join('');
/** Title on the left, date at the right margin of the same line. */
const entry = (title: string, date?: string) =>
  paragraph(run(title, true) + (date?.trim() ? `<w:r><w:tab/></w:r>${run(date.trim())}` : ''), 'Entry');

const section = (title: string, body: string) => (body ? heading(title) + body : '');
const join = (parts: (string | undefined)[], separator: string) =>
  parts.map((part) => part?.trim()).filter(Boolean).join(separator);
const plainUrl = (url: string | undefined) => url?.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

const TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="20"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="808080"/></w:pBdr><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Entry"><w:name w:val="Entry"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:tabs><w:tab w:val="right" w:pos="9890"/></w:tabs><w:spacing w:before="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Question"><w:name w:val="Question"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr></w:style></w:styles>`;

/** The resume as a .docx file, in the same section order as the PDF. */
export function buildResumeDocx(resume: ResumeData, userType: UserType = 'experienced'): Uint8Array {
  const summary = userType === 'experienced'
    ? section('Professional Summary', resume.summary?.trim() ? paragraph(run(resume.summary.trim())) : '')
    : section('Career Objective', resume.careerObjective?.trim() ? paragraph(run(resume.careerObjective.trim())) : '');
  const skills = section('Skills', (resume.skills || []).filter((group) => group.list?.length)
    .map((group) => paragraph(run(`${group.category}: `, true) + run(group.list.join(', ')))).join(''));
  const experience = section(userType === 'experienced' ? 'Professional Experience' : 'Work Experience', (resume.workExperience || [])
    .map((job) => entry(join([job.role, join([job.company, job.location], ', ')], ' | '), job.year) + bullets(job.bullets)).join(''));
  const projects = section('Projects', (resume.projects || []).filter((project) => project.title?.trim())
    .map((project) => entry(project.title) + bullets(project.bullets)).join(''));
  const education = section('Education', (resume.education || [])
    .map((item) => entry(item.degree, item.year)
      + paragraph(run(join([item.school, item.location], ', ')))
      + (item.cgpa?.trim() ? paragraph(run(`CGPA: ${item.cgpa.trim()}`)) : '')).join(''));
  const certifications = section('Certifications', (resume.certifications || [])
    .map((item) => getCertificationDisplayParts(item as Parameters<typeof getCertificationDisplayParts>[0]))
    .filter((item) => item.title || item.description)
    .map((item) => paragraph(run(join([item.title, item.description], ': ')), 'ListBullet')).join(''));
  const achievements = userType === 'experienced' ? '' : section('Achievements', bullets(resume.achievements));
  const extras = (resume.additionalSections || []).map((item) => section(item.title || '', bullets(item.bullets))).join('');

  const body = [
    paragraph(run(resume.name.toUpperCase()), 'Title'),
    paragraph(run(join([resume.location, resume.phone, resume.email], ' | ')), 'Contact'),
    paragraph(run(join([plainUrl(resume.linkedin), plainUrl(resume.github)], ' | ')), 'Contact'),
    summary,
    ...(userType === 'student'
      ? [education, skills, projects, experience]
      : [skills, experience, projects, education]),
    certifications,
    achievements,
    extras,
  ].join('');

  return toDocx(body);
}

/** Interview questions with notes, then the cover letter on its own page. */
export function buildInterviewPackDocx(questions: { question: string; answer: string }[], letter: string): Uint8Array {
  return toDocx([
    heading('Interview questions'),
    ...questions.map(({ question, answer }, index) =>
      paragraph(run(`${index + 1}. ${question}`, true), 'Question') + paragraph(run(answer || 'Your resume does not show this. Prepare an honest answer.'))),
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    heading('Cover letter'),
    ...letter.split('\n').map((line) => paragraph(run(line))),
  ].join(''));
}

function toDocx(body: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(TYPES),
    '_rels/.rels': strToU8(RELS),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1008" w:right="1008" w:bottom="1008" w:left="1008" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`),
    'word/_rels/document.xml.rels': strToU8(DOCUMENT_RELS),
    'word/styles.xml': strToU8(STYLES),
    'word/numbering.xml': strToU8(NUMBERING),
  });
}
