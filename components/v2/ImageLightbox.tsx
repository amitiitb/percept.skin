"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconClose } from "@/components/ui/icons";

// Drop-in replacement for a plain <img> in the report's generated-preview
// panels (hairstyle, beard, colour draping, frames). The inline image keeps
// whatever size/rounding the call site gave it; clicking it opens the full
// image in a fixed overlay that closes on the X button, a backdrop click, or
// Escape. Rendered through a portal on document.body so the overlay is never
// clipped by a panel's own `overflow: hidden` / `position` context.
export function ImageLightbox({ src, alt, style, className }: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{ cursor: "zoom-in", ...style }}
        className={className}
      />

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "clamp(1.6rem, 5vw, 4rem)",
                background: "rgba(12, 20, 18, 0.88)",
                backdropFilter: "blur(4px)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close image"
                style={{
                  position: "fixed", top: "1.6rem", right: "1.6rem",
                  width: "4.4rem", height: "4.4rem", borderRadius: "50%", border: "none",
                  background: "rgba(255, 255, 255, 0.16)", color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <IconClose size={2} strokeWidth={2} />
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                src={src}
                alt={alt}
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.94 }}
                transition={{ duration: 0.18 }}
                style={{
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                  borderRadius: "0.8rem", boxShadow: "0 2rem 6rem rgba(0, 0, 0, 0.5)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
