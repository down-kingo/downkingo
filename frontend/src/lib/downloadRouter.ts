const DIRECT_VIDEO_PATTERN = /\.(?:mp4|webm|mov|mkv)(?:[?#]|$)/i;
const DIRECT_IMAGE_PATTERN =
  /\.(?:jpg|jpeg|png|webp|avif|gif)(?:[?#]|$)/i;

const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "tiktok.com", "vimeo.com"];
const MEDIA_DOMAINS = ["instagram.com", "twitter.com", "x.com"];

function parseWebURL(rawURL: string): URL | null {
  try {
    const parsed = new URL(rawURL.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

function matchesAnyDomain(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => matchesDomain(hostname, domain));
}

export function shouldUseVideoDownloader(url: string) {
  const parsed = parseWebURL(url);
  if (!parsed) return false;
  return (
    matchesAnyDomain(parsed.hostname, VIDEO_DOMAINS) ||
    DIRECT_VIDEO_PATTERN.test(parsed.pathname)
  );
}

export function shouldUseMediaInspector(url: string) {
  const parsed = parseWebURL(url);
  if (!parsed || shouldUseVideoDownloader(url)) return false;
  return (
    matchesAnyDomain(parsed.hostname, MEDIA_DOMAINS) ||
    DIRECT_IMAGE_PATTERN.test(parsed.pathname)
  );
}
