import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";

interface PillButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  subtitle?: string;
}

/**
 * Botão estilo "pill" com animação e estado selecionado.
 * Usado para seleção de formatos, qualidades, etc.
 */
export const PillButton = memo(function PillButton({
  selected,
  onClick,
  children,
  subtitle,
}: PillButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
        selected
          ? "bg-surface-900 dark:bg-primary-600 text-white dark:text-white shadow-lg shadow-primary-500/20"
          : "bg-surface-100 dark:bg-surface-200 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-300"
      }`}
    >
      <span className="block">{children}</span>
      {subtitle && (
        <span
          className={`block text-[10px] mt-0.5 ${
            selected ? "opacity-70" : "opacity-50"
          }`}
        >
          {subtitle}
        </span>
      )}
    </motion.button>
  );
});
