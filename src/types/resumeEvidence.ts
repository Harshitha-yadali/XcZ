export type ResumeSectionKind =
  | 'header'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'achievements';

export interface SourceEvidence {
  sourceText: string;
  sourceSection: ResumeSectionKind;
  startIndex: number;
  endIndex: number;
}

export interface SectionEvidence extends SourceEvidence {
  heading: string;
  contentStartIndex: number;
  contentEndIndex: number;
}

export interface BulletEvidence extends SourceEvidence {
  text: string;
  marker: string;
}

export interface SkillEvidence extends SourceEvidence {
  canonicalSkill: string;
}

export interface ProjectEvidence extends SourceEvidence {
  title: string;
  technologies: SkillEvidence[];
  bullets: BulletEvidence[];
}

export interface ResumeEvidenceDocument {
  rawText: string;
  sections: Partial<Record<ResumeSectionKind, SectionEvidence>>;
  bullets: BulletEvidence[];
  skills: SkillEvidence[];
  projects: ProjectEvidence[];
}
