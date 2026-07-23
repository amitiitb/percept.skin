import type { CaptureStepDef, PhotoType } from "./types";

const FACE_STEPS: Array<[PhotoType, string, string]> = [
  ["face_front", "Front face", "Look straight at the camera with a neutral expression"],
  ["face_left", "Left angle", "Turn your head slowly to show your left side"],
  ["face_right", "Right angle", "Turn your head slowly to show your right side"],
  ["forehead", "Forehead close-up", "Position your forehead inside the guide"],
  ["eye_left", "Left eye close-up", "Position your left eye inside the guide"],
  ["eye_right", "Right eye close-up", "Position your right eye inside the guide"],
  ["nose_cheek", "Nose & cheek", "Position your nose and cheek inside the guide"],
  ["smile", "Smile", "Give a natural smile"],
  ["chin_jaw", "Chin & jaw", "Position your chin and jawline inside the guide"],
];

const HAIR_STEPS: Array<[PhotoType, string, string]> = [
  ["hairline_front", "Front hairline", "Show your front hairline clearly"],
  ["temple_left", "Left temple", "Show your left temple area"],
  ["temple_right", "Right temple", "Show your right temple area"],
  ["scalp_top", "Top of scalp", "Tilt your head down slightly to show the top of your scalp"],
  ["crown", "Crown area", "Show the crown of your head — use the rear camera if easier"],
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
