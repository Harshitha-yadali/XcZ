import { runOptimizationLoop } from '../src/services/optimizationLoopController';
import { scoreResumeAgainstJD } from '../src/services/jdScoringEngine';
import { ATSScoreChecker16Parameter } from '../src/services/atsScoreChecker16Parameter';
import type { ResumeData } from '../src/types/resume';

function resumeToText(resume: ResumeData): string {
  const lines: string[] = [];
  lines.push(resume.name);
  lines.push(`Email: ${resume.email}`);
  lines.push(`Phone: ${resume.phone}`);
  lines.push(`LinkedIn: ${resume.linkedin}`);
  lines.push(`GitHub: ${resume.github}`);
  if (resume.summary) {
    lines.push('\nSUMMARY');
    lines.push(resume.summary);
  }
  if (resume.skills?.length) {
    lines.push('\nSKILLS');
    for (const cat of resume.skills) {
      lines.push(`${cat.category}: ${cat.list.join(', ')}`);
    }
  }
  if (resume.workExperience?.length) {
    lines.push('\nWORK EXPERIENCE');
    for (const exp of resume.workExperience) {
      lines.push(`${exp.role} | ${exp.company} | ${exp.year}`);
      for (const b of exp.bullets || []) lines.push(`- ${b}`);
    }
  }
  if (resume.projects?.length) {
    lines.push('\nPROJECTS');
    for (const p of resume.projects) {
      lines.push(p.title);
      if (p.techStack?.length) lines.push(`Tech: ${p.techStack.join(', ')}`);
      for (const b of p.bullets || []) lines.push(`- ${b}`);
    }
  }
  if (resume.education?.length) {
    lines.push('\nEDUCATION');
    for (const edu of resume.education) {
      lines.push(`${edu.degree} | ${edu.school} | ${edu.year}`);
    }
  }
  if (resume.certifications?.length) {
    lines.push('\nCERTIFICATIONS');
    for (const cert of resume.certifications) {
      if (typeof cert === 'string') lines.push(`- ${cert}`);
      else lines.push(`- ${cert.title}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  const resume: ResumeData = {
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 9876543210',
    linkedin: 'linkedin.com/in/rahul-sharma-dev',
    github: 'github.com/rahulsharma-dev',
    location: 'Bengaluru, India',
    targetRole: 'Software Engineer',
    summary: 'Software developer with experience building web applications and APIs for business workflows.',
    skills: [
      { category: 'Technical Skills', count: 6, list: ['JavaScript', 'React', 'Node.js', 'Express', 'MySQL', 'Git'] },
      { category: 'Soft Skills', count: 2, list: ['Communication', 'Teamwork'] },
    ],
    workExperience: [
      {
        role: 'Software Developer',
        company: 'Acme Solutions',
        year: '2023 - Present',
        bullets: [
          'Worked on backend APIs for internal products',
          'Responsible for building dashboard features',
          'Helped with bug fixes and deployment tasks',
        ],
      },
    ],
    projects: [
      {
        title: 'Task Tracker App',
        techStack: ['React', 'Node.js'],
        bullets: [
          'Built a task management app for team use',
          'Implemented authentication and CRUD operations',
        ],
      },
      {
        title: 'Sales Report Portal',
        bullets: [
          'Developed reporting pages for sales team',
          'Created API endpoints and export features',
        ],
      },
    ],
    education: [
      { degree: 'B.Tech in Computer Science', school: 'VTU', year: '2023' },
    ],
    certifications: ['AWS Cloud Practitioner'],
  };

  const jobDescription = `
We are hiring a Senior Full Stack Developer to build scalable SaaS products.
Required skills: TypeScript, React, Next.js, Node.js, PostgreSQL, Redis, Docker, Kubernetes, AWS.
Good to have: CI/CD, GitHub Actions, system design, microservices architecture.
Responsibilities:
- Design and implement high-performance REST APIs and distributed services.
- Build responsive frontend modules with React and TypeScript.
- Optimize performance, reliability, and observability.
- Collaborate with product and engineering teams and mentor junior developers.
- Deliver measurable business impact and maintain 99.9% uptime.
Experience: 4+ years in software engineering and strong project ownership.
`;

  const beforeJd = scoreResumeAgainstJD(resume, jobDescription);
  const loopResult = await runOptimizationLoop(resume, jobDescription);
  const afterJd = scoreResumeAgainstJD(loopResult.optimizedResume, jobDescription);

  const beforeScoreChecker = await ATSScoreChecker16Parameter.evaluateWithUnified16AndParsedData(
    resumeToText(resume),
    jobDescription,
    resume,
    resume.targetRole
  );

  const afterScoreChecker = await ATSScoreChecker16Parameter.evaluateWithUnified16AndParsedData(
    resumeToText(loopResult.optimizedResume),
    jobDescription,
    loopResult.optimizedResume,
    loopResult.optimizedResume.targetRole
  );

  const summary = {
    jdOptimizerEngine: {
      before: beforeJd.overallScore,
      after: afterJd.overallScore,
      delta: afterJd.overallScore - beforeJd.overallScore,
      fixableBefore: beforeJd.fixableCount,
      fixableAfter: afterJd.fixableCount,
      nonFixableAfter: afterJd.nonFixableCount,
    },
    optimizationLoop: {
      iterations: loopResult.iterations.length,
      totalChanges: loopResult.totalChanges.length,
      reachedTarget: loopResult.reachedTarget,
    },
    resumeScoreCheckerUnified16: {
      before: beforeScoreChecker.overallScore,
      after: afterScoreChecker.overallScore,
      delta: afterScoreChecker.overallScore - beforeScoreChecker.overallScore,
      beforeMatch: beforeScoreChecker.matchQuality,
      afterMatch: afterScoreChecker.matchQuality,
    },
    topRemainingManualGaps: loopResult.gapClassification.nonFixableGaps.slice(0, 5).map(g => ({
      id: g.parameterId,
      name: g.parameterName,
      percentage: g.percentage,
      fixType: g.fixType,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Validation run failed:', error);
  process.exitCode = 1;
});
