// Gemini's high-quality image model has a much tighter concurrent-request
// allowance than the text model. Report panels are mounted together, so their
// automatic effects would otherwise start several expensive image edits at
// once and receive 429 RESOURCE_EXHAUSTED responses. Keep one browser-local
// queue: text analysis remains immediate, while image grids run one at a time.
let imageGenerationTail: Promise<void> = Promise.resolve();

export function enqueueImageGeneration<T>(job: () => Promise<T>): Promise<T> {
  const result = imageGenerationTail.then(job, job);
  imageGenerationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
