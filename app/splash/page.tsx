"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Logo } from "@/components/ui/Logo";

export default function V2SplashPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2.4rem", position: "relative", overflow: "hidden" }}>
      <motion.div
        aria-hidden
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.06, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "50%", left: "50%", width: "60rem", height: "60rem",
          transform: "translate(-50%, -50%)", borderRadius: "50%",
          background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ position: "relative", textAlign: "center" }}
      >
        <Logo height="clamp(3.6rem, 8vw, 5.6rem)" />
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)", marginTop: "1.6rem", maxWidth: "40rem" }}>
          Understand your skin. Elevate your beauty.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ position: "relative", marginTop: "6.4rem", width: "100%", maxWidth: "36rem" }}
      >
        <PrimaryButton size="lg" onClick={() => router.push("/onboard")}>
          Get Started →
        </PrimaryButton>
      </motion.div>
    </div>
  );
}
