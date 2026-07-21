import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileSearch,
  FileText,
  Gauge,
  GraduationCap,
  Headphones,
  Linkedin,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UploadCloud,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useSEO } from '../../hooks/useSEO';

interface HomePageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowSubscriptionPlans: (featureId?: string, expandAddons?: boolean) => void;
  onShowSubscriptionPlansDirectly: () => void;
  userSubscription: unknown;
}

type IconType = React.ComponentType<{ className?: string }>;

const spring = { type: 'spring' as const, stiffness: 260, damping: 24 };

const trustedCompanies = [
  'Google',
  'Microsoft',
  'Amazon',
  'Apple',
  'Meta',
  'Netflix',
  'Adobe',
  'IBM',
  'Oracle',
  'Salesforce',
  'SAP',
  'Intel',
  'NVIDIA',
  'AMD',
  'Cisco',
  'Dell Technologies',
  'HP',
  'Lenovo',
  'Samsung',
  'Sony',
  'TCS',
  'Accenture',
  'Infosys',
  'Cognizant',
  'Capgemini',
  'Wipro',
  'Deloitte',
  'EY',
  'PwC',
  'KPMG',
  'McKinsey & Company',
  'Boston Consulting Group',
  'Bain & Company',
  'Uber',
  'Airbnb',
  'Stripe',
  'PayPal',
  'Visa',
  'Mastercard',
  'American Express',
  'JPMorgan Chase',
  'Goldman Sachs',
  'Morgan Stanley',
  'Bank of America',
  'Citi',
  'HSBC',
  'Barclays',
  'UBS',
  'Deutsche Bank',
  'Wells Fargo',
  'Capital One',
  'Walmart',
  'Target',
  'Costco',
  'IKEA',
  'Nike',
  'Adidas',
  'PepsiCo',
  'Coca-Cola',
  'Unilever',
  'Procter & Gamble',
  'Nestlé',
  'Mondelēz International',
  "L'Oréal",
  'Johnson & Johnson',
  'Pfizer',
  'Novartis',
  'Roche',
  'AstraZeneca',
  'Merck',
  'GSK',
  'Siemens',
  'GE Aerospace',
  'Honeywell',
  'Bosch',
  'Schneider Electric',
  'ABB',
  'Tesla',
  'Ford',
  'General Motors',
  'Toyota',
  'BMW',
  'Mercedes-Benz',
  'Volkswagen',
  'Volvo',
  'Boeing',
  'Airbus',
  'SpaceX',
  'Lockheed Martin',
  'FedEx',
  'UPS',
  'DHL',
  'Maersk',
  'Shell',
  'ExxonMobil',
  'Chevron',
  'BP',
  'TotalEnergies',
  'Reliance Industries',
  'Tata Motors',
  'Tata Steel',
  'Mahindra Group',
  'Larsen & Toubro',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'State Bank of India',
  'Bajaj Finserv',
  'Aditya Birla Group',
  'Hindustan Unilever',
  'ITC',
  'Maruti Suzuki',
  'Flipkart',
  'Myntra',
  'Swiggy',
  'Zomato',
  'Ola',
  'Paytm',
  'PhonePe',
  'Razorpay',
  'CRED',
  'Groww',
  'Zerodha',
  'Freshworks',
  'Zoho',
  'BrowserStack',
  'Postman',
  'InMobi',
  'Dream11',
  'Meesho',
  'Udaan',
  'Delhivery',
  'OYO',
  'MakeMyTrip',
  'Unacademy',
  'upGrad',
  'Physics Wallah',
  'Info Edge',
  'Practo',
  'PharmEasy',
  'Pine Labs',
  'Policybazaar',
  'Nykaa',
  'Lenskart',
  'Urban Company',
  'BigBasket',
  'Tata Digital',
  'Jio Platforms',
  'Airtel',
  'Vodafone Idea',
  'Tech Mahindra',
  'HCLTech',
  'LTIMindtree',
  'Mphasis',
  'Persistent Systems',
  'Hexaware',
  'Coforge',
  'Atlassian',
  'Canva',
  'Figma',
  'Notion',
  'Slack',
  'Dropbox',
  'Box',
  'Zoom',
  'Shopify',
  'Spotify',
  'ByteDance',
  'Tencent',
  'Alibaba',
  'Baidu',
  'Rakuten',
  'Grab',
  'Gojek',
  'Sea Group',
  'Mercado Libre',
  'Booking.com',
  'Expedia Group',
  'DoorDash',
  'Instacart',
  'Pinterest',
  'Reddit',
  'Snap',
  'LinkedIn',
  'GitHub',
  'GitLab',
  'Cloudflare',
  'Datadog',
  'Snowflake',
  'MongoDB',
  'Elastic',
  'ServiceNow',
  'Workday',
  'Okta',
  'CrowdStrike',
  'Palo Alto Networks',
  'Broadcom',
  'Qualcomm',
  'ASML',
];

const serviceCards: Array<{
  title: string;
  description: string;
  eyebrow: string;
  path: string;
  cta: string;
  icon: IconType;
  accent: string;
  span: string;
}> = [
  {
    title: 'ATS Score Check',
    description: 'See how well your resume matches a role and uncover the issues that can block shortlisting.',
    eyebrow: 'Start for ₹9',
    path: '/score-checker',
    cta: 'Check my resume',
    icon: Gauge,
    accent: 'from-emerald-400/20 via-emerald-400/5 to-transparent',
    span: 'lg:col-span-2 lg:row-span-2',
  },
  {
    title: 'AI Resume Optimizer',
    description: 'Turn every issue in your score report into a role-specific, ATS-ready improvement.',
    eyebrow: 'Fix what matters',
    path: '/optimizer',
    cta: 'Optimize with AI',
    icon: Wand2,
    accent: 'from-blue-400/20 via-blue-400/5 to-transparent',
    span: 'lg:col-span-2',
  },
  {
    title: 'AI Job Search',
    description: 'Discover curated roles and move from job match to a tailored application in one flow.',
    eyebrow: 'Find your next role',
    path: '/jobs',
    cta: 'Explore jobs',
    icon: Briefcase,
    accent: 'from-cyan-400/20 via-cyan-400/5 to-transparent',
    span: 'lg:col-span-2',
  },
  {
    title: 'Interview Preparation',
    description: 'Practice realistic questions, sharpen your delivery and learn from actionable AI feedback.',
    eyebrow: 'Practice with purpose',
    path: '/mock-interview',
    cta: 'Start practicing',
    icon: MessageSquareText,
    accent: 'from-violet-400/20 via-violet-400/5 to-transparent',
    span: 'lg:col-span-2',
  },
  {
    title: 'Professional Referrals',
    description: 'Explore referral opportunities and connect your stronger resume to the right openings.',
    eyebrow: 'Get closer to the team',
    path: '/referrals',
    cta: 'View referrals',
    icon: Users,
    accent: 'from-teal-400/20 via-teal-400/5 to-transparent',
    span: 'lg:col-span-2',
  },
];

const faqs = [
  {
    question: 'How much does the ATS resume check cost?',
    answer:
      'A resume score check costs ₹9. It helps you understand your match, missing keywords and formatting risks before deciding whether to purchase an optimization plan.',
  },
  {
    question: 'What happens after I receive my score?',
    answer:
      'Your report highlights the gaps that matter. If you want help fixing them, you can continue into the paid AI Resume Optimizer, which rewrites and tailors your resume for the role you selected.',
  },
  {
    question: 'How is the resume matched to a job description?',
    answer:
      'PrimoBoost compares your resume with the target job across 30 evidence-backed checks, including skills, role keywords, experience relevance, impact, structure and ATS readability.',
  },
  {
    question: 'What is CareerBooster?',
    answer:
      'CareerBooster is the guided path for job seekers who want more than a tool. It combines expert support with resume review, job-search direction and interview strategy through the existing 1:1 session experience.',
  },
  {
    question: 'Does PrimoBoost guarantee interviews or job offers?',
    answer:
      'No platform can guarantee a hiring outcome. PrimoBoost helps you improve application quality, relevance and preparation so you can compete with a stronger profile.',
  },
  {
    question: 'Is my resume handled securely?',
    answer:
      'Your resume is used to provide the analysis and optimization experience. The product is designed around secure account access and controlled document handling.',
  },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'center' | 'left';
}) {
  return (
    <motion.div
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55 }}
      className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-left'}
    >
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
        <Sparkles className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg">{description}</p>
    </motion.div>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function HeroProductPreview({ onOptimize }: { onOptimize: () => void }) {
  const reduceMotion = useReducedMotion();
  const issues = [
    { label: 'Missing role keywords', value: '8 found', color: 'text-amber-300', icon: Search },
    { label: 'Impact statements', value: 'Needs work', color: 'text-rose-300', icon: TrendingUp },
    { label: 'ATS formatting', value: '2 issues', color: 'text-sky-300', icon: FileCheck2 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.75, delay: 0.25 }}
      className="relative mx-auto min-w-0 w-full max-w-[570px]"
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <GlassCard className="p-3 sm:p-5">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-400/[0.12] to-transparent" />
          <div className="relative rounded-[22px] border border-white/[0.08] bg-[#07131c]/90 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10">
                  <FileSearch className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">ATS match report</div>
                  <div className="mt-0.5 text-xs text-slate-500">Product Designer · Acme</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Analysis ready
              </div>
            </div>

            <div className="grid gap-4 py-5 sm:grid-cols-[140px_1fr] sm:items-center">
              <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-[conic-gradient(#34d399_0_72%,rgba(255,255,255,0.08)_72%_100%)]">
                <div className="grid h-[94px] w-[94px] place-items-center rounded-full bg-[#091720] text-center">
                  <div>
                    <div className="text-3xl font-semibold tracking-tight text-white">72</div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">ATS score</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Match strength</span>
                  <span className="font-medium text-amber-200">Good start</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '72%' }}
                    transition={{ duration: 1.1, delay: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Your experience is relevant. Closing three gaps could make the resume more competitive.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {issues.map((issue, index) => (
                <motion.div
                  key={issue.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 + index * 0.12 }}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-3"
                >
                  <div className="flex items-center gap-2.5 text-xs font-medium text-slate-300 sm:text-sm">
                    <issue.icon className={`h-4 w-4 ${issue.color}`} />
                    {issue.label}
                  </div>
                  <span className={`text-[11px] font-medium ${issue.color}`}>{issue.value}</span>
                </motion.div>
              ))}
            </div>

            <button
              type="button"
              onClick={onOptimize}
              className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(52,211,153,0.2)] transition hover:brightness-110"
            >
              <Wand2 className="h-4 w-4" />
              Fix these issues with AI
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, ...spring }}
        className="absolute -bottom-5 -left-2 hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1a23]/90 px-3.5 py-3 shadow-2xl backdrop-blur-xl sm:flex"
      >
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-400/10">
          <Zap className="h-4 w-4 text-blue-300" />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">Clear next step</div>
          <div className="text-[10px] text-slate-500">Check first, optimize when ready</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OptimizerPreview({ onOptimize }: { onOptimize: () => void }) {
  return (
    <GlassCard className="p-3 sm:p-5 lg:p-6">
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[22px] border border-white/[0.07] bg-[#09141d]/85 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <FileText className="h-4 w-4 text-slate-500" />
              Original resume
            </div>
            <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">72 match</span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-3 w-2/5 rounded bg-white/10" />
            <div className="h-2 w-3/4 rounded bg-white/[0.055]" />
            <div className="h-px bg-white/[0.07]" />
            {[
              'Responsible for product design work',
              'Worked with engineering and product',
              'Made wireframes for new features',
            ].map((line) => (
              <div key={line} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">
                {line}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-rose-300/10 bg-rose-300/[0.045] p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-rose-200">
              <Target className="h-3.5 w-3.5" />
              Missing: design systems, user research, Figma
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.09] to-blue-400/[0.05] p-5">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              AI-optimized resume
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">91 match</span>
          </div>
          <div className="relative mt-5 space-y-3">
            <div className="h-3 w-2/5 rounded bg-emerald-200/20" />
            <div className="h-2 w-4/5 rounded bg-white/[0.08]" />
            <div className="h-px bg-white/[0.09]" />
            {[
              'Led end-to-end product design for 3 high-impact workflows, improving activation by 18%.',
              'Partnered with product and engineering to ship a reusable design system across 2 squads.',
              'Translated user research into Figma prototypes tested with 24 target customers.',
            ].map((line, index) => (
              <motion.div
                key={line}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                className="flex gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3 text-xs leading-5 text-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-300" />
                {line}
              </motion.div>
            ))}
          </div>
          <button
            type="button"
            onClick={onOptimize}
            className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-white"
          >
            Optimize my resume <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function JobDiscoveryPreview({ onExplore }: { onExplore: () => void }) {
  const jobs = [
    { role: 'Product Designer', company: 'Fintech team', location: 'Bengaluru · Hybrid', match: 92, icon: 'F' },
    { role: 'UX Designer II', company: 'Global SaaS', location: 'Remote · India', match: 87, icon: 'S' },
    { role: 'Senior UI/UX Designer', company: 'Consumer tech', location: 'Gurugram · Hybrid', match: 84, icon: 'C' },
  ];

  return (
    <GlassCard className="p-3 sm:p-5">
      <div className="rounded-[22px] border border-white/[0.07] bg-[#08141d]/90 p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Briefcase className="h-4 w-4 text-blue-300" />
              Recommended for your profile
            </div>
            <p className="mt-1 text-xs text-slate-500">Jobs ranked by skills and experience relevance</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
            <Search className="h-3.5 w-3.5" />
            Product design
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {jobs.map((job, index) => (
            <motion.button
              type="button"
              key={job.role}
              onClick={onExplore}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ x: 4 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex w-full flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition-colors hover:border-blue-300/20 hover:bg-blue-300/[0.04] sm:flex-row sm:items-center"
            >
              <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gradient-to-br from-blue-400/20 to-emerald-400/10 text-sm font-semibold text-blue-200">
                {job.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">{job.role}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{job.company}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-200">{job.match}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600">match</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-600" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

export const HomePage: React.FC<HomePageProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowSubscriptionPlans,
  onShowSubscriptionPlansDirectly,
  userSubscription,
}) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [globalResumesCreated, setGlobalResumesCreated] = useState(60070);
  const [scoreChecksCompleted, setScoreChecksCompleted] = useState(500070);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useSEO({
    title: 'ATS Resume Checker & AI Resume Optimizer',
    description:
      'Applied everywhere but still not getting interview calls? Check your resume against any job description, find ATS issues, and fix them with PrimoBoost AI.',
    keywords:
      'ATS resume checker, ATS score checker, resume optimizer, job description resume match, AI resume optimization, CareerBooster, resume review, interview preparation',
    canonical: '/',
    ogType: 'website',
    ogTitle: 'Check What Is Blocking Your Resume From Shortlisting',
    ogDescription: 'Get an ATS score, identify resume gaps, and fix them with PrimoBoost AI.',
    twitterCard: 'summary_large_image',
  });

  useEffect(() => {
    const fetchGlobalCount = async () => {
      try {
        const count = await authService.getGlobalResumesCreatedCount();
        if (Number.isFinite(count) && count > 0) setGlobalResumesCreated(count);
      } catch (error) {
        console.error('HomePage: Error fetching global resumes count:', error);
      }
    };
    fetchGlobalCount();
  }, []);

  useEffect(() => {
    const base = 500070;
    const hydrateCount = () => {
      const stored = Number.parseInt(localStorage.getItem('scoreCheckCount') || '0', 10);
      setScoreChecksCompleted(base + (Number.isNaN(stored) ? 0 : stored));
    };
    hydrateCount();
    const handleScoreCheck = () => hydrateCount();
    window.addEventListener('score-check-completed', handleScoreCheck);
    return () => window.removeEventListener('score-check-completed', handleScoreCheck);
  }, []);

  const startCareerBooster = () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate('/session');
  };

  const metrics = [
    {
      value: `${globalResumesCreated.toLocaleString()}+`,
      label: 'Resumes created or optimized',
      source: 'Live platform activity',
      icon: FileCheck2,
    },
    {
      value: `${scoreChecksCompleted.toLocaleString()}+`,
      label: 'Resume score checks',
      source: 'Product usage counter',
      icon: BarChart3,
    },
    {
      value: '28',
      label: 'Resume signals analyzed',
      source: 'Published scoring framework',
      icon: Target,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050c13] text-slate-100 md:ml-16">
      <div className="pointer-events-none fixed inset-0 md:left-16">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_65%)]" />
        <div className="absolute -left-48 -top-40 h-[620px] w-[620px] rounded-full bg-emerald-500/[0.12] blur-[140px]" />
        <div className="absolute -right-44 top-16 h-[620px] w-[620px] rounded-full bg-blue-600/[0.13] blur-[150px]" />
      </div>

      <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.03fr_0.97fr] lg:gap-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            className="relative z-10 min-w-0"
          >
            <motion.div
              variants={reveal}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3.5 py-2 text-xs font-semibold text-emerald-200"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Built for the modern job search
            </motion.div>

            <motion.h1
              variants={reveal}
              transition={{ duration: 0.55 }}
              className="mt-6 max-w-3xl text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.25rem]"
            >
              Applied everywhere but still not getting{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                interview calls?
              </span>
            </motion.h1>

            <motion.p
              variants={reveal}
              transition={{ duration: 0.55 }}
              className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8"
            >
              Check your resume against any job description, identify ATS problems and fix the issues preventing shortlisting.
            </motion.p>

            <motion.div variants={reveal} transition={{ duration: 0.55 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.button
                type="button"
                onClick={() => navigate('/score-checker')}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_16px_45px_rgba(52,211,153,0.22)] transition hover:brightness-110 sm:text-base"
              >
                Check My Resume — ₹9
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
              <button
                type="button"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.07] sm:text-base"
              >
                See how it works
                <ChevronDown className="h-4 w-4" />
              </button>
            </motion.div>

            <motion.div variants={reveal} transition={{ duration: 0.55 }} className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              {['One-time ₹9 check', 'Takes about 2 minutes', 'Clear, actionable report'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>

          <HeroProductPreview onOptimize={() => navigate('/optimizer')} />
        </div>

        {!reduceMotion && (
          <motion.div
            animate={{ opacity: [0.25, 0.65, 0.25], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 7, repeat: Infinity }}
            className="pointer-events-none absolute left-[48%] top-24 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl"
          />
        )}
      </section>

      <section className="relative border-y border-white/[0.07] bg-white/[0.022] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
            Built for candidates applying to teams at
          </p>
          <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <motion.div
              className="flex w-max items-center"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: trustedCompanies.length, repeat: Infinity, ease: 'linear' }}
            >
              {[...trustedCompanies, ...trustedCompanies].map((company, index) => (
                <div
                  key={`${company}-${index}`}
                  aria-hidden={index >= trustedCompanies.length}
                  className="w-44 flex-none text-center text-sm font-semibold tracking-[-0.02em] text-slate-500 transition hover:text-slate-300 sm:w-52 sm:text-base"
                >
                  {company}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-px overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-[#071019] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{metric.value}</div>
                  <div className="mt-2 text-sm font-medium text-slate-300">{metric.label}</div>
                  <div className="mt-1.5 text-[11px] text-slate-600">Source: {metric.source}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/10 bg-emerald-300/[0.055]">
                  <metric.icon className="h-4 w-4 text-emerald-300" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-4xl text-center text-[11px] leading-5 text-slate-600">
          Usage counters describe activity on the platform. They do not represent interview or hiring guarantees.
        </p>
      </section>

      <section id="services" className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="One career workspace"
            title="Everything between applying and getting ready for the interview"
            description="Start with the free diagnosis, then use the right level of support for the gap standing between you and your next opportunity."
          />

          <div className="mt-12 grid auto-rows-auto gap-4 lg:grid-cols-6 lg:auto-rows-[250px]">
            {serviceCards.map((card, index) => (
              <motion.button
                type="button"
                key={card.title}
                onClick={() => navigate(card.path)}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className={`group relative min-h-[250px] overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-6 text-left shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors hover:border-white/[0.15] ${card.span}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-70 transition-opacity group-hover:opacity-100`} />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
                      <card.icon className="h-5 w-5 text-white" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-600 transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                  <div className="mt-auto pt-8">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">{card.eyebrow}</div>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">{card.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{card.description}</p>
                    <div className="mt-4 text-sm font-semibold text-slate-200">{card.cta}</div>
                  </div>
                </div>
              </motion.button>
            ))}

            <motion.button
              type="button"
              onClick={startCareerBooster}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              className="group relative min-h-[250px] overflow-hidden rounded-[26px] border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.12] via-cyan-300/[0.05] to-blue-400/[0.08] p-6 text-left shadow-[0_20px_70px_rgba(16,185,129,0.1)] lg:col-span-2"
            >
              <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/10">
                    <GraduationCap className="h-5 w-5 text-emerald-200" />
                  </div>
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                    Expert guided
                  </span>
                </div>
                <div className="mt-auto pt-8">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">Need a human strategy?</div>
                  <h3 className="mt-2 text-xl font-semibold text-white">CareerBooster</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Pair the platform with a focused 1:1 resume, job-search and interview strategy session.</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
                    Build my career plan <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative border-y border-white/[0.06] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="A smarter funnel"
            title="Know what is wrong before choosing how to fix it"
            description="Your score is the diagnosis. The optimizer is the treatment. CareerBooster adds expert direction when you want a broader plan."
          />
          <div className="relative mt-14 grid gap-4 lg:grid-cols-3">
            <div className="absolute left-[17%] right-[17%] top-12 hidden h-px bg-gradient-to-r from-emerald-300/20 via-cyan-300/40 to-blue-300/20 lg:block" />
            {[
              {
                step: '01',
                title: 'Run an ATS check',
                text: 'Upload your resume and add the job description you want to target.',
                icon: UploadCloud,
              },
              {
                step: '02',
                title: 'See the exact gaps',
                text: 'Understand missing keywords, weak impact, formatting issues and role alignment.',
                icon: FileSearch,
              },
              {
                step: '03',
                title: 'Fix or get guided',
                text: 'Use the AI Optimizer for targeted fixes or CareerBooster for expert support.',
                icon: Wand2,
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative rounded-[26px] border border-white/[0.08] bg-[#08131c]/85 p-6 text-center backdrop-blur-xl sm:p-8"
              >
                <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/10 to-blue-400/10 shadow-[0_0_28px_rgba(52,211,153,0.08)]">
                  <item.icon className="h-6 w-6 text-emerald-200" />
                </div>
                <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">Step {item.step}</div>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-9 text-center">
            <button
              type="button"
              onClick={() => navigate('/score-checker')}
              className="group inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-white"
            >
              Start with my ₹9 score <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <SectionHeading
              eyebrow="Resume Optimizer"
              title="From generic bullets to job-relevant proof"
              description="The optimizer uses your score report and target job to strengthen relevance, add missing context and make every line work harder."
              align="left"
            />
            <div className="mt-7 space-y-3">
              {['Tailored to one job description', 'Impact-focused bullet rewrites', 'ATS-friendly keyword alignment', 'Editable before you export'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 flex-none text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/optimizer')}
              className="group mt-8 inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.13]"
            >
              Explore the Optimizer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          <OptimizerPreview onOptimize={() => navigate('/optimizer')} />
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-gradient-to-b from-blue-400/[0.025] to-transparent px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="order-2 lg:order-1">
            <JobDiscoveryPreview onExplore={() => navigate('/jobs')} />
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="AI Job Search"
              title="Stop scrolling through jobs that do not fit"
              description="Discover relevant openings, understand profile fit and carry your optimized resume directly into the application journey."
              align="left"
            />
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {[
                { icon: Target, label: 'Profile-match ranking' },
                { icon: Clock3, label: 'Fresh job updates' },
                { icon: FileCheck2, label: 'Resume-ready flow' },
                { icon: BadgeCheck, label: 'Curated opportunities' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 text-sm text-slate-300">
                  <item.icon className="h-4 w-4 text-blue-300" />
                  {item.label}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white"
            >
              Discover relevant jobs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Simple ways to start"
            title="Start with a ₹9 score check"
            description="Understand the problem first, then choose AI fixes or expert guidance only when you need them."
          />

          <div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-3">
            {[
              {
                name: 'ATS Check',
                price: '₹9',
                note: 'One resume score check',
                features: ['Resume-to-JD score', 'ATS issue summary', 'Missing keyword signals', 'Clear next steps'],
                cta: 'Check My Resume',
                action: () => navigate('/score-checker'),
                featured: false,
                icon: FileSearch,
              },
              {
                name: 'AI Optimizer',
                price: 'Pay as you go',
                note: 'For candidates ready to fix the gaps',
                features: ['Job-specific optimization', 'AI bullet rewrites', 'Keyword alignment', 'Editable resume output'],
                cta: userSubscription ? 'View Upgrade Options' : 'View Optimizer Plans',
                action: () => onShowSubscriptionPlans('optimizer', true),
                featured: true,
                icon: Sparkles,
              },
              {
                name: 'CareerBooster',
                price: 'Expert guided',
                note: 'For a more personal career strategy',
                features: ['1:1 expert session', 'Resume deep-dive', 'Interview direction', 'Personal action plan'],
                cta: 'Explore CareerBooster',
                action: startCareerBooster,
                featured: false,
                icon: Headphones,
              },
            ].map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                viewport={{ once: true }}
                className={`relative rounded-[28px] border p-6 sm:p-7 ${
                  plan.featured
                    ? 'border-emerald-300/25 bg-gradient-to-b from-emerald-300/[0.11] to-white/[0.035] shadow-[0_24px_80px_rgba(16,185,129,0.11)]'
                    : 'border-white/[0.08] bg-white/[0.035]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-5 top-5 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                    Best next step
                  </div>
                )}
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.055]">
                  <plan.icon className="h-5 w-5 text-emerald-200" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">{plan.name}</h3>
                <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{plan.price}</div>
                <p className="mt-1 text-xs text-slate-500">{plan.note}</p>
                <div className="my-6 h-px bg-white/[0.08]" />
                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 flex-none text-emerald-300" />
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={plan.action}
                  className={`mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    plan.featured
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:brightness-110'
                      : 'border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09]'
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
          <div className="mt-7 text-center">
            <button type="button" onClick={onShowSubscriptionPlansDirectly} className="text-sm font-medium text-slate-400 underline decoration-white/20 underline-offset-4 transition hover:text-white">
              Compare all plans and add-ons
            </button>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Candidate perspective"
            title="The moments that make the job search feel clearer"
            description="Representative feedback themes from the PrimoBoost experience, presented without promising a particular hiring outcome."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {[
              {
                quote: 'The score showed me why a resume that looked polished was still missing the language used in the role.',
                role: 'Product candidate',
                result: 'Clarity before editing',
              },
              {
                quote: 'I liked that I could see the issues first and only move to optimization when the changes actually made sense.',
                role: 'Early-career engineer',
                result: 'A more confident next step',
              },
              {
                quote: 'The combination of a tailored resume and interview practice made my preparation feel like one connected process.',
                role: 'Career switcher',
                result: 'One joined-up workflow',
              },
            ].map((testimonial, index) => (
              <motion.figure
                key={testimonial.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-[26px] border border-white/[0.08] bg-[#08131c]/80 p-6"
              >
                <div className="flex gap-1 text-amber-300/80" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((star) => <Star key={star} className="h-3.5 w-3.5 fill-current" />)}
                </div>
                <blockquote className="mt-5 text-base leading-7 text-slate-200">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-7 border-t border-white/[0.07] pt-4">
                  <div className="text-sm font-semibold text-white">{testimonial.role}</div>
                  <div className="mt-1 text-xs text-emerald-200/70">{testimonial.result}</div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading
              eyebrow="FAQ"
              title="Know exactly what you are getting"
              description="Straight answers about the score check, paid optimizer and expert-guided CareerBooster path."
              align="left"
            />
            <div className="mt-7 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.045] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-emerald-300" />
                <p className="text-xs leading-5 text-slate-400">PrimoBoost helps improve preparation and application quality. Hiring decisions always remain with employers.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left text-sm font-semibold text-white sm:text-base"
                  >
                    {faq.question}
                    <ChevronDown className={`h-4 w-4 flex-none text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="px-5 pb-5 text-sm leading-6 text-slate-400">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.16] via-cyan-400/[0.08] to-blue-500/[0.14] px-5 py-12 text-center shadow-[0_30px_100px_rgba(16,185,129,0.12)] sm:px-10 sm:py-16 lg:px-16"
        >
          <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-300/20 blur-[90px]" />
          <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-blue-400/20 blur-[100px]" />
          <div className="relative">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/[0.08] backdrop-blur-xl">
              <Sparkles className="h-5 w-5 text-emerald-200" />
            </div>
            <h2 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              Your resume should open doors, not disappear into a system.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Start with a ₹9 ATS check. See the gaps. Then decide whether AI optimization or expert guidance is the right next step.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/score-checker')}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-50"
              >
                Check My Resume — ₹9 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={startCareerBooster}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.065] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/[0.1]"
              >
                <CalendarCheck className="h-4 w-4" />
                Explore CareerBooster
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative border-t border-white/[0.07] bg-[#040a10] px-4 pb-8 pt-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-b border-white/[0.07] pb-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="https://res.cloudinary.com/dlkovvlud/image/upload/w_200,c_fill,ar_1:1,g_auto,r_max,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg"
                  alt="PrimoBoost AI"
                  className="h-10 w-10 rounded-xl object-cover"
                />
                <div className="text-lg font-semibold text-white">PrimoBoost AI</div>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                A modern career platform for clearer resume decisions, stronger applications and better preparation.
              </p>
              <div className="mt-5 flex gap-2">
                {[
                  { icon: Linkedin, label: 'LinkedIn' },
                  { icon: Mail, label: 'Email' },
                ].map((social) => (
                  <button key={social.label} type="button" aria-label={social.label} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500 transition hover:text-emerald-200">
                    <social.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {[
              {
                title: 'Platform',
                links: [
                  ['ATS Score Checker', '/score-checker'],
                  ['Resume Optimizer', '/optimizer'],
                  ['AI Job Search', '/jobs'],
                  ['Interview Prep', '/mock-interview'],
                ],
              },
              {
                title: 'Career',
                links: [
                  ['CareerBooster', '/session'],
                  ['Professional Referrals', '/referrals'],
                  ['Latest Jobs', '/jobs'],
                  ['Pricing', '/pricing'],
                ],
              },
              {
                title: 'Company',
                links: [
                  ['About', '/about'],
                  ['Success resources', '/blog'],
                  ['FAQ', '/faq'],
                  ['Contact', '/contact'],
                ],
              },
            ].map((group) => (
              <div key={group.title}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{group.title}</div>
                <div className="mt-4 space-y-3">
                  {group.links.map(([label, path]) => (
                    <button key={label} type="button" onClick={() => navigate(path)} className="block text-left text-sm text-slate-500 transition hover:text-emerald-200">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 pt-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} PrimoBoost AI. All rights reserved.</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <button type="button" onClick={() => navigate('/privacy-policy')} className="transition hover:text-slate-300">Privacy</button>
              <button type="button" onClick={() => navigate('/terms-and-conditions')} className="transition hover:text-slate-300">Terms</button>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3 w-3" /> Secure platform</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};
