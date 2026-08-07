export interface InternalLink {
  label: string;
  path: string;
  description: string;
}

/**
 * Central registry of link targets so every generated page (role, company, comparison,
 * blog, landing) points to the same canonical tool/content URLs instead of ad-hoc strings.
 */
export const CORE_LINKS = {
  optimizer: { label: 'JD Resume Optimizer', path: '/optimizer', description: 'Tailor your resume to any job description with AI.' },
  jdOptimizerLanding: { label: 'JD Resume Optimizer Guide', path: '/jd-resume-optimizer', description: 'How JD-based resume tailoring works and when to use it.' },
  scoreChecker: { label: 'Resume Score Checker', path: '/score-checker', description: 'Get an instant ATS compatibility score for free.' },
  atsChecker: { label: 'ATS Resume Checker (16-Parameter)', path: '/ats-16-parameter', description: 'Run a deep 16-point ATS audit on your resume.' },
  guidedBuilder: { label: 'Guided Resume Builder', path: '/guided-builder', description: 'Build a resume section-by-section with AI guidance.' },
  linkedinGenerator: { label: 'LinkedIn Optimization Tool', path: '/linkedin-generator', description: 'Generate LinkedIn outreach and connection messages.' },
  portfolioBuilder: { label: 'Portfolio Website Builder', path: '/portfolio-builder', description: 'Turn your resume into a live portfolio site.' },
  mockInterview: { label: 'AI Mock Interview', path: '/mock-interview', description: 'Practice real interview questions with AI feedback.' },
  interviewQuestions: { label: 'Interview Questions Library', path: '/interview-questions', description: 'Common interview questions by role, with sample answers.' },
  referrals: { label: 'Referral Requests', path: '/referrals', description: 'Find and request referrals at top companies.' },
  referralTemplates: { label: 'Referral Message Templates', path: '/referral-message-templates', description: 'Copy-ready referral request templates that get replies.' },
  jobs: { label: 'Latest Jobs in India', path: '/jobs', description: 'Browse fresher and experienced openings.' },
  resumeKeywords: { label: 'Resume Keywords Guide', path: '/resume-keywords', description: 'Role-wise ATS keywords to include in your resume.' },
  resumeTemplates: { label: 'Resume Templates', path: '/resume-templates', description: 'ATS-friendly resume templates and formats.' },
  resumeExamples: { label: 'Resume Examples', path: '/resume-examples', description: 'Real resume examples by role and experience level.' },
  campusPlacements: { label: 'Campus Placement Resume Guide', path: '/campus-placement-resume', description: 'Resume and preparation guide for campus placements.' },
  blog: { label: 'Career & Resume Blog', path: '/blog', description: 'Guides on ATS, interviews, referrals and job search.' },
  allTools: { label: 'All Tools', path: '/all-tools', description: 'Every PrimoBoost AI career tool in one place.' },
  pricing: { label: 'Pricing', path: '/pricing', description: 'Plans for resume optimization and career tools.' },
} as const satisfies Record<string, InternalLink>;

/** Contextual link set for a role-specific programmatic landing page. */
export function roleContextualLinks(): InternalLink[] {
  return [CORE_LINKS.scoreChecker, CORE_LINKS.optimizer, CORE_LINKS.atsChecker, CORE_LINKS.resumeKeywords, CORE_LINKS.mockInterview];
}

/** Contextual link set for a company-specific programmatic landing page. */
export function companyContextualLinks(): InternalLink[] {
  return [CORE_LINKS.optimizer, CORE_LINKS.scoreChecker, CORE_LINKS.interviewQuestions, CORE_LINKS.jobs, CORE_LINKS.referrals];
}

/** Contextual link set for standalone SEO content/landing pages. */
export function landingContextualLinks(): InternalLink[] {
  return [CORE_LINKS.scoreChecker, CORE_LINKS.optimizer, CORE_LINKS.resumeTemplates, CORE_LINKS.blog];
}

/** Contextual link set surfaced from blog posts back into tools + landing pages. */
export function blogContextualLinks(): InternalLink[] {
  return [CORE_LINKS.scoreChecker, CORE_LINKS.optimizer, CORE_LINKS.resumeKeywords, CORE_LINKS.mockInterview, CORE_LINKS.allTools];
}
