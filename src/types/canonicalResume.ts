/**
 * Runtime-neutral resume contract used by the canonical scoring rules engine.
 * Keep this file free of browser and Node-specific types so the same scorer can
 * run in the web application, tests, and the Supabase Edge runtime.
 */
import type { ResumeEvidenceDocument } from './resumeEvidence.ts';

export interface Education {
  degree: string;
  school: string;
  year: string;
  cgpa?: string;
  location?: string;
  field?: string;
}

export interface WorkExperience {
  role: string;
  company: string;
  year: string;
  bullets: string[];
  location?: string;
}

export interface Project {
  title: string;
  bullets: string[];
  githubUrl?: string;
  description?: string;
  techStack?: string[];
}

export interface Skill {
  category: string;
  count: number;
  list: string[];
}

export interface Certification {
  title: string;
  description: string;
}

export interface AdditionalSection {
  title: string;
  bullets: string[];
}

export interface ResumeData {
  name: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  location?: string;
  targetRole?: string;
  summary?: string;
  careerObjective?: string;
  education: Education[];
  workExperience: WorkExperience[];
  projects: Project[];
  skills: Skill[];
  certifications: (string | Certification)[];
  additionalSections?: AdditionalSection[];
  achievements?: string[];
  origin?: string;
  evidenceDocument?: ResumeEvidenceDocument;
}

export type UserType = 'fresher' | 'experienced' | 'student';
