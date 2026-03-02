import React from 'react';
import { Instagram, Linkedin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WhatsappIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.11 17.37c-.26-.13-1.52-.75-1.75-.84-.23-.09-.4-.13-.57.13s-.66.84-.81 1.01c-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27-.76-.67-1.27-1.49-1.42-1.75-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.57-1.37-.78-1.88-.2-.48-.4-.41-.57-.42l-.49-.01c-.17 0-.45.06-.69.32-.23.26-.91.89-.91 2.17s.94 2.52 1.07 2.7c.13.17 1.85 2.83 4.49 3.97.63.27 1.12.43 1.5.55.63.2 1.21.17 1.66.1.51-.08 1.52-.62 1.73-1.21.21-.59.21-1.09.15-1.21-.06-.12-.24-.19-.5-.32z" />
    <path d="M26.72 5.28A13.5 13.5 0 0 0 4.47 21.06L3 29l8.11-1.42A13.49 13.49 0 1 0 26.72 5.28zM16.5 27A10.47 10.47 0 0 1 8.3 24.3l-.29-.18-4.91.85.84-4.8-.19-.31A10.5 10.5 0 1 1 16.5 27z" />
  </svg>
);

const quickLinks = [
  { label: 'Resume Optimizer', path: '/optimizer' },
  { label: 'Score Checker', path: '/score-checker' },
  { label: 'Book Session', path: '/session' },
  { label: 'Referrals', path: '/referrals' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Pricing', path: '/pricing' },
];

export const HomeFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="relative bg-[#020a0f] border-t border-slate-800/50">
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      <div className="container-responsive py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
              <img
                src="https://res.cloudinary.com/dlkovvlud/image/upload/w_200,c_fill,ar_1:1,g_auto,r_max,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg"
                alt="PrimoBoost AI"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-white tracking-wide">PrimoBoost AI</p>
              <p className="text-xs text-slate-500">Career Acceleration Platform</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {quickLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 justify-end">
            <a
              href="https://instagram.com/primoboostai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-700/60 text-slate-400 bg-slate-900/50 hover:text-white hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-200"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com/company/primoboost-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-700/60 text-slate-400 bg-slate-900/50 hover:text-white hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-200"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://wa.me/0000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-700/60 text-slate-400 bg-slate-900/50 hover:text-white hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-200"
              aria-label="WhatsApp"
            >
              <WhatsappIcon className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/40 text-center">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} PrimoBoost AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
