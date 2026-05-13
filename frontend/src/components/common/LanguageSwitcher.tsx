"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const nextLang = i18n.language === "pt" ? "en" : "pt";
    i18n.changeLanguage(nextLang);
  };

  if (!mounted) {
    return (
      <div className="w-5 h-5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 animate-pulse" />
    );
  }

  const currentLang = i18n.language?.split("-")[0] || "pt";

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group"
      title={currentLang === "pt" ? "Switch to English" : "Mudar para Português"}
    >
      <div className="w-5 h-5 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 relative shrink-0">
        <motion.div
          key={currentLang}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-[10px] font-bold"
        >
          {currentLang.toUpperCase()}
        </motion.div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-500 transition-colors">
        {currentLang === "pt" ? "EN" : "PT"}
      </span>
    </button>
  );
}
