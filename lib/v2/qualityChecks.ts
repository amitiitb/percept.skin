export type QualityIssue = "no_face" | "multiple_faces" | "too_dark" | "too_blurry" | "model_unavailable";

export interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
}

let detectorPromise: Promise<import("@mediapipe/tasks-vision").FaceLandmarker | null> | null = null;

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          runningMode: "IMAGE",
          numFaces: 2, // need to distinguish "one face" from "more than one"
        });
      } catch {
        return null; // ModelLoadError — caller falls back to skip-check (Design review a11y: still announce via aria-live that check was skipped)
      }
    })();
  }
  return detectorPromise;
}

function sampleBrightness(img: HTMLImageElement): number {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 128;
  ctx.drawImage(img, 0, 0, 32, 32);
  const { data } = ctx.getImageData(0, 0, 32, 32);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (data.length / 4);
}

// Laplacian-variance-ish blur estimate on a downsampled grayscale grid — cheap, not a real edge detector.
function sampleBlur(img: HTMLImageElement): number {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 100;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Float32Array(size * size);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let variance = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      const lap = gray[idx - 1] + gray[idx + 1] + gray[idx - size] + gray[idx + size] - 4 * gray[idx];
      variance += lap * lap;
    }
  }
  return variance / ((size - 2) * (size - 2));
}

// checkFace: false for hair/scalp shots (scalp_crown, hair_parting, and often
// hairline_front) — those are expected to show little or no face, so running
// face-detection on them was flagging a real "no_face" warning on a correctly
// framed photo. Brightness/blur checks still apply to every photo type.
export async function runQualityChecks(img: HTMLImageElement, checkFace: boolean = true): Promise<QualityResult> {
  const issues: QualityIssue[] = [];

  const brightness = sampleBrightness(img);
  if (brightness < 55) issues.push("too_dark");

  const blur = sampleBlur(img);
  if (blur < 8) issues.push("too_blurry");

  if (!checkFace) {
    return { passed: issues.length === 0, issues };
  }

  const detector = await getDetector();
  if (!detector) {
    issues.push("model_unavailable");
    // Skip face-count check rather than block the user — never pretend the check ran.
    return { passed: issues.filter((i) => i !== "model_unavailable").length === 0, issues };
  }

  try {
    const result = detector.detect(img);
    const faceCount = result.faceLandmarks?.length ?? 0;
    if (faceCount === 0) issues.push("no_face");
    if (faceCount > 1) issues.push("multiple_faces");
  } catch {
    issues.push("model_unavailable");
  }

  return { passed: issues.length === 0, issues };
}

export const ISSUE_MESSAGES: Record<QualityIssue, string> = {
  no_face: "We couldn't detect a face. Try better lighting and face the camera directly.",
  multiple_faces: "More than one face detected. Make sure you're alone in frame.",
  too_dark: "This photo is too dark. Move to a well-lit area and retake.",
  too_blurry: "This photo looks blurry. Hold steady and retake.",
  model_unavailable: "Live quality check unavailable. You can still continue, we'll review during processing.",
};
