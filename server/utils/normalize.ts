// server/utils/normalize.ts
export function normalizeUsername(input: string) {
  return String(input || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
}