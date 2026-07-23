"use client";
import { motion } from "framer-motion";

export function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: "1px", width: "100%", background: "var(--line)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", background: "var(--primary)" }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </div>
  );
}
