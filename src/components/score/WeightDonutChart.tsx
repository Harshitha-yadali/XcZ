import React from 'react';
import { motion } from 'framer-motion';
import type { CategoryScore } from '../../services/premiumScoreEngine';

interface WeightDonutChartProps {
  categories: CategoryScore[];
}

const COLORS = [
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
  '#f472b6', '#fb923c', '#fbbf24', '#4ade80',
];

export const WeightDonutChart: React.FC<WeightDonutChartProps> = ({ categories }) => {
  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);
  let currentAngle = 0;

  const segments = categories.map((cat, i) => {
    const angle = (cat.weight / totalWeight) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...cat, startAngle, angle, color: COLORS[i % COLORS.length] };
  });

  const polarToCartesian = (cx: number, cy: number, r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden"
    >
      <div className="p-5 border-b border-slate-700/40">
        <h3 className="text-lg font-semibold text-slate-100">Weight Distribution</h3>
      </div>
      <div className="p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-40 h-40">
              {segments.map((seg, i) => {
                const endAngle = seg.startAngle + Math.max(seg.angle - 1, 0.5);
                return (
                  <motion.path
                    key={seg.id}
                    d={describeArc(60, 60, 45, seg.startAngle, endAngle)}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-200">{totalWeight}%</div>
                <div className="text-[10px] text-slate-500">total</div>
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            {segments.map(seg => (
              <div key={seg.id} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-xs text-slate-400 truncate flex-1">{seg.name}</span>
                <span className="text-xs font-medium text-slate-300 flex-shrink-0">{seg.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
