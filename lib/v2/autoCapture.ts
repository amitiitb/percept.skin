/**
 * Live frame analysis for hands-free capture.
 *
 * The shutter button is the wrong control for this flow. On the face steps it
 * lands under the browser's address bar on some phones, and on the crown step
 * it is unusable by definition: the phone is above the user's head with the
 * screen pointing away, so they can neither see the button nor reach it.
 *
 * So the camera decides. Each tick scores the live frame for brightness,
 * sharpness and motion; when all three hold steady for a moment the shot is
 * taken on a short countdown. Because the user often cannot see the screen,
 * every state change is also announced with a tone, a spoken line and a buzz.
 */

export interface FrameStats {
  brightness: number;
  /** Laplacian variance. Higher is sharper. */
  sharpness: number;
  /** Mean absolute luma difference against the previous frame. Higher is more movement. */
  motion: number;
}

export type AutoCaptureBlocker = "too_dark" | "too_blurry" | "moving" | "no_face";

/** Thresholds are deliberately a little looser than the post-capture quality
 *  checks in qualityChecks.ts. This gate decides when to take the shot; that
 *  one decides whether to keep it, and a gate stricter than the check would
 *  leave the user waiting forever for a frame that would have passed. */
export const BRIGHTNESS_MIN = 50;
export const SHARPNESS_MIN = 7;
export const MOTION_MAX = 7;

/** Consecutive good ticks before the countdown starts, at ~10 ticks/sec. */
export const STABLE_TICKS = 6;
/** Countdown length in ticks once stable. */
export const COUNTDOWN_TICKS = 12;

const SAMPLE = 48;

/**
 * Scores frames off a video element. Keeps the previous frame's luma so it can
 * measure movement, which is what separates "framed and held" from "still
 * waving the phone around".
 */
export function createFrameAnalyser() {
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) { canvas.width = SAMPLE; canvas.height = SAMPLE; }
  const ctx = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
  let previous: Float32Array | null = null;

  return {
    reset() { previous = null; },

    analyse(video: HTMLVideoElement): FrameStats | null {
      if (!ctx || !video.videoWidth || !video.videoHeight) return null;
      ctx.drawImage(video, 0, 0, SAMPLE, SAMPLE);
      const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

      const gray = new Float32Array(SAMPLE * SAMPLE);
      let total = 0;
      for (let i = 0; i < gray.length; i++) {
        const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        gray[i] = v;
        total += v;
      }
      const brightness = total / gray.length;

      let variance = 0;
      for (let y = 1; y < SAMPLE - 1; y++) {
        for (let x = 1; x < SAMPLE - 1; x++) {
          const i = y * SAMPLE + x;
          const lap = gray[i - 1] + gray[i + 1] + gray[i - SAMPLE] + gray[i + SAMPLE] - 4 * gray[i];
          variance += lap * lap;
        }
      }
      const sharpness = variance / ((SAMPLE - 2) * (SAMPLE - 2));

      let motion = 0;
      if (previous) {
        let diff = 0;
        for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - previous[i]);
        motion = diff / gray.length;
      } else {
        // No baseline yet, so report movement rather than claim stillness and
        // fire the countdown off a single frame.
        motion = Number.POSITIVE_INFINITY;
      }
      previous = gray;

      return { brightness, sharpness, motion };
    },
  };
}

/** Returns what is blocking capture, or null when the frame is good to take. */
export function blockerFor(stats: FrameStats, needsFace: boolean, faceLocked: boolean): AutoCaptureBlocker | null {
  if (stats.brightness < BRIGHTNESS_MIN) return "too_dark";
  if (needsFace && !faceLocked) return "no_face";
  // Motion before sharpness: a moving frame is usually blurry too, and "hold
  // still" is more actionable than "that looked blurry".
  if (!Number.isFinite(stats.motion) || stats.motion > MOTION_MAX) return "moving";
  if (stats.sharpness < SHARPNESS_MIN) return "too_blurry";
  return null;
}

export const BLOCKER_MESSAGES: Record<AutoCaptureBlocker, string> = {
  too_dark: "Too dark. Find brighter light.",
  too_blurry: "Not sharp yet. Hold still.",
  moving: "Hold still.",
  no_face: "Bring your face into the frame.",
};

/** Shorter, spoken versions. Read aloud on steps where the screen is not visible. */
export const BLOCKER_SPEECH: Record<AutoCaptureBlocker, string> = {
  too_dark: "Too dark",
  too_blurry: "Hold still, not sharp",
  moving: "Hold still",
  no_face: "Show your face",
};

/**
 * Non-visual feedback. On the crown step this is the entire interface, so it
 * has to work with the screen face-down: a tone, a spoken line, and a buzz.
 */
export function createCues() {
  let audio: AudioContext | null = null;

  function ctx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audio ??= new Ctor();
      // Autoplay policy suspends the context until a gesture; the capture
      // screen is always reached by a tap, so resuming here is enough.
      if (audio.state === "suspended") void audio.resume();
      return audio;
    } catch {
      return null;
    }
  }

  return {
    /** Call once from a user gesture so later tones are allowed to play. */
    unlock() { ctx(); },

    beep(frequency = 880, ms = 90, gain = 0.06) {
      const a = ctx();
      if (!a) return;
      const osc = a.createOscillator();
      const vol = a.createGain();
      osc.frequency.value = frequency;
      osc.type = "sine";
      vol.gain.value = gain;
      osc.connect(vol).connect(a.destination);
      const now = a.currentTime;
      osc.start(now);
      // Ramp down rather than hard-stop, which clicks.
      vol.gain.setValueAtTime(gain, now + ms / 1000 - 0.02);
      vol.gain.linearRampToValueAtTime(0, now + ms / 1000);
      osc.stop(now + ms / 1000);
    },

    shutter() {
      this.beep(1320, 70, 0.08);
      setTimeout(() => this.beep(1760, 110, 0.07), 80);
    },

    buzz(pattern: number | number[] = 40) {
      try { navigator.vibrate?.(pattern); } catch { /* unsupported, tones still play */ }
    },

    speak(text: string) {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel(); // never queue guidance, it goes stale immediately
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.volume = 1;
        synth.speak(u);
      } catch { /* unsupported, tones and haptics still fire */ }
    },

    stopSpeech() {
      try { window.speechSynthesis?.cancel(); } catch { /* no-op */ }
    },
  };
}
