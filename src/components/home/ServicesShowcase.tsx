import React from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  TrendingUp,
  UserCheck,
  Calendar,
  Users,
  Briefcase,
  ArrowRight,
  Check,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ServicesShowcaseProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  tag?: string;
  tagColor: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  path: string;
  cta: string;
  requiresAuth?: boolean;
}

export const ServicesShowcase: React.FC<ServicesShowcaseProps> = ({
  isAuthenticated,
  onShowAuth,
}) => {
  const navigate = useNavigate();

  const aiTools: ServiceCard[] = [
    {
      id: 'optimizer',
      title: 'JD-Based Resume Optimizer',
      description:
        'Upload your resume and paste any job description. Our AI tailors every section, reorders content, and inserts missing keywords for maximum ATS compatibility.',
      icon: <Target className="w-6 h-6" />,
      features: ['Section reordering', 'Keyword injection', 'ATS-optimized formatting'],
      tag: 'Most Popular',
      tagColor: 'bg-emerald-600 text-emerald-50',
      accent: 'emerald',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
      path: '/optimizer',
      cta: 'Optimize Now',
    },
    {
      id: 'score-checker',
      title: 'Resume Score Checker',
      description:
        'Get an instant ATS score with our 16-parameter analysis. See exactly where your resume stands and what to fix before applying.',
      icon: <TrendingUp className="w-6 h-6" />,
      features: ['16-parameter analysis', 'Instant scoring', 'Detailed improvement tips'],
      tag: 'Free to Try',
      tagColor: 'bg-cyan-600 text-cyan-50',
      accent: 'cyan',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/20 hover:border-cyan-500/40',
      path: '/score-checker',
      cta: 'Check My Score',
    },
    {
      id: 'profile-review',
      title: 'Why You\'re Not Getting Shortlisted',
      description:
        'AI-powered profile analysis that identifies exactly why your applications are being rejected. Get actionable insights on skills gaps, formatting issues, and missing qualifications.',
      icon: <UserCheck className="w-6 h-6" />,
      features: ['Gap analysis', 'Skills assessment', 'Rejection pattern insights'],
      tag: 'New',
      tagColor: 'bg-amber-600 text-amber-50',
      accent: 'amber',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/20 hover:border-amber-500/40',
      path: '/score-checker',
      cta: 'Analyze My Profile',
    },
  ];

  const expertServices: ServiceCard[] = [
    {
      id: 'session',
      title: '1-Hour Expert Session',
      description:
        'Book a live 1:1 session with career experts. Get all your doubts cleared -- resume review, interview strategy, career path guidance, and everything in between.',
      icon: <Calendar className="w-6 h-6" />,
      features: ['Live 1:1 mentoring', 'Resume deep-dive', 'Career strategy'],
      tag: 'Live Session',
      tagColor: 'bg-teal-600 text-teal-50',
      accent: 'teal',
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-400',
      borderColor: 'border-teal-500/20 hover:border-teal-500/40',
      path: '/session',
      cta: 'Book Session',
      requiresAuth: true,
    },
    {
      id: 'referrals',
      title: 'Professional Referrals',
      description:
        'Get direct referrals to top companies through our network. Connect with professionals who can refer you for open positions at their organizations.',
      icon: <Users className="w-6 h-6" />,
      features: ['Company-based referrals', 'Direct connections', 'Verified professionals'],
      tag: 'Premium',
      tagColor: 'bg-sky-600 text-sky-50',
      accent: 'sky',
      iconBg: 'bg-sky-500/10',
      iconColor: 'text-sky-400',
      borderColor: 'border-sky-500/20 hover:border-sky-500/40',
      path: '/referrals',
      cta: 'Browse Referrals',
      requiresAuth: true,
    },
    {
      id: 'jobs',
      title: 'Latest Job Updates',
      description:
        'Stay ahead with curated job openings from top companies. Fresh listings updated regularly, tailored to your skills and preferences.',
      icon: <Briefcase className="w-6 h-6" />,
      features: ['Curated listings', 'Top companies', 'Daily updates'],
      accent: 'rose',
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-400',
      borderColor: 'border-rose-500/20 hover:border-rose-500/40',
      path: '/jobs',
      cta: 'View Jobs',
      tagColor: '',
    },
  ];

  const handleCardClick = (card: ServiceCard) => {
    if (card.requiresAuth && !isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate(card.path);
  };

  const renderCard = (card: ServiceCard) => (
    <motion.div
      key={card.id}
      variants={cardVariants}
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer"
      onClick={() => handleCardClick(card)}
    >
      <div
        className={`relative h-full rounded-2xl p-6 bg-[#0D1B2A]/80 border ${card.borderColor} backdrop-blur-sm transition-all duration-300 overflow-hidden`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {card.tag && (
          <div className="absolute -top-px right-6">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-b-lg text-xs font-bold ${card.tagColor}`}
            >
              {card.tag}
            </span>
          </div>
        )}

        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`w-12 h-12 rounded-xl ${card.iconBg} border border-white/10 flex items-center justify-center ${card.iconColor} flex-shrink-0 transition-transform group-hover:scale-110`}
            >
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors leading-snug">
                {card.title}
              </h3>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed mb-5">{card.description}</p>

          <div className="space-y-2 mb-5">
            {card.features.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">
              {card.cta}
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <section className="relative py-16 sm:py-24 bg-gradient-to-b from-transparent to-slate-950/50">
      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 space-y-3"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500 font-medium">
            What We Offer
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            Everything You Need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Get Hired
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-3xl mx-auto">
            Powerful AI tools paired with expert human guidance -- a complete career acceleration system
          </p>
        </motion.div>

        <div className="space-y-12">
          <div>
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">AI-Powered Tools</h3>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {aiTools.map(renderCard)}
            </motion.div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Expert Services</h3>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {expertServices.map(renderCard)}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
