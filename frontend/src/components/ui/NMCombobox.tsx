"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface NMComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
}

interface NMComboboxProps {
  options: NMComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function NMCombobox({
  options,
  value,
  onChange,
  placeholder = "Pesquisar...",
  label,
  required,
  disabled,
  className = "",
}: NMComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Encontrar o label do valor atual para exibir no input quando não estiver focado
  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

  // Filtrar opções baseadas na busca
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(s) || opt.sublabel?.toLowerCase().includes(s)
    );
  }, [options, search]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quando o valor muda externamente, ou quando selecionamos, limpamos a busca se fechado
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative group">
        <div className={`relative flex items-center transition-all duration-300 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
          <i className="fa-solid fa-magnifying-glass absolute left-4 text-muted/50 text-[10px] pointer-events-none group-focus-within:text-brand transition-colors"></i>
          
          <input
            type="text"
            className="w-full pl-10 pr-10 py-2.5 bg-surface-soft border-none rounded-2xl text-sm font-bold text-main placeholder-subtle/50 focus:outline-none focus:ring-4 focus:ring-brand/10 shadow-nm-inset transition-all"
            placeholder={selectedOption ? selectedOption.label : placeholder}
            value={isOpen ? search : ""}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            autoComplete="off"
          />

          {!isOpen && selectedOption && (
             <div className="absolute left-10 right-10 pointer-events-none truncate text-sm font-bold text-strong">
                {selectedOption.label}
             </div>
          )}

          <div className="absolute right-3 flex items-center gap-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
                className="p-1.5 text-muted hover:text-red-500 transition-colors"
                title="Limpar seleção"
              >
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            )}
            <i className={`fa-solid fa-chevron-down text-[10px] text-muted/50 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}></i>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute z-[110] left-0 right-0 max-h-[280px] bg-surface border border-border-subtle rounded-2xl shadow-2xl shadow-black/10 overflow-hidden flex flex-col"
            >
              <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                        opt.value === value ? "bg-brand/5 text-brand" : "hover:bg-surface-soft text-main"
                      }`}
                    >
                      {opt.icon && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${opt.value === value ? "bg-brand text-white" : "bg-surface-soft text-muted border border-border-subtle"}`}>
                          <i className={`fa-solid ${opt.icon} text-xs`}></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black uppercase tracking-tighter truncate ${opt.value === value ? "text-brand" : "text-strong"}`}>
                          {opt.label}
                        </p>
                        {opt.sublabel && (
                          <p className="text-[10px] font-medium text-muted truncate">
                            {opt.sublabel}
                          </p>
                        )}
                      </div>
                      {opt.value === value && <i className="fa-solid fa-check text-xs text-brand"></i>}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <i className="fa-solid fa-ghost text-muted/20 text-2xl mb-2 block"></i>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Nenhum resultado</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
