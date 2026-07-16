import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

const srcDir = path.join(process.cwd(), "src");

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastAgainstWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

describe("dark mode accessibility conventions", () => {
  it("does not use light-scale surface utilities as dark foregrounds or backgrounds", async () => {
    const files = await glob("**/*.tsx", {
      cwd: srcDir,
      absolute: true,
      windowsPathsNoEscape: true,
    });
    const forbidden = [
      /dark:text-surface-(?:50|100|200|300)\b/g,
      /dark:(?:hover:)?bg-surface-(?:600|700|800|900|950)\b/g,
      /dark:border-surface-(?:600|700|800|900)\b/g,
    ];
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of forbidden) {
        for (const match of source.matchAll(pattern)) {
          violations.push(`${file}:${match[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps filled accent buttons readable with white text", async () => {
    const css = await readFile(path.join(srcDir, "index.css"), "utf8");
    const themes = ["red", "blue", "green", "orange", "purple"];

    for (const theme of themes) {
      const block = css.match(
        new RegExp(`\\.dark\\[data-color="${theme}"\\]\\s*\\{([\\s\\S]*?)\\}`),
      );
      const primary600 = block?.[1].match(/--primary-600:\s*(#[0-9a-f]{6})/i)?.[1];

      expect(primary600, `${theme} is missing --primary-600`).toBeTruthy();
      expect(contrastAgainstWhite(primary600!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
