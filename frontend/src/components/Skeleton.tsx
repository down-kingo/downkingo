import { motion } from "framer-motion";

export const Skeleton = ({ className }: { className?: string }) => (
  <motion.div
    className={`bg-surface-200 dark:bg-white/5 rounded-lg ${className || ""}`}
    animate={{ opacity: [0.5, 0.8, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
  />
);
