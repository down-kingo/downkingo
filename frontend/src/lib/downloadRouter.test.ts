import { describe, expect, it } from "vitest";
import {
  shouldUseMediaInspector,
  shouldUseVideoDownloader,
} from "./downloadRouter";

describe("shouldUseVideoDownloader", () => {
  it.each([
    "https://youtube.com/watch?v=123",
    "https://youtu.be/123",
    "https://tiktok.com/@user/video/123",
    "https://vimeo.com/123",
    "https://cdn.example/video.mp4?token=1",
  ])("routes video URL %s to the video workflow", (url) => {
    expect(shouldUseVideoDownloader(url)).toBe(true);
  });

  it.each([
    "https://instagram.com/p/carousel/",
    "https://x.com/user/status/123",
    "https://cdn.example/photo.webp",
  ])("keeps media URL %s in the automatic media workflow", (url) => {
    expect(shouldUseVideoDownloader(url)).toBe(false);
  });

  it.each([
    "https://instagram.com/p/carousel/",
    "https://x.com/user/status/123",
    "https://cdn.example/photo.webp?token=1",
  ])("routes media URL %s to the embedded inspector", (url) => {
    expect(shouldUseMediaInspector(url)).toBe(true);
  });

  it.each([
    "https://youtube.com.evil.example/watch?v=123",
    "https://example.com/?next=instagram.com/p/123",
    "javascript://youtube.com/watch?v=123",
    "not a URL containing vimeo.com",
  ])("does not trust domain text outside a web hostname: %s", (url) => {
    expect(shouldUseVideoDownloader(url)).toBe(false);
    expect(shouldUseMediaInspector(url)).toBe(false);
  });
});
