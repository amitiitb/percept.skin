import type { CaptureStepDef, PhotoType } from "./types";

const FACE_STEPS: Array<[PhotoType, string, string]> = [
  ["face_front", "Front face", "Look straight at the camera with a neutral expression"],
  ["face_left", "Left angle", "Turn your head slowly to show your left side"],
  ["face_right", "Right angle", "Turn your head slowly to show your right side"],
  ["face_detail", "Close-up", "Move closer so your forehead, eyes, nose, and cheeks fill the frame"],
];

const HAIR_STEPS: Array<[PhotoType, string, string]> = [
  ["hairline_front", "Front hairline", "Show your front hairline clearly"],
  ["temple_left", "Left temple", "Show your left temple area"],
  ["temple_right", "Right temple", "Show your right temple area"],
  ["scalp_crown", "Top & crown", "Hold your phone above your head and tilt it down to show the top and crown of your scalp"],
  ["hair_parting", "Hair parting close-up", "Show your natural hair parting up close"],
];

export const CAPTURE_STEPS: CaptureStepDef[] = [
  ...FACE_STEPS.map(([photoType, label, instruction], i): CaptureStepDef => ({
    photoType, phase: "face", phaseIndex: i + 1, phaseTotal: FACE_STEPS.length, label, instruction,
  })),
  ...HAIR_STEPS.map(([photoType, label, instruction], i): CaptureStepDef => ({
    photoType, phase: "hair", phaseIndex: i + 1, phaseTotal: HAIR_STEPS.length, label, instruction,
  })),
];

export const TOTAL_STEPS = CAPTURE_STEPS.length;

export function stepAt(index: number): CaptureStepDef | undefined {
  return CAPTURE_STEPS[index];
}

export function isPhaseTransition(index: number): boolean {
  // True right when moving from the last face step to the first hair step
  return index > 0 && CAPTURE_STEPS[index]?.phase === "hair" && CAPTURE_STEPS[index - 1]?.phase === "face";
}
