import type { CaptureStepDef, PhotoType } from "./types";

const FACE_STEPS: Array<[PhotoType, string, string]> = [
  ["face_front", "Front face", "Look straight at the camera with a neutral expression"],
  ["face_left", "Left angle", "Turn your head slowly to show your left side"],
  ["face_right", "Right angle", "Turn your head slowly to show your right side"],
  ["face_detail", "Close-up", "Move closer so your forehead, eyes, nose, and cheeks fill the frame"],
];

// Two hair shots, not three. The parting close-up was dropped: it largely
// duplicated what the crown shot already covers (part width and scalp
// visibility both read from the crown angle), and it was the step most likely
// to be captured badly, since it needs an awkward one-handed overhead angle
// on an area the user cannot see while framing.
const HAIR_STEPS: Array<[PhotoType, string, string]> = [
  ["hairline_front", "Hairline & temples", "Show your front hairline and both temples clearly"],
  ["scalp_crown", "Top & crown", "Hold your phone above your head and tilt it down to show the top and crown of your scalp"],
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
