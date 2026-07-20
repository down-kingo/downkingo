import { describe, expect, it } from "vitest";
import {
  getRequiredDependencyNames,
  hasMissingRequiredDependencies,
} from "./features";

describe("feature dependency rules", () => {
  it("deduplicates shared dependencies", () => {
    expect(getRequiredDependencyNames(["videos", "converter"])).toEqual([
      "yt-dlp",
      "FFmpeg",
      "YouTube PO Provider",
      "yt-dlp PO Plugin",
      "avifenc",
    ]);
  });

  it("does not require dependencies from disabled modules", () => {
    expect(
      hasMissingRequiredDependencies(
        ["converter"],
        [
          { name: "FFmpeg", installed: true },
          { name: "avifenc", installed: true },
          { name: "YouTube PO Provider", installed: false },
        ],
      ),
    ).toBe(false);
  });

  it("treats a missing catalog entry as unavailable", () => {
    expect(
      hasMissingRequiredDependencies(
        ["videos"],
        [{ name: "yt-dlp", installed: true }],
      ),
    ).toBe(true);
  });
});
