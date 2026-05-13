import { motion, Variants } from "framer-motion";

interface AnimatedHamburgerProps {
  active: boolean;
  onClick?: () => void;
  className?: string;
}

export function AnimatedHamburger({ active, onClick, className = "" }: AnimatedHamburgerProps) {
  const Component = (onClick ? "button" : "div") as any;
  
  const topVariant: Variants = {
    inactive: { d: "M 6,10 L 26,10", transition: { duration: 0.4, ease: "easeInOut" } },
    active: { d: "M 8,8 L 24,24", transition: { duration: 0.4, ease: "easeInOut" } },
  };

  const middleVariant: Variants = {
    inactive: { opacity: 1, d: "M 6,16 L 26,16", transition: { duration: 0.3 } },
    active: { opacity: 0, d: "M 16,16 L 16.1,16", transition: { duration: 0.3 } },
  };

  const bottomVariant: Variants = {
    inactive: { d: "M 6,22 L 26,22", transition: { duration: 0.4, ease: "easeInOut" } },
    active: { d: "M 8,24 L 24,8", transition: { duration: 0.4, ease: "easeInOut" } },
  };

  const state = active ? "active" : "inactive";

  return (
    <Component
      onClick={onClick}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group ${active ? "active shadow-nm-inset" : "shadow-nm-flat"} ${onClick ? "hover:bg-surface-soft active:scale-95 cursor-pointer" : ""} ${className}`}
      {...((onClick ? { "aria-label": "Menu" } : {}) as any)}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        className="transform transition-transform group-hover:scale-110"
      >
        <motion.path
          initial="inactive"
          animate={state}
          variants={topVariant}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <motion.path
          initial="inactive"
          animate={state}
          variants={middleVariant}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <motion.path
          initial="inactive"
          animate={state}
          variants={bottomVariant}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </Component>
  );
}
