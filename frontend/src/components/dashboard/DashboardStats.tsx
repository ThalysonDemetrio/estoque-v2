"use client";

import { motion } from "framer-motion";

interface StatItem {
  label: string;
  value: number;
  color: string;
  icon: string;
}

export function DashboardStats({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
      {stats.map((s, idx) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 260, 
            damping: 20, 
            delay: idx * 0.05 
          }}
          className="bg-surface border border-border-subtle rounded-[2.5rem] p-6 flex flex-col gap-5 group shadow-nm-flat hover-nm-elevated transition-all"
        >
          {/* Sunken Icon Area */}
          <div className="w-12 h-12 rounded-2xl bg-surface-soft flex items-center justify-center shadow-nm-inset group-hover:bg-brand/10 transition-colors"
          >
            <i className={`fa-solid ${s.icon} ${s.color} text-base transition-transform group-hover:scale-110`}></i>
          </div>
          
          <div className="flex flex-col">
            <motion.p 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`text-3xl font-black ${s.color} tracking-tighter leading-none`}
            >
              {s.value}
            </motion.p>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted mt-2 leading-tight">
              {s.label}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
