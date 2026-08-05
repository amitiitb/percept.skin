// Shared between the AI prompt (lib/v2/aiProvider.ts, server-only) and the
// report page (client component) — kept in its own zero-dependency file so
// importing it from a client component never pulls in server-only code
// (google-auth-library etc.) the way importing straight from aiProvider.ts
// would.
//
// Splits the "face" metric category into two named, user-facing groups
// rather than one flat list — Harmony (proportion/balance) and Angularity
// (jawline/cheekbone/chin definition) are both established, recognizable
// facial-aesthetics concepts on their own, and reading a report section
// titled "Face" never told the user which kind of thing it was scoring.
export const HARMONY_METRIC_NAMES = [
  "Facial symmetry", "Cheek balance", "Forehead proportion", "Overall facial harmony",
];

export const ANGULARITY_METRIC_NAMES = [
  "Jawline definition", "Cheekbone definition", "Chin projection",
];

export const FACE_METRIC_NAMES = [...HARMONY_METRIC_NAMES, ...ANGULARITY_METRIC_NAMES];
