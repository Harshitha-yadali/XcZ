import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import { isPayingSubscription, shouldShowAd } from './adRules';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() || undefined;

// Once per session: user id -> paying? (promise shared by all slots on the page)
let payingCache: { userId: string; promise: Promise<boolean> } | null = null;
function getPaying(userId: string): Promise<boolean> {
  if (payingCache?.userId !== userId) {
    payingCache = {
      userId,
      // On error assume paying, so a paying customer never sees ads by mistake.
      promise: paymentService.getUserSubscription(userId).then(isPayingSubscription, () => true),
    };
  }
  return payingCache.promise;
}

let scriptLoaded = false;
function loadAdSenseScript(client: string) {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

interface AdSlotProps {
  slot?: string;
  className?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({ slot, className = '' }) => {
  const { pathname } = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [paying, setPaying] = useState<boolean | undefined>(undefined);
  const [near, setNear] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || isLoading) return;
    if (!isAuthenticated || !user) {
      setPaying(false);
      return;
    }
    let alive = true;
    setPaying(undefined);
    getPaying(user.id).then((p) => alive && setPaying(p));
    return () => {
      alive = false;
    };
  }, [isLoading, isAuthenticated, user]);

  const show = shouldShowAd({ client: CLIENT, pathname, paying });

  // Lazy: wait until the slot is near the viewport.
  useEffect(() => {
    if (!show || near || !boxRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [show, near]);

  useEffect(() => {
    if (!show || !near || pushed.current || !CLIENT) return;
    try {
      loadAdSenseScript(CLIENT);
      pushed.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('AdSlot: adsbygoogle push failed', e);
    }
  }, [show, near]);

  if (!show) return null;

  return (
    <div
      ref={boxRef}
      className={`w-full max-w-full overflow-hidden rounded-xl border border-slate-700/40 bg-slate-900/40 p-2 ${className}`}
    >
      <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-slate-500">Advertisement</p>
      <div className="min-h-[250px] sm:min-h-[120px]">
        {near && (
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={CLIENT}
            {...(slot ? { 'data-ad-slot': slot } : {})}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    </div>
  );
};

export default AdSlot;
