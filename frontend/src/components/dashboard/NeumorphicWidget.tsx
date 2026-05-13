"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import React, { useEffect } from "react";

interface NeumorphicWidgetProps {
  title: string;
  value: string;
  numericValue?: number;
  percentage: number;
  trend?: {
    value: number;
    isUp: boolean;
  };
  labels?: {
    name: string;
    color: string;
  }[];
  rings?: {
    percentage: number;
    color: string;
  }[];
  percentageLabel?: string;
  trendLabel?: string;
  className?: string;
}

function AnimatedValue({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(latest);
  });

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1], // easeOutQuart
    });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
}

export function NeumorphicWidget({
  title,
  value,
  numericValue,
  percentage,
  trend,
  labels,
  rings,
  percentageLabel,
  trendLabel,
  className = "",
}: NeumorphicWidgetProps) {
  // SVG Constants
  const size = 180;
  const center = size / 2;
  const strokeWidth = 14;
  const gap = 6;
  
  // If no rings provided, create a default one based on percentage
  const displayRings = rings || [
    { percentage, color: "#3B5EFF" } // Default Blue
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-surface rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-nm-flat hover-nm-elevated transition-all border border-border-subtle ${className}`}
    >
      {/* Left Content */}
      <div className="flex-1 space-y-2 text-center md:text-left pl-2">
        <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">
          {title}
        </h4>
        
        <div className="space-y-1">
          <div className="text-5xl font-black text-strong tracking-tighter">
            {numericValue !== undefined ? (
              <AnimatedValue value={numericValue} />
            ) : (
              value
            )}
          </div>
          {trend && (
            <div className={`flex items-center justify-center md:justify-start gap-1.5 text-sm font-bold ${trend.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              <i className={`fa-solid ${trend.isUp ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
              <span className="opacity-90">{trend.value}%</span>
              {trendLabel && (
                <span className="text-[9px] font-black uppercase text-muted tracking-widest pl-1">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {labels && labels.length > 0 && (
          <div className="pt-4 space-y-2">
            {labels.map((L, i) => (
              <div key={i} className="flex items-center gap-2.5 group">
                <div className={`w-3 h-3 rounded-full shadow-inner ${L.color} group-hover:scale-110 transition-transform`}></div>
                <span className="text-[10px] font-black text-muted uppercase tracking-widest leading-none">
                  {L.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Content: Donut Chart */}
      <div className="relative w-[180px] h-[180px] shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {displayRings.map((ring, idx) => {
            const r = (size - strokeWidth) / 2 - (idx * (strokeWidth + gap));
            const circum = 2 * Math.PI * r;
            const offset = circum - (ring.percentage / 100) * circum;
            
            return (
              <React.Fragment key={idx}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={strokeWidth}
                  className="dark:stroke-slate-800/40"
                />
                {/* Percentage Arc */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circum}
                  initial={{ strokeDashoffset: circum }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 + (idx * 0.2) }}
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })}
        </svg>

        {/* Central Pressed Circle */}
        <div className="absolute inset-0 flex items-center justify-center p-14">
          <div 
            className="w-full h-full rounded-full flex flex-col items-center justify-center bg-[var(--nm-bg)] 
              shadow-[inset_4px_4px_8px_var(--nm-inset-dark),inset_-4px_-4px_8px_var(--nm-inset-light)] text-center px-2"
          >
            <span className="text-2xl font-black text-main tracking-tighter leading-none">
              {percentage}%
            </span>
            {percentageLabel && (
              <span className="text-[8px] font-black text-muted uppercase tracking-tighter mt-1 opacity-80 leading-tight">
                {percentageLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
