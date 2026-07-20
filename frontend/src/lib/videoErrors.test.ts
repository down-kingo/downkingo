import { describe, expect, it } from "vitest";
import { cleanVideoError, isYoutubeAuthenticationError } from "./videoErrors";

describe("video error handling", () => {
  it("recognizes the YouTube anti-bot response", () => {
    expect(
      isYoutubeAuthenticationError(
        "RuntimeError: VideoHandler.GetVideoInfo: yt-dlp error: ERROR: [youtube] id: Sign in to confirm you're not a bot. Use --cookies-from-browser",
      ),
    ).toBe(true);
  });

  it("does not classify unrelated extractor failures as authentication", () => {
    expect(
      isYoutubeAuthenticationError("Unable to extract player response"),
    ).toBe(false);
  });

  it("removes backend implementation prefixes from generic errors", () => {
    expect(
      cleanVideoError(
        "RuntimeError: VideoHandler.GetVideoInfo: yt-dlp error: ERROR: Video unavailable",
      ),
    ).toBe("Video unavailable");
  });
});
