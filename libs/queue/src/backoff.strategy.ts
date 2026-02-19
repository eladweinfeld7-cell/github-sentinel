const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export function jitterBackoff(attemptsMade: number): number {
  const exponentialDelay = Math.min(
    BASE_DELAY_MS * Math.pow(2, attemptsMade),
    MAX_DELAY_MS,
  );
  return Math.floor(Math.random() * exponentialDelay);
}
