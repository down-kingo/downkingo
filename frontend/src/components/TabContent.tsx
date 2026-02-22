import { motion } from "framer-motion";
import { memo, ReactNode } from "react";

interface TabContentProps {
  children: ReactNode;
  className?: string;
}

// Memoized to prevent re-renders when sibling tabs update
export const TabContent = memo(({ children, className }: TabContentProps) => (
  <motion.div
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -10 }}
    transition={{ duration: 0.2, ease: "easeInOut" }}
    className={`flex-1 w-full h-full overflow-hidden flex flex-col min-h-0 relative ${
      className || ""
    }`}
  >
    {children}
  </motion.div>
));
