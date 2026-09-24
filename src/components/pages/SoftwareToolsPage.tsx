import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ExternalLink, Package } from 'lucide-react';
import { softwareToolsService, isHttpUrl, type SoftwareTool } from '../../services/softwareToolsService';

export const SoftwareToolsPage: React.FC = () => {
  const [tools, setTools] = useState<SoftwareTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    softwareToolsService
      .getTools()
      .then((data) => setTools(data.filter((tool) => tool.is_active)))
      .catch((error) => console.error('Error loading software tools:', error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
            <Package className="w-4 h-4" />
            <span>Software Tools</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Premium Tools for Your Job Search
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            Get LinkedIn Premium and other career software at discounted prices.
          </p>
        </motion.div>

        {tools.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No tools available right now.</p>
            <p className="text-slate-500 text-sm mt-1">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.04 }}
                className="flex flex-col bg-gradient-to-br from-surface to-surface-sunken border border-slate-700/50 rounded-2xl p-5 sm:p-6 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  {tool.image_url ? (
                    <img
                      src={tool.image_url}
                      alt={tool.name}
                      className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1.5 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-lg">{tool.name}</h3>
                    {tool.duration && (
                      <span className="inline-flex items-center gap-1 text-slate-400 text-xs mt-1">
                        <Clock className="w-3 h-3" />
                        {tool.duration}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap flex-1 mb-4">
                  {tool.description}
                </p>

                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-700/40">
                  <div>
                    <p className="text-white font-bold text-xl">{`₹${Number(tool.price)}`}</p>
                    {tool.original_price != null && Number(tool.original_price) > Number(tool.price) && (
                      <p className="text-slate-500 text-xs line-through">{`₹${Number(tool.original_price)}`}</p>
                    )}
                  </div>
                  {isHttpUrl(tool.buy_url) && (
                    <a
                      href={tool.buy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Buy Now
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
