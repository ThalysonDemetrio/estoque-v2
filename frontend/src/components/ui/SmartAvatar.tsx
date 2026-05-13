"use client";

import React from "react";
import Image from "next/image";

interface SmartAvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  type?: "person" | "item";
  status?: "online" | "offline" | "available" | "in_use" | "maintenance" | "disposal";
  className?: string;
}

export function SmartAvatar({ 
  src, 
  name = "N/A", 
  size = "md", 
  type = "person",
  status,
  className = "" 
}: SmartAvatarProps) {
  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
    "2xl": "w-32 h-32 text-4xl",
    full: "w-full h-full text-5xl",
  };

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getColor = (n: string) => {
    const colors = [
      "bg-blue-500", "bg-emerald-500", "bg-indigo-500", 
      "bg-amber-500", "bg-rose-500", "bg-violet-500",
      "bg-cyan-500", "bg-orange-500"
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
        hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const statusColors = {
    online: "bg-emerald-500",
    offline: "bg-slate-400",
    available: "bg-emerald-500",
    in_use: "bg-blue-500",
    maintenance: "bg-amber-500",
    disposal: "bg-red-500",
  };

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center overflow-hidden font-black text-white shadow-sm transition-transform hover:scale-105 ${!src ? getColor(name) : "bg-surface-soft"}`}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            width={128}
            height={128}
            className="w-full h-full object-cover"
            unoptimized={src.startsWith('data:')}
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      
      {status && (
        <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-surface rounded-full shadow-sm z-10 ${statusColors[status]}`} />
      )}
      
      {type === "item" && !src && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
           <i className="fa-solid fa-microchip text-[40%]"></i>
        </div>
      )}
    </div>
  );
}
