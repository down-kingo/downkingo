import { describe, expect, it } from "vitest";
import {
  isInstagramAuthenticationError,
  isInstagramStoryUrl,
  isInstagramUrl,
} from "./instagramResolver";

describe("Instagram URL routing", () => {
  it.each([
    "https://www.instagram.com/p/DaV346eGo9k/",
    "https://instagram.com/reel/ABC_def-123/",
    "https://www.instagram.com/stories/neymarjr/",
    "https://www.instagram.com/stories/neymarjr/123456789/",
  ])("routes supported Instagram media through the inspector: %s", (url) => {
    expect(isInstagramUrl(url)).toBe(true);
  });

  it("distinguishes Stories from posts and reels", () => {
    expect(isInstagramStoryUrl("https://instagram.com/stories/neymarjr/")).toBe(
      true,
    );
    expect(isInstagramStoryUrl("https://instagram.com/p/ABC/")).toBe(false);
    expect(isInstagramStoryUrl("https://instagram.com/reel/ABC/")).toBe(false);
  });

  it("rejects lookalike domains and query-string mentions", () => {
    expect(isInstagramUrl("https://example.com/instagram.com/stories/user/")).toBe(
      false,
    );
    expect(
      isInstagramUrl("https://example.com/?next=instagram.com/stories/user/"),
    ).toBe(false);
  });
});

describe("Instagram authentication errors", () => {
  it("recognizes yt-dlp and application authentication failures", () => {
    expect(
      isInstagramAuthenticationError(
        "You need to log in. Use --cookies-from-browser for authentication",
      ),
    ).toBe(true);
    expect(
      isInstagramAuthenticationError(
        "O Instagram exige uma sessão autenticada para acessar Stories",
      ),
    ).toBe(true);
  });

  it("does not hide unrelated extraction failures behind the auth prompt", () => {
    expect(isInstagramAuthenticationError("network timeout")).toBe(false);
  });
});
