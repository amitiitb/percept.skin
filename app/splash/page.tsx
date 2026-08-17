"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import styles from "./splash.module.css";

export default function V2SplashPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <motion.span
          className={styles.orbitOuter}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className={styles.orbitInner}
          animate={reduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 19, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className={styles.pulse}
          animate={reduceMotion ? undefined : { scale: [0.92, 1.08, 0.92], opacity: [0.42, 0.72, 0.42] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        className={styles.themeToggle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <ThemeToggle compact />
      </motion.div>

      <section className={styles.content} aria-labelledby="splash-title">
        <motion.p
          className={styles.eyebrow}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.55 }}
        >
          Your personal beauty intelligence
        </motion.p>

        <motion.h1
          id="splash-title"
          className={styles.wordmark}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.24, 0.43, 0.15, 0.97] }}
        >
          <span>Percept</span>
          <motion.span
            className={styles.ai}
            animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            AI
          </motion.span>
        </motion.h1>

        <motion.div
          className={styles.rule}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.34, duration: 0.8, ease: [0.24, 0.43, 0.15, 0.97] }}
        />

        <motion.p
          className={styles.tagline}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Understand your skin.<br className={styles.mobileBreak} /> Elevate your beauty.
        </motion.p>

        <motion.div
          className={styles.ctaWrap}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.6 }}
        >
          <Link href="/onboard" className={styles.cta}>
            <span>Start my personalised analysis</span>
            <span className={styles.arrow} aria-hidden="true">→</span>
          </Link>
          <p className={styles.note}>Private by design · Takes about 3 minutes</p>
        </motion.div>
      </section>
    </main>
  );
}
