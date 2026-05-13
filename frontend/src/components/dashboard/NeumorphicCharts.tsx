"use client";

import React, { useId, useMemo } from "react";
import { motion } from "framer-motion";

interface NeumorphicProgressBarProps {
  percentage: number;
  label?: string;
  value?: string | number;
  color?: string;
  className?: string;
}

export function NeumorphicProgressBar({
  percentage,
  label,
  value,
  color = "bg-indigo-500",
  className = "",
}: NeumorphicProgressBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {(label || value !== undefined) && (
        <div className="flex justify-between items-end mb-1 px-1">
          {label && (
            <span className="text-[10px] font-black text-muted uppercase tracking-widest truncate max-w-[70%]">
              {label}
            </span>
          )}
          {value !== undefined && (
            <span className="text-[10px] font-black text-brand tabular-nums">
              {value}
            </span>
          )}
        </div>
      )}
      
      {/* Sunken Track */}
      <div 
        className="h-3.5 w-full rounded-full bg-surface-soft overflow-hidden relative shadow-nm-inset"
      >
        {/* Raised Indicator Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, Number(percentage) || 0))}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={`h-full rounded-full ${color} shadow-[2px_0px_5px_rgba(0,0,0,0.1)]`}
        />
      </div>
    </div>
  );
}

interface NeumorphicDonutProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showPercentage?: boolean;
  centerLabel?: string | number;
  className?: string;
  textColor?: string;
}

export function NeumorphicDonut({
  percentage,
  size = 140,
  strokeWidth = 12,
  color = "#3B5EFF",
  label,
  showPercentage = true,
  centerLabel,
  className = "",
  textColor = "text-strong",
}: NeumorphicDonutProps) {
  const center = size / 2;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        
        {/* Decorative Concentric Arcs */}
        <circle
          cx={center}
          cy={center}
          r={radius + strokeWidth + 4}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-border-subtle opacity-50"
          strokeDasharray="4 8"
        />
        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth - 4}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border-subtle opacity-30"
        />

        {/* Progress Arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: isNaN(offset) ? circumference : offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(59,94,255,0.3)]"
        />
      </svg>

      {/* Center Sunken Area */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: size * 0.15 }}>
        <div 
          className="w-full h-full rounded-full flex flex-col items-center justify-center bg-surface-soft shadow-nm-inset"
        >
          {centerLabel !== undefined ? (
            <span className={`font-black tracking-tighter ${textColor}`} style={{ fontSize: size < 80 ? size * 0.22 : "1.25rem" }}>
              {centerLabel}
            </span>
          ) : showPercentage && (
            <span className={`font-black tracking-tighter ${textColor}`} style={{ fontSize: size < 80 ? size * 0.22 : "1.25rem" }}>
              {percentage}%
            </span>
          )}
          {label && size > 120 && (
            <span className="text-[8px] font-black text-muted uppercase tracking-widest mt-0.5">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export interface NeumorphicMultiDonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface NeumorphicMultiDonutProps {
  segments: NeumorphicMultiDonutSegment[];
  size?: number;
  strokeWidth?: number;
  className?: string;
  showCenterPercentage?: boolean;
}

export function NeumorphicMultiDonut({
  segments,
  size = 140,
  strokeWidth = 12,
  className = "",
  showCenterPercentage = false,
}: NeumorphicMultiDonutProps) {
  const center = size / 2;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((acc, s) => acc + s.value, 0);

  // No specific sorting here to allow user-defined order if needed, 
  // but usually sorted by value looks best.
  
  let accumulatedLength = 0;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
          className="opacity-10 dark:opacity-20"
        />
        
        {segments.map((segment, idx) => {
          const segmentPercentage = total > 0 ? (segment.value / total) : 0;
          const segmentLength = segmentPercentage * circumference;
          
          // Using negative dashoffset to "push" the start of the dash forward
          const strokeDashoffset = -accumulatedLength;
          accumulatedLength += segmentLength;

          if (segmentPercentage <= 0.005) return null; // 0.5% threshold

          return (
            <motion.circle
              key={segment.label + idx}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt" 
              className="drop-shadow-[0_0_4px_rgba(0,0,0,0.1)]"
            />
          );
        })}
      </svg>

      {showCenterPercentage && total > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center p-4">
             <span className="text-xl font-black text-strong tracking-tighter">
               100%
             </span>
             <span className="text-[8px] font-black text-muted uppercase tracking-widest mt-0.5">
               Total
             </span>
           </div>
        </div>
      )}
    </div>
  );
}

interface NeumorphicContainerProps {
  children: React.ReactNode;
  title?: string;
  icon?: string;
  className?: string;
  extra?: React.ReactNode;
}

export function NeumorphicContainer({ children, title, icon, className = "", extra }: NeumorphicContainerProps) {
  return (
    <div 
      className={`bg-surface rounded-[2.5rem] p-6 shadow-nm-flat hover-nm-elevated border border-border-subtle transition-all ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-strong flex items-center gap-3 uppercase tracking-widest">
            {icon && <i className={`fa-solid ${icon} text-brand`}></i>}
            {title}
          </h3>
          {extra && <div className="flex items-center">{extra}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface NeumorphicBarProps {
  label: string;
  subLabel?: string;
  value: string | number;
  percentage: number;
  color?: string;
  className?: string;
}

export function NeumorphicBar({ 
  label, 
  subLabel, 
  value, 
  percentage, 
  color = "#4f46e5", 
  className = "" 
}: NeumorphicBarProps) {
  return (
    <div className={`group flex flex-col gap-2 ${className}`}>
      <div className="flex justify-between items-end px-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
            {label}
          </span>
          {subLabel && (
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate opacity-70">
              {subLabel}
            </span>
          )}
        </div>
        <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
          {value}
        </span>
      </div>
      
      {/* Sunken Outer Track */}
      <div 
        className="h-5 w-full rounded-2xl bg-surface-soft overflow-hidden relative p-[3px] shadow-nm-inset"
      >
        {/* Soft Raised Inner Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, Number(percentage) || 0))}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ backgroundColor: color }}
          className="h-full rounded-xl shadow-[2px_2px_4px_rgba(0,0,0,0.15)] relative overflow-hidden"
        >
          {/* Subtle highlight glare for Neumorphic depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50"></div>
        </motion.div>
      </div>
    </div>
  );
}
interface NeumorphicStackedBarSegment {
  label: string;
  value: number;
  color: string;
}

interface NeumorphicStackedBarProps {
  label: string;
  segments: NeumorphicStackedBarSegment[];
  total: number;
  maxTotal: number;
  className?: string;
}

export function NeumorphicStackedBar({ 
  label, 
  segments, 
  total, 
  maxTotal,
  className = "" 
}: NeumorphicStackedBarProps) {
  const containerWidthPercent = (total / maxTotal) * 100;

  return (
    <div className={`group flex flex-col gap-2 ${className}`}>
      <div className="flex justify-between items-end px-2">
        <span className="text-[10px] font-black text-muted uppercase tracking-widest truncate">
          {label}
        </span>
        <span className="text-[11px] font-black text-strong tabular-nums">
          {total}
        </span>
      </div>
      
      {/* Sunken Outer Track */}
      <div 
        className="h-5 w-full rounded-2xl bg-surface-soft overflow-hidden relative p-[3px] shadow-nm-inset"
      >
        {/* Container that scales based on total proportion to max */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${containerWidthPercent}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="h-full flex rounded-xl overflow-hidden shadow-[2px_2px_4px_rgba(0,0,0,0.15)]"
        >
          {segments.map((segment, idx) => {
            const segmentWidth = total > 0 ? (segment.value / total) * 100 : 0;
            if (segmentWidth <= 0) return null;
            
            return (
              <div 
                key={segment.label}
                style={{ width: `${segmentWidth}%`, backgroundColor: segment.color }}
                className="h-full relative overflow-hidden group/seg"
                title={`${segment.label}: ${segment.value}`}
              >
                {/* Subtle highlight glare */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-40"></div>
                {/* Visual separator between segments */}
                {idx < segments.length - 1 && (
                   <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-black/10"></div>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
interface NeumorphicAreaChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  className?: string;
  valuePrefix?: string;
  showDots?: boolean;
}

export function NeumorphicAreaChart({
  data,
  height = 240,
  color = "#4f46e5",
  className = "",
  valuePrefix = "R$ ",
  showDots = true,
}: NeumorphicAreaChartProps) {
  const chartId = useId();
  const gradientId = `gradient-${chartId.replace(/:/g, '')}`;
  const glowId = `glow-${chartId.replace(/:/g, '')}`;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const width = 900;
  const padX = 50;
  const padTop = 40;
  const padBottom = 40;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((d: any, i: number) => {
      const x = padX + (i / Math.max(1, data.length - 1)) * innerW;
      const val = typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0;
      const y = padTop + innerH - (val / Math.max(1, maxVal)) * innerH;
      
      // Safety check for NaN or Infinity
      if (isNaN(x) || isNaN(y)) return { x: 0, y: 0, ...d, invalid: true };
      
      return { x, y, ...d, invalid: false };
    }).filter(p => !p.invalid);
  }, [data, padX, innerW, padTop, innerH, maxVal]);

  const linePath = useMemo(() => {
    if (!points || points.length < 2) return "";
    
    // Final defensive check to ensure no "undefined" string gets into the path
    const pathStr = points.map((p: any, i: number) => {
      const x = Number.isFinite(p.x) ? p.x.toFixed(2) : null;
      const y = Number.isFinite(p.y) ? p.y.toFixed(2) : null;
      
      if (x === null || y === null) return "";
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).filter(Boolean).join(" ");
    
    // If the first element wasn't an 'M' because it was filtered, 
    // or if the path doesn't start with M/m, it's invalid
    if (!pathStr.startsWith('M') && !pathStr.startsWith('m')) return "";
    
    return pathStr;
  }, [points]);

  const areaPath = useMemo(() => {
    if (!points || points.length < 2 || !linePath) return "";
    const firstX = points[0].x.toFixed(2);
    const lastX = points[points.length - 1].x.toFixed(2);
    const bottomY = (padTop + innerH).toFixed(2);
    
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [points, linePath, padTop, innerH]);

  if (data.length === 0) return null;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {/* Sunken Background Track - Transparent bg with inset shadows for depth */}
      <div 
        className="rounded-[2rem] bg-transparent overflow-hidden relative p-2 shadow-nm-inset-lg"
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-sm">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
               <feGaussianBlur stdDeviation="3" result="blur" />
               <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Lines (Subtle) */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const y = padTop + innerH * p;
            return (
              <line 
                key={p} 
                x1={padX} 
                y1={y} 
                x2={width - padX} 
                y2={y} 
                stroke="var(--border-subtle)" 
                strokeWidth="0.5" 
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area Fill */}
          {areaPath && areaPath !== "undefined" && (
            <motion.path
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              d={areaPath}
              fill={`url(#${gradientId})`}
            />
          )}

          {/* Main Line */}
          {linePath && linePath !== "undefined" && (
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
            />
          )}

          {/* Dots and Labels */}
          {points.map((p: any, idx: number) => (
            <g key={idx} className="group/dot">
              {showDots && (
                <>
                  <circle 
                    cx={p.x} cy={p.y} r="8" 
                    fill="var(--surface)" 
                    className="shadow-sm"
                  />
                  <circle 
                    cx={p.x} cy={p.y} r="4" 
                    fill={color} 
                  />
                </>
              )}
              
              {/* Value Label with Background Box */}
              <g>
                <motion.rect
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  x={p.x - 22}
                  y={p.y - 30}
                  width={44}
                  height={18}
                  rx={9}
                  fill={color}
                  className="shadow-lg"
                  style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.2))" }}
                />
                <text
                  x={p.x}
                  y={p.y - 17}
                  textAnchor="middle"
                  className="fill-white font-black text-[9px] uppercase tracking-tighter"
                >
                  {valuePrefix}{p.value.toLocaleString('pt-BR')}
                </text>
              </g>

              {/* X Axis Label */}
              <text
                x={p.x}
                y={height - 15}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-black text-[9px] uppercase tracking-widest"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
