// MediaPipe's WASM runtime (tasks-vision) writes benign init lines to stderr —
// "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.", GL fallback
// notices, etc. Next's dev overlay surfaces every stderr write as a
// "Console Error", so these harmless lines look like real errors.
//
// Importing this module patches console.error once (idempotent) to drop only
// those known-noise lines. Everything else passes through untouched.

const NOISE = /^(INFO|WARNING): |Created TensorFlow Lite/;

declare global {
  // eslint-disable-next-line no-var
  var __mediapipeConsolePatched: boolean | undefined;
}

if (typeof window !== "undefined" && !globalThis.__mediapipeConsolePatched) {
  globalThis.__mediapipeConsolePatched = true;
  const real = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && NOISE.test(args[0])) return;
    real(...args);
  };
}

export {};
