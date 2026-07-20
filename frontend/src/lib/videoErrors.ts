export type CookieBrowser =
  | "chrome"
  | "edge"
  | "firefox"
  | "brave"
  | "safari";

export function isYoutubeAuthenticationError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return (
    message.includes("sign in to confirm you're not a bot") ||
    message.includes("sign in to confirm you’re not a bot") ||
    message.includes("use --cookies-from-browser") ||
    message.includes("authentication required") ||
    message.includes("youtube solicitou uma sessão autenticada") ||
    message.includes("private video")
  );
}

export function cleanVideoError(error: unknown): string {
  return String(error)
    .replace(/^RuntimeError:\s*/i, "")
    .replace(/^VideoHandler\.[^:]+:\s*/i, "")
    .replace(/^yt-dlp error(?: \(with cookies\))?:\s*/i, "")
    .replace(/^ERROR:\s*/i, "")
    .trim();
}
