"use client";
import { motion } from "framer-motion";

export function Card({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: "2.8rem" }}
    >
      {eyebrow && (
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", paddingLeft: "0.4rem" }}>
          {eyebrow}
        </p>
      )}
      <div style={{
        background: "var(--surface)", borderRadius: "1.8rem", padding: "2.4rem",
        boxShadow: "0 1.2rem 2.8rem -1.6rem rgba(12, 92, 81,0.22)", border: "1px solid var(--line)",
      }}>
        {children}
      </div>
    </motion.div>
  );
}
