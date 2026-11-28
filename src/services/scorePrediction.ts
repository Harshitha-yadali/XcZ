import type { ResumeData, UserType } from '../types/resume';
import { getTierTargetScore, type JdOptimizationTierId } from '../config/jdOptimizationTiers';
import { scoreResumeAgainstJD } from './jdScoringEngine';
import { normalizeCanonicalResume } from './canonicalResumeNormalizer';
import { canonicalSkillKey } from './resumeEvidenceExtractor';
import { applyCandidateBoost, boostSkillChoices, hasBoost, scoreLikeServer, type CandidateBoost } from './candidateBoost';

/**
 * Parameters a rewrite can take to full marks without inventing anything:
 * headings, bullet format, role headline, writing quality, skill grouping,
 * impact wording. Skills, numbers, years, education and certifications stay
 * as the resume (plus what the candidate confirmed) proves them.
 */
const REWRITE_REACHABLE = new Set([3, 4, 9, 12, 13, 14, 15, 16, 22, 27]);

/** The best score an honest rewrite can reach: rewrite-reachable parameters at full marks, the rest as proven. */
export function ceilingScore(resume: ResumeData, jobDescription: string, candidateType: UserType): number {
  const { parameters } = scoreResumeAgainstJD(normalizeCanonicalResume(resume), jobDescription, candidateType);
  let earned = 0;
  let max = 0;
  for (const p of parameters) {
    const weight = p.weightedMaxPoints || 0;
    max += weight;
    earned += REWRITE_REACHABLE.has(p.id) ? weight : (p.earnedPoints || 0);
  }
  return max > 0 ? Math.round((earned / max) * 100) : 0;
}

type SkillCategory = 'language' | 'frontend' | 'backend' | 'database' | 'cloud' | 'devops' | 'data' | 'ml' | 'testing' | 'tool';

/** project: a hand-written idea where the category template reads badly. */
const SKILL_INFO: Record<string, { what: string; docs: string; category: SkillCategory; project?: string }> = {
  Python: { what: 'A general-purpose language used for backend, scripting, data and AI.', docs: 'https://docs.python.org/3/tutorial/', category: 'language' },
  Java: { what: 'A typed language widely used for enterprise backends and Android.', docs: 'https://dev.java/learn/', category: 'language' },
  JavaScript: { what: 'The language of the web, used in browsers and on servers.', docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', category: 'language' },
  TypeScript: { what: 'JavaScript with types, catching bugs before the code runs.', docs: 'https://www.typescriptlang.org/docs/handbook/intro.html', category: 'language' },
  'C++': { what: 'A fast systems language used in performance-critical software.', docs: 'https://www.learncpp.com/', category: 'language' },
  'C#': { what: "Microsoft's typed language for .NET backends, desktop apps and games.", docs: 'https://learn.microsoft.com/en-us/dotnet/csharp/', category: 'language' },
  Go: { what: 'A simple, fast language popular for cloud services and tooling.', docs: 'https://go.dev/doc/', category: 'language' },
  Kotlin: { what: 'A modern JVM language and the default for Android apps.', docs: 'https://kotlinlang.org/docs/home.html', category: 'language' },
  React: { what: 'A JavaScript library for building user interfaces from components.', docs: 'https://react.dev/learn', category: 'frontend' },
  Angular: { what: "Google's full framework for building large web front ends.", docs: 'https://angular.dev/overview', category: 'frontend' },
  'Vue.js': { what: 'A lightweight framework for building interactive web interfaces.', docs: 'https://vuejs.org/guide/introduction.html', category: 'frontend' },
  'Next.js': { what: 'A React framework with routing, server rendering and APIs built in.', docs: 'https://nextjs.org/docs', category: 'frontend' },
  HTML: { what: 'The markup that structures every web page.', docs: 'https://developer.mozilla.org/en-US/docs/Learn/HTML', category: 'frontend' },
  CSS: { what: 'The language that styles and lays out web pages.', docs: 'https://developer.mozilla.org/en-US/docs/Learn/CSS', category: 'frontend' },
  'Tailwind CSS': { what: 'A utility-first CSS framework for styling directly in markup.', docs: 'https://tailwindcss.com/docs', category: 'frontend' },
  'Node.js': { what: 'Runs JavaScript on the server to build APIs and tools.', docs: 'https://nodejs.org/en/learn', category: 'backend' },
  'Express.js': { what: 'A minimal Node.js framework for building web APIs.', docs: 'https://expressjs.com/en/starter/installing.html', category: 'backend' },
  Django: { what: 'A batteries-included Python web framework.', docs: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/', category: 'backend' },
  Flask: { what: 'A small Python framework for web apps and APIs.', docs: 'https://flask.palletsprojects.com/en/stable/tutorial/', category: 'backend' },
  FastAPI: { what: 'A fast Python framework for typed REST APIs.', docs: 'https://fastapi.tiangolo.com/tutorial/', category: 'backend' },
  'Spring Boot': { what: 'The standard Java framework for production REST services.', docs: 'https://spring.io/guides/gs/spring-boot', category: 'backend' },
  'REST API': { what: 'A standard way for apps to talk over HTTP using resources and verbs.', docs: 'https://developer.mozilla.org/en-US/docs/Glossary/REST', category: 'backend', project: 'Build a small notes REST API (create, read, update, delete) in the language you know best, with input validation and the endpoints documented in the README.' },
  API: { what: 'How programs talk to each other; most jobs mean web (REST) APIs.', docs: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Introduction', category: 'backend', project: 'Build a small app that calls a free public API (e.g. weather) and exposes its own endpoint, with the setup in the README.' },
  GraphQL: { what: 'A query language that lets clients ask an API for exactly the data they need.', docs: 'https://graphql.org/learn/', category: 'backend' },
  Microservices: { what: 'Building an app as small independent services that talk over the network.', docs: 'https://microservices.io/patterns/microservices.html', category: 'backend', project: 'Split one of your projects into two small services (e.g. users and orders) that talk over HTTP, and draw the setup in the README.' },
  SQL: { what: 'The language for querying and changing data in relational databases.', docs: 'https://www.postgresql.org/docs/current/tutorial-sql.html', category: 'database', project: 'Load a public dataset into a database and write 10 SQL queries (joins, GROUP BY, window functions) that answer real questions; publish them on GitHub.' },
  MySQL: { what: 'A widely used open-source relational database.', docs: 'https://dev.mysql.com/doc/mysql-getting-started/en/', category: 'database' },
  PostgreSQL: { what: 'A powerful open-source relational database.', docs: 'https://www.postgresql.org/docs/current/tutorial.html', category: 'database' },
  MongoDB: { what: 'A document database that stores JSON-like records.', docs: 'https://www.mongodb.com/docs/manual/tutorial/getting-started/', category: 'database' },
  Redis: { what: 'An in-memory store used for caching, queues and sessions.', docs: 'https://redis.io/docs/latest/get-started/', category: 'database' },
  AWS: { what: "Amazon's cloud platform for servers, storage, databases and more.", docs: 'https://aws.amazon.com/getting-started/', category: 'cloud' },
  Azure: { what: "Microsoft's cloud platform for hosting apps and data.", docs: 'https://learn.microsoft.com/en-us/training/azure/', category: 'cloud' },
  'Google Cloud': { what: "Google's cloud platform for compute, data and AI services.", docs: 'https://cloud.google.com/docs/get-started', category: 'cloud' },
  Docker: { what: 'Packages an app and everything it needs into a container that runs anywhere.', docs: 'https://docs.docker.com/get-started/', category: 'devops' },
  Kubernetes: { what: 'Runs and scales containers across many machines.', docs: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', category: 'devops' },
  'CI/CD': { what: 'Automatically testing and deploying code on every change.', docs: 'https://docs.github.com/en/actions/get-started/quickstart', category: 'devops', project: 'Add a GitHub Actions workflow to one of your projects that runs its tests and deploys it on every push.' },
  Linux: { what: 'The operating system most servers run; used from the command line.', docs: 'https://ubuntu.com/tutorials/command-line-for-beginners', category: 'devops', project: 'Host one of your projects on a free Linux VM: set it up from the command line, run it as a service and write the steps in the README.' },
  Git: { what: 'Version control for tracking and sharing code changes.', docs: 'https://git-scm.com/book/en/v2', category: 'tool' },
  Jenkins: { what: 'An automation server for building, testing and deploying code.', docs: 'https://www.jenkins.io/doc/tutorials/', category: 'devops' },
  Terraform: { what: 'Describes cloud infrastructure as code so it can be created repeatably.', docs: 'https://developer.hashicorp.com/terraform/tutorials', category: 'devops' },
  Pandas: { what: 'The Python library for cleaning and analysing table data.', docs: 'https://pandas.pydata.org/docs/getting_started/', category: 'data' },
  NumPy: { what: 'Fast arrays and maths for Python.', docs: 'https://numpy.org/doc/stable/user/absolute_beginners.html', category: 'data' },
  'Power BI': { what: "Microsoft's tool for building dashboards and business reports.", docs: 'https://learn.microsoft.com/en-us/power-bi/fundamentals/', category: 'data' },
  Tableau: { what: 'A tool for building interactive data dashboards.', docs: 'https://www.tableau.com/learn/training', category: 'data' },
  Excel: { what: 'Spreadsheets for data analysis, formulas and pivot tables.', docs: 'https://support.microsoft.com/en-us/excel', category: 'data', project: 'Build an Excel sales dashboard from a public dataset with pivot tables, XLOOKUP and a chart, and share it with 3 findings.' },
  'Machine Learning': { what: 'Teaching computers to make predictions from data.', docs: 'https://developers.google.com/machine-learning/crash-course', category: 'ml', project: 'Train a model on a public dataset (e.g. house prices) and report its accuracy against a simple baseline.' },
  'Scikit-learn': { what: 'The standard Python library for classic machine learning.', docs: 'https://scikit-learn.org/stable/getting_started.html', category: 'ml' },
  TensorFlow: { what: "Google's library for building and training neural networks.", docs: 'https://www.tensorflow.org/tutorials', category: 'ml' },
  PyTorch: { what: 'A popular library for deep learning research and production.', docs: 'https://pytorch.org/tutorials/', category: 'ml' },
  Pytest: { what: 'The most used Python testing framework.', docs: 'https://docs.pytest.org/en/stable/getting-started.html', category: 'testing' },
  Jest: { what: 'A JavaScript testing framework for unit and component tests.', docs: 'https://jestjs.io/docs/getting-started', category: 'testing' },
  Selenium: { what: 'Automates a browser to test web apps end to end.', docs: 'https://www.selenium.dev/documentation/webdriver/getting_started/', category: 'testing' },
  'Unit Testing': { what: 'Writing small automated checks for each piece of code.', docs: 'https://martinfowler.com/bliki/UnitTest.html', category: 'testing' },
};

const INFO_BY_KEY = new Map(Object.entries(SKILL_INFO).map(([name, info]) => [canonicalSkillKey(name), info]));

const PROJECT_IDEAS: Record<SkillCategory | 'generic', (skill: string) => string> = {
  language: s => `Write a command-line expense or to-do tracker in ${s} that saves to a file, with a README and tests on GitHub.`,
  frontend: s => `Build a responsive job-search page with ${s}: list, filter and save jobs from a public JSON file; deploy it free on Netlify or Vercel.`,
  backend: s => `Build a small notes API with ${s}: create, read, update, delete, with input validation; document the endpoints in the README.`,
  database: s => `Design a ${s} schema for a library (books, members, loans) and write 10 queries for real questions, e.g. overdue books.`,
  cloud: s => `Deploy one of your existing projects on ${s}'s free tier and add the live link and a short architecture note to your resume.`,
  devops: s => `Add ${s} to one of your existing projects (e.g. containerise it or automate its tests/deploy) and show the setup in the README.`,
  data: s => `Take a public dataset (Kaggle or data.gov.in), clean it with ${s} and publish 3 clear findings with charts.`,
  ml: s => `Train a small model with ${s} on a public dataset (e.g. house prices) and report its accuracy against a simple baseline.`,
  testing: s => `Add ${s} tests to one of your existing projects and show the coverage number in the README.`,
  tool: s => `Use ${s} in one of your existing projects for a week and write up what you set up and why in the README.`,
  generic: s => `Build one small project that uses ${s} end to end, push it to GitHub with a README, and add it to your Projects section.`,
};

export interface SkillGapCard {
  skill: string;
  what: string;
  youtubeUrl: string;
  docsUrl: string | null;
  projectIdea: string;
  /** The score with this skill confirmed (and everything already confirmed). */
  scoreIfConfirmed: number;
  gain: number;
}

export const youtubeSearchUrl = (skill: string): string =>
  `https://www.youtube.com/results?${new URLSearchParams({ search_query: `${skill} tutorial for beginners` })}`;

// ponytail: scores at most 15 candidate skills (one scorer run each); raise if long JDs bury high-value skills.
const MAX_SKILLS_SCORED = 15;

interface GapPlanInput {
  resume: ResumeData;
  jobDescription: string;
  candidateType: UserType;
  /** What the candidate already confirmed; kept in every "if confirmed" score. */
  boost?: CandidateBoost | null;
  /** true: score as an honest rewrite could reach (before a run). false: score the resume as it is (after a run). */
  ceiling: boolean;
  limit?: number;
}

/**
 * The missing JD skills worth the most points, best first, each with a free
 * way to learn it, a project that proves it, and the score once confirmed.
 * Deterministic: a static map plus a generic fallback; no AI call.
 */
export function buildSkillGapPlan({ resume, jobDescription, candidateType, boost, ceiling, limit = 5 }: GapPlanInput): SkillGapCard[] {
  const base: CandidateBoost = { skills: boost?.skills || [], metrics: boost?.metrics || [] };
  const score = (value: ResumeData) => (ceiling ? ceilingScore : scoreLikeServer)(value, jobDescription, candidateType);
  const current = applyCandidateBoost(resume, hasBoost(base) ? base : null);
  const baseScore = score(current);
  return boostSkillChoices(current, jobDescription, MAX_SKILLS_SCORED)
    .map(skill => {
      const scoreIfConfirmed = score(applyCandidateBoost(resume, { ...base, skills: [...base.skills, { skill }] }));
      const info = INFO_BY_KEY.get(canonicalSkillKey(skill));
      return {
        skill,
        what: info?.what ?? `A skill this job asks for that your resume does not show yet.`,
        youtubeUrl: youtubeSearchUrl(skill),
        docsUrl: info?.docs ?? null,
        projectIdea: info?.project ?? PROJECT_IDEAS[info?.category ?? 'generic'](skill),
        scoreIfConfirmed,
        gain: scoreIfConfirmed - baseScore,
      };
    })
    .filter(card => card.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit);
}

export interface ScorePrediction {
  current: number;
  predicted: number;
  target: number;
  reachesTarget: boolean;
  /** Top missing JD skills not confirmed, most valuable first (only when the target is missed). */
  missingSkills: string[];
  /** Filled when the prediction misses the target. */
  gapPlan: SkillGapCard[];
}

/** Honest estimate of what a tier can reach, from the local scorer: the resume plus confirmed details, rewritten as well as the evidence allows. */
export function predictTierScore(input: {
  resume: ResumeData;
  jobDescription: string;
  candidateType: UserType;
  boost?: CandidateBoost | null;
  tier: JdOptimizationTierId;
}): ScorePrediction {
  const { resume, jobDescription, candidateType, boost, tier } = input;
  const current = scoreLikeServer(resume, jobDescription, candidateType);
  const predicted = Math.max(current, ceilingScore(applyCandidateBoost(resume, boost), jobDescription, candidateType));
  const target = getTierTargetScore(tier, current);
  const reachesTarget = predicted >= target;
  const gapPlan = reachesTarget ? [] : buildSkillGapPlan({ resume, jobDescription, candidateType, boost, ceiling: true });
  return { current, predicted, target, reachesTarget, missingSkills: gapPlan.map(card => card.skill), gapPlan };
}
