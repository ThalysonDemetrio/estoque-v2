"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "@/contexts/LoadingContext";

export default function LoadingRocket() {
  const { isLoading, loadingMessage } = useLoading();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-8 text-center p-12">
            
            {/* Launchpad Circle */}
            <div className="relative w-40 h-40 rounded-full bg-slate-900 shadow-[inset_0_0_30px_rgba(59,130,246,0.2)] border border-blue-500/20 flex items-center justify-center overflow-hidden">
              
              {/* Atmospheric Glow */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.4, 0.2] 
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-4 rounded-full bg-blue-500/10 blur-xl"
              />

              {/* Rocket Container */}
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ 
                    y: [-80, -120], 
                    opacity: [0, 1, 1, 0] 
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeIn",
                    times: [0, 0.2, 0.8, 1]
                  }}
                  className="flex flex-col items-center"
                >
                  {/* Rocket Icon */}
                  <i className="fa-solid fa-rocket text-blue-500 text-5xl drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] transform -rotate-45" />
                  
                  {/* Engine Flame */}
                  <motion.div
                    animate={{ 
                      scaleY: [1, 1.5, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 0.1, repeat: Infinity }}
                    className="w-4 h-8 bg-gradient-to-b from-blue-400 to-transparent blur-[2px] mt-1 -translate-y-2 origin-top"
                  />
                </motion.div>
              </div>
            </div>

            {/* Status Message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-blue-500 text-lg font-black uppercase tracking-[0.3em] mb-2 animate-pulse">
                Processando
              </h3>
              {loadingMessage && (
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">
                  {loadingMessage}
                </p>
              )}
            </motion.div>

            {/* Orbiting Particles */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute w-48 h-48 pointer-events-none"
            >
              <div className="absolute top-0 left-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
