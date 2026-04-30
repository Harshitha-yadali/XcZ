import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';

export function NotFoundPage() {
  const navigate = useNavigate();

  useSEO({ title: 'Page Not Found', noIndex: true });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#05131A] text-white px-4">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-[#00C6FF] mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-3">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-lg border border-[#00C6FF] text-[#00C6FF] hover:bg-[#00C6FF]/10 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-lg bg-[#00C6FF] text-[#05131A] font-semibold hover:bg-[#00b3e6] transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
