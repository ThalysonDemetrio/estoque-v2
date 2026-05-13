"use client";

import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

let activeSlidebarLocks = 0;

type SlidebarSize = "half" | "full" | "narrow" | "wide";
type SlidebarTone = "light" | "dark" | "custom";

interface SlidebarPanelProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  contentClassName?: string;
  size?: SlidebarSize;
  tone?: SlidebarTone;
  header?: ReactNode;
  footer?: ReactNode;
  headerClassName?: string;
  footerClassName?: string;
  onClose?: () => void;
  withAnimation?: boolean;
}

interface SlidebarHeaderProps {
  title: string;
  subtitle?: string;
  iconClassName?: string;
  iconClassExtra?: string;
  iconWrapClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  onClose?: () => void;
  closeLabel?: string;
  closeButtonClassName?: string;
  actions?: ReactNode;
  className?: string;
}

interface SlidebarFooterProps {
  children: ReactNode;
  className?: string;
}

const SIZE_CLASSES: Record<SlidebarSize, string> = {
  half: "w-full md:w-1/2",
  full: "w-full",
  narrow: "w-full md:w-[420px]",
  wide: "w-full md:w-[70%]",
};

const TONE_PANEL_CLASSES: Record<Exclude<SlidebarTone, "custom">, string> = {
  light: "bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800",
  dark: "bg-slate-950 text-white border-l border-white/10",
};

export function SlidebarPanel({
  isOpen,
  children,
  className = "z-[1100]",
  panelClassName,
  contentClassName = "flex-1 overflow-y-auto pb-24 md:pb-0",
  size = "half",
  tone = "light",
  header,
  footer,
  headerClassName = "shrink-0",
  footerClassName = "shrink-0",
  onClose,
  withAnimation = true,
}: SlidebarPanelProps) {
  useEffect(() => {
    if (!isOpen) return;

    activeSlidebarLocks += 1;

    const body = document.body;
    const docEl = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = docEl.style.overflow;

    body.style.overflow = "hidden";
    docEl.style.overflow = "hidden";

    return () => {
      activeSlidebarLocks = Math.max(0, activeSlidebarLocks - 1);
      if (activeSlidebarLocks === 0) {
        body.style.overflow = previousBodyOverflow;
        docEl.style.overflow = previousHtmlOverflow;
      }
    };
  }, [isOpen]);

  const resolvedPanelClassName = panelClassName
    ? panelClassName
    : `${tone === "custom" ? "" : TONE_PANEL_CLASSES[tone]} h-full w-full shadow-2xl flex flex-col`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 bg-slate-950/40 md:bg-slate-950/25 backdrop-blur-md md:backdrop-blur-sm ${className}`}
            onClick={onClose}
            onWheelCapture={(e) => e.stopPropagation()}
            aria-hidden="true"
          />
          <motion.aside
            initial={withAnimation ? { x: "100%" } : false}
            animate={withAnimation ? { x: 0 } : undefined}
            exit={withAnimation ? { x: "100%" } : undefined}
            transition={withAnimation ? { type: "spring", damping: 28, stiffness: 220 } : undefined}
            className={`fixed inset-y-0 right-0 overscroll-none ${SIZE_CLASSES[size]} ${className}`}
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <div className={resolvedPanelClassName}>
              {header ? <div className={headerClassName}>{header}</div> : null}
              <div className={`${contentClassName} overscroll-contain`}>{children}</div>
              {footer ? <div className={footerClassName}>{footer}</div> : null}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function SlidebarHeader({
  title,
  subtitle,
  iconClassName,
  iconClassExtra,
  iconWrapClassName,
  titleClassName,
  subtitleClassName,
  onClose,
  closeLabel = "Fechar painel",
  closeButtonClassName,
  actions,
  className = "px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900",
}: SlidebarHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 min-w-0">
        {iconClassName ? (
          iconWrapClassName ? (
            <div className={iconWrapClassName}>
              <i className={`fa-solid ${iconClassName} ${iconClassExtra || "text-slate-500"} shrink-0`} aria-hidden="true" />
            </div>
          ) : (
            <i className={`fa-solid ${iconClassName} ${iconClassExtra || "text-slate-500"} shrink-0`} aria-hidden="true" />
          )
        ) : null}
        <div className="min-w-0">
          <h2 className={titleClassName || "text-xl font-bold text-slate-800 dark:text-slate-100 truncate"}>{title}</h2>
          {subtitle ? <p className={subtitleClassName || "text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate"}>{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title={closeLabel}
            aria-label={closeLabel}
            className={closeButtonClassName || "w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SlidebarFooter({ children, className = "px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" }: SlidebarFooterProps) {
  return <div className={className}>{children}</div>;
}
