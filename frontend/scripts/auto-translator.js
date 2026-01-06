import fs from "fs";
import path from "path";
import { glob } from "glob";
import translate from "@iamtraction/google-translate";

// --- Configuration ---
const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");
const SOURCE_LANG = "pt-BR"; // Assuming Portuguese is your main language since you write in it
const TARGET_LANGS = ["en-US", "es-ES", "de-DE", "fr-FR"];

// Map file codes to Google Translate codes
const G_LANG_MAP = {
  "en-US": "en",
  "pt-BR": "pt",
  "es-ES": "es",
  "de-DE": "de",
  "fr-FR": "fr",
};

// --- Helpers ---
const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
};

// Recursive function to find empty keys or keys present in source but not in target (although parser handles creation)
// We focus on keys that are empty strings "" in target
async function translateObject(sourceObj, targetObj, targetLangCode) {
  let hasChanges = false;

  for (const key in sourceObj) {
    const sourceVal = sourceObj[key];
    const targetVal = targetObj[key];

    if (typeof sourceVal === "object" && sourceVal !== null) {
      // Nested object
      if (!targetObj[key]) targetObj[key] = {};
      const changed = await translateObject(
        sourceVal,
        targetObj[key],
        targetLangCode
      );
      if (changed) hasChanges = true;
    } else if (typeof sourceVal === "string") {
      // String value
      // Translate if target is missing, empty string, or same as key (sometimes default)
      // Here we STRICTLY check for empty string "" based on parser config
      if (
        sourceVal.trim() !== "" &&
        (targetVal === "" || targetVal === undefined || targetVal === null)
      ) {
        try {
          // console.log(`Translating [${key}]: "${sourceVal}" to ${targetLangCode}...`);
          const res = await translate(sourceVal, {
            from: G_LANG_MAP[SOURCE_LANG],
            to: G_LANG_MAP[targetLangCode],
          });
          targetObj[key] = res.text;
          console.log(`✅ [${targetLangCode}] ${key}: ${res.text}`);
          hasChanges = true;
        } catch (err) {
          console.error(
            `❌ Failed to translate [${key}] to ${targetLangCode}:`,
            err.message
          );
        }
      }
    }
  }
  return hasChanges;
}

// --- Main ---
async function main() {
  console.log("🌍 Auto-Translator Initialized");
  console.log(`📡 Source Language: ${SOURCE_LANG}`);

  // Get all namespace files in source language
  const sourcePattern = path
    .join(LOCALES_DIR, SOURCE_LANG, "*.json")
    .replace(/\\/g, "/");
  const sourceFiles = await glob(sourcePattern);

  if (sourceFiles.length === 0) {
    console.error(`❌ No source files found for ${SOURCE_LANG}`);
    process.exit(1);
  }

  for (const sourceFile of sourceFiles) {
    const fileName = path.basename(sourceFile);
    const namespace = fileName.replace(".json", "");

    console.log(`\n📂 Processing namespace: ${namespace}`);
    const sourceData = readJson(sourceFile);

    for (const targetLang of TARGET_LANGS) {
      if (targetLang === SOURCE_LANG) continue;

      const targetFile = path.join(LOCALES_DIR, targetLang, fileName);
      let targetData = readJson(targetFile);

      // Ensure target object exists (parser might have created it, but let's be safe)
      if (!targetData) targetData = {};

      const changed = await translateObject(sourceData, targetData, targetLang);

      if (changed) {
        writeJson(targetFile, targetData);
        console.log(`💾 Updated ${targetLang}/${fileName}`);
      } else {
        console.log(`✨ ${targetLang}/${fileName} is up to date.`);
      }
    }
  }

  console.log("\n🎉 Translation complete!");
}

main().catch(console.error);
