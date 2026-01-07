import { memo, type ReactNode } from "react";

interface SectionHeaderProps {
  children: ReactNode;
}

/**
 * Header de seção com estilo consistente para opções de conversão.
 */
export const SectionHeader = memo(function SectionHeader({
  children,
}: SectionHeaderProps) {
  return (
    <h4 className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
      {children}
    </h4>
  );
});
