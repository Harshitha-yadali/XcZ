import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { useSEO } from '../../hooks/useSEO';
import { PageSidebar } from '../navigation/PageSidebar';
import { HeroSection } from '../home/HeroSection';
import { StatsSection } from '../home/StatsSection';
import { HowItWorks } from '../home/HowItWorks';
import { ServicesShowcase } from '../home/ServicesShowcase';
import { SessionHighlight } from '../home/SessionHighlight';
import { BeforeAfterSection } from '../home/BeforeAfterSection';
import { CompaniesMarquee } from '../home/CompaniesMarquee';
import { PlansSection } from '../home/PlansSection';
import { AITechSection } from '../home/AITechSection';
import { HomeFooter } from '../home/HomeFooter';

interface HomePageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowSubscriptionPlans: (featureId?: string, expandAddons?: boolean) => void;
  onShowSubscriptionPlansDirectly: () => void;
  userSubscription: any;
}

export const HomePage: React.FC<HomePageProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowSubscriptionPlans,
  onShowSubscriptionPlansDirectly,
  userSubscription,
}) => {
  useAuth();

  useSEO({
    title: 'PrimoBoost AI | Resume Optimizer, ATS Scoring, Expert Sessions & Job Updates',
    description:
      'Transform your career with AI-powered resume optimization, 16-parameter ATS scoring, 1:1 expert sessions, professional referrals, and curated job updates. Trusted by 50,000+ professionals.',
    keywords: 'ATS resume, ATS friendly resume, ATS resume builder, ATS resume checker, ATS resume score, ATS optimized resume, ATS resume format, ATS resume optimization tool, ATS resume AI tool, ATS resume scoring system, JD based resume, job description based resume, resume from job description, JD resume builder, JD resume optimization, JD resume matching, resume tailored to job description, resume keyword optimizer, resume keyword checker, resume keyword analysis, resume optimization tool, resume optimization AI, AI resume builder, resume score checker, professional resume builder, career optimization, PrimoBoost AI',
    canonical: '/',
    ogType: 'website',
  });

  const [globalResumesCreated, setGlobalResumesCreated] = useState<number>(60070);
  const [scoreChecksCompleted, setScoreChecksCompleted] = useState<number>(500070);

  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const isHeroInView = useInView(heroRef, { once: true, amount: 0.3 });

  useEffect(() => {
    const fetchGlobalCount = async () => {
      try {
        const count = await authService.getGlobalResumesCreatedCount();
        setGlobalResumesCreated(count);
      } catch (error) {
        console.error('HomePage: Error fetching global resumes count:', error);
      }
    };
    fetchGlobalCount();
  }, []);

  useEffect(() => {
    const base = 500070;
    const hydrateCount = () => {
      const stored = parseInt(localStorage.getItem('scoreCheckCount') || '0', 10);
      const safeStored = isNaN(stored) ? 0 : stored;
      setScoreChecksCompleted(base + safeStored);
    };
    hydrateCount();

    const handleScoreCheckEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ total?: number }>).detail;
      const total = typeof detail?.total === 'number' ? detail.total : null;
      if (total !== null) {
        setScoreChecksCompleted(base + total);
      } else {
        hydrateCount();
      }
    };

    window.addEventListener('score-check-completed', handleScoreCheckEvent);
    return () => window.removeEventListener('score-check-completed', handleScoreCheckEvent);
  }, []);

  return (
    <div
      className="relative min-h-screen text-slate-100 overflow-hidden bg-gradient-to-b from-[#02221E] to-[#042A24]"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <PageSidebar />

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-[#02221E]/50 via-[#042A24]/10 to-transparent" />
        <div className="absolute top-10 right-1/3 w-[900px] h-[520px] bg-[radial-gradient(circle_at_60%_40%,rgba(0,230,184,0.16),transparent_55%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[620px] h-[420px] bg-[radial-gradient(circle_at_80%_80%,rgba(0,210,131,0.18),transparent_55%)] blur-2xl" />
      </div>

      <div className="relative md:ml-16">
        <HeroSection
          heroRef={heroRef}
          isHeroInView={isHeroInView}
          globalResumesCreated={globalResumesCreated}
          onShowAuth={onShowAuth}
          isAuthenticated={isAuthenticated}
        />

        <StatsSection
          statsRef={statsRef}
          scoreChecksCompleted={scoreChecksCompleted}
          globalResumesCreated={globalResumesCreated}
        />

        <HowItWorks />

        <ServicesShowcase
          isAuthenticated={isAuthenticated}
          onShowAuth={onShowAuth}
        />

        <SessionHighlight
          isAuthenticated={isAuthenticated}
          onShowAuth={onShowAuth}
        />

        <BeforeAfterSection />

        <CompaniesMarquee />

        <PlansSection
          isAuthenticated={isAuthenticated}
          userSubscription={userSubscription}
          onShowSubscriptionPlans={onShowSubscriptionPlans}
          onShowSubscriptionPlansDirectly={onShowSubscriptionPlansDirectly}
        />

        <AITechSection />

        <HomeFooter />
      </div>
    </div>
  );
};
