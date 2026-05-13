"use client";

import React from "react";
import { motion } from "framer-motion";

interface BIWidgetProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  color: "indigo" | "emerald" | "amber" | "rose" | "blue" | "violet";
  className?: string;
}

const colorMap = {
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/20", icon: "bg-indigo-100 dark:bg-indigo-800", text: "text-indigo-600 dark:text-indigo-400" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "bg-emerald-100 dark:bg-emerald-800", text: "text-emerald-600 dark:text-emerald-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/20", icon: "bg-amber-100 dark:bg-amber-800", text: "text-amber-600 dark:text-amber-400" },
  rose: { bg: "bg-rose-50 dark:bg-rose-900/20", icon: "bg-rose-100 dark:bg-rose-800", text: "text-rose-600 dark:text-rose-400" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", icon: "bg-blue-100 dark:bg-blue-800", text: "text-blue-600 dark:text-blue-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-900/20", icon: "bg-violet-100 dark:bg-violet-800", text: "text-violet-600 dark:text-violet-400" },
};

export function BIWidget({ title, value, subtitle, icon, trend, color, className = "" }: BIWidgetProps) {
  const styles = colorMap[color];

  return (
    <motion.div 
      className={`relative overflow-hidden p-8 rounded-[2.5rem] bg-surface border border-border-subtle transition-all shadow-nm-flat hover-nm-elevated ${className}`}
    >
      <div className="flex items-center justify-between mb-6 relative">
        <div className={`w-14 h-14 rounded-2xl ${styles.icon} ${styles.text} flex items-center justify-center text-2xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05)]`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {trend && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow-sm text-[10px] font-black uppercase tracking-widest ${trend.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            <i className={`fa-solid ${trend.isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
            {trend.value}%
          </div>
        )}
      </div>

      <div className="relative space-y-1">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">{title}</h3>
        <p className={`text-4xl font-black tracking-tighter ${styles.text}`}>{value}</p>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-3 uppercase tracking-widest">{subtitle}</p>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
         <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Analytics Real-time</span>
         <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-1.5 h-4 rounded-full ${i === 4 ? 'bg-slate-200 dark:bg-slate-800' : styles.icon} opacity-60`}></div>
            ))}
         </div>
      </div>
    </motion.div>
  );
}
