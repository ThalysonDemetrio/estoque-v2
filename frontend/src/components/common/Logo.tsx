"use client";

import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 32 }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Hexagon representing Infrastructure/Network */}
      <path 
        d="M20 4L33.8564 12V28L20 36L6.14359 28V12L20 4Z" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Central Connectivity and Management Hub */}
      <circle cx="20" cy="20" r="4" fill="currentColor" className="text-blue-500" />
      
      {/* Network Nodes on vertices */}
      <circle cx="20" cy="4" r="2" fill="currentColor" />
      <circle cx="33.8564" cy="12" r="2" fill="currentColor" />
      <circle cx="33.8564" cy="28" r="2" fill="currentColor" />
      <circle cx="20" cy="36" r="2" fill="currentColor" />
      <circle cx="6.14359" cy="28" r="2" fill="currentColor" />
      <circle cx="6.14359" cy="12" r="2" fill="currentColor" />
      
      {/* Inner management grid lines (Inventory) */}
      <path 
        d="M20 10V16M20 24V30M11 15L16.5 18M23.5 22L29 25M11 25L16.5 22M23.5 18L29 15" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeOpacity="0.4" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
