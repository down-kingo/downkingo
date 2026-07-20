const fs = require("fs");
const https = require("https");
const {
  OPENROUTER_MODEL,
  GENERATION_CONFIG_ROADMAP,
  OPENROUTER_API_URL,
  delay,
  RATE_LIMIT_DELAY_MS,
} = require("./ai-config");

// --- Configuration ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ORG_NAME = process.env.ORG_NAME || "down-kingo";
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER || "2");
const OPENROUTER_REQUEST_TIMEOUT_MS = parseInt(
  process.env.OPENROUTER_REQUEST_TIMEOUT_MS || "45000",
  10
);
const LANGUAGES = ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE"];

const QUERY = `
  query($login: String!, $number: Int!) {
    organization(login: $login) {
      projectV2(number: $number) {
        items(first: 100) {
          nodes {
            content {
              ... on Issue {
                number
                title
                body
                url
                closedAt
                comments { totalCount }
                reactions(content: THUMBS_UP) { totalCount }
                reactions_down: reactions(content: THUMBS_DOWN) { totalCount }
                labels(first: 10) { nodes { name } }
                author { login, avatarUrl }
                createdAt
              }
            }
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
    }
  }
`;

const STATUS_MAPPING = {
  bastidores: "idea",
  "em pauta": "planned",
  "em produção": "in-progress",
  "no ar": "shipped",
  backlog: "idea",
  todo: "idea",
  ready: "planned",
  planned: "planned",
  "in progress": "in-progress",
  done: "shipped",
  shipped: "shipped",
  completed: "shipped",
};

function resolveStatus(projectStatus) {
  // The Project v2 Status field is the roadmap source of truth. An issue can
  // legitimately be closed while it remains in Bastidores or Em Produção.
  const normalized = projectStatus?.trim().toLowerCase() || "idea";
  return STATUS_MAPPING[normalized] || "idea";
}

function shouldTranslateMissing(value = process.env.ROADMAP_TRANSLATE_MISSING) {
  return ["1", "true", "yes"].includes(String(value || "").toLowerCase());
}

function hashDescription(description) {
  if (!description) return "";
  return `${description.slice(0, 100).replace(/\s/g, "")}_${description.length}`;
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasTranslationKey(map, lang, allowEmpty = false) {
  return (
    map &&
    Object.prototype.hasOwnProperty.call(map, lang) &&
    typeof map[lang] === "string" &&
    (allowEmpty || map[lang].trim().length > 0)
  );
}

function isUsableTranslationBundle(
  titleI18n,
  descriptionI18n,
  originalTitle = "",
  originalDescription = ""
) {
  const descriptionCanBeEmpty = originalDescription.trim().length === 0;
  if (
    !LANGUAGES.every((lang) => hasTranslationKey(titleI18n, lang)) ||
    !LANGUAGES.every((lang) =>
      hasTranslationKey(descriptionI18n, lang, descriptionCanBeEmpty)
    )
  ) {
    return false;
  }

  // The broken production cache had all five language keys populated with
  // the same Portuguese text. Presence alone is therefore not proof that an
  // item was translated. Long natural-language descriptions must contain at
  // least two distinct localized values and may match the source in at most
  // one language (the detected source language itself).
  const normalizedOriginal = normalizeComparableText(originalDescription);
  const localizedTitles = LANGUAGES.map((lang) =>
    normalizeComparableText(titleI18n[lang])
  );
  const localizedDescriptions = LANGUAGES.map((lang) =>
    normalizeComparableText(descriptionI18n[lang])
  );
  if (
    new Set(localizedTitles).size === 1 &&
    new Set(localizedDescriptions).size === 1 &&
    (normalizeComparableText(originalTitle).length >= 12 ||
      normalizedOriginal.length >= 20)
  ) {
    return false;
  }

  if (normalizedOriginal.length >= 80) {
    const distinctDescriptions = new Set(localizedDescriptions);
    const sourceMatches = localizedDescriptions.filter(
      (value) => value === normalizedOriginal
    ).length;
    if (distinctDescriptions.size < 2 || sourceMatches > 1) {
      return false;
    }
  }
  if (
    normalizedOriginal.length >= 500 &&
    localizedDescriptions.some(
      (value) => value.length < normalizedOriginal.length * 0.6
    )
  ) {
    // The old batch prompt truncated long descriptions at 1,000 characters
    // and cached the partial result forever. Localized bodies must retain a
    // reasonable amount of the source content.
    return false;
  }

  return LANGUAGES.every(
    (lang) => normalizeComparableText(titleI18n[lang]).length > 0
  );
}

function extractTranslationMaps(translations) {
  const titleI18n = {};
  const descriptionI18n = {};

  for (const lang of LANGUAGES) {
    const content = translations?.[lang];
    if (!content || typeof content !== "object") continue;
    if (typeof content.title === "string") titleI18n[lang] = content.title;
    if (typeof content.description === "string") {
      descriptionI18n[lang] = content.description;
    }
  }

  return { titleI18n, descriptionI18n };
}

function createRoadmapItemFromProjectNode(node, translationCache = {}) {
  const content = node?.content;
  if (!content?.number) return null;

  const status = resolveStatus(node.fieldValueByName?.name);
  const originalDescription = content.body || "";
  const originalDescHash = hashDescription(originalDescription);
  const cached = translationCache[content.number];
  const cacheMatchesSource =
    cached?.original_title === content.title &&
    cached?.original_desc_hash === originalDescHash;
  const cacheIsUsable =
    cacheMatchesSource &&
    isUsableTranslationBundle(
      cached.title_i18n,
      cached.description_i18n,
      content.title,
      originalDescription
    );

  return {
    id: content.number,
    title: content.title,
    title_i18n: cacheIsUsable ? cached.title_i18n : null,
    description: originalDescription,
    description_i18n: cacheIsUsable ? cached.description_i18n : null,
    _original_desc_hash: originalDescHash,
    status,
    votes: content.reactions?.totalCount || 0,
    votes_up: content.reactions?.totalCount || 0,
    votes_down: content.reactions_down?.totalCount || 0,
    comments: content.comments?.totalCount || 0,
    url: content.url,
    labels: (content.labels?.nodes || []).map((label) => label.name),
    author: content.author?.login || "",
    author_avatar: content.author?.avatarUrl || "",
    created_at: content.createdAt,
    // A closed issue remains visible in its Project column. closedAt is only
    // release metadata when that canonical column is actually shipped.
    shipped_at: status === "shipped" ? content.closedAt : null,
    _needs_ai: !cacheIsUsable,
  };
}

function createItemForLang(item, lang) {
  return {
    ...item,
    friendly_title:
      item.title_i18n?.[lang] || item.friendly_title || item.title,
    description: item.description_i18n?.[lang] ?? item.description,
    title_i18n: undefined,
    description_i18n: undefined,
    _needs_ai: undefined,
  };
}

// --- Helpers ---

async function graphql(query, variables) {
  const data = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://api.github.com/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "User-Agent": "Node.js Script",
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200)
            reject(new Error(`GitHub API Status: ${res.statusCode} ${body}`));
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function requestOpenRouter(prompt) {
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: GENERATION_CONFIG_ROADMAP.temperature,
    max_tokens: GENERATION_CONFIG_ROADMAP.max_tokens,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      OPENROUTER_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://downkingo.com",
          "X-Title": "DownKingo Roadmap Sync",
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error(
              `OpenRouter API Status: ${res.statusCode} ${responseBody.slice(0, 500)}`
            );
            return resolve(null);
          }
          try {
            const json = JSON.parse(responseBody);
            const text = json.choices?.[0]?.message?.content;
            if (!text) return resolve(null);

            const cleanJson = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            resolve(JSON.parse(cleanJson));
          } catch (error) {
            console.error("OpenRouter Parse Error:", error);
            console.error("Raw Response:", responseBody.slice(0, 500));
            resolve(null);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(OPENROUTER_REQUEST_TIMEOUT_MS, () => {
      req.destroy(
        new Error(
          `OpenRouter request timed out after ${OPENROUTER_REQUEST_TIMEOUT_MS}ms`
        )
      );
    });
    req.write(body);
    req.end();
  });
}

async function callOpenRouter(technicalTitle, description, attempt = 1) {
  // Truncate description to avoid token overflow (keep first 1000 chars)
  const shortDesc = description ? description.slice(0, 1000) : "";

  const prompt = `
    Task: Translate the following GitHub Issue content into multiple languages.

    === ORIGINAL CONTENT ===
    Technical Title: "${technicalTitle}"
    Description (Markdown):
    """
    ${shortDesc}
    """

    === RULES ===
    1. For TITLE: Remove prefixes like feat:, fix:, chore:, docs:, refactor:, style:, test:, ci:. Make it a clear, concise feature name (max 60 chars). No trailing punctuation.
    2. For DESCRIPTION: Translate the full text preserving Markdown formatting (headers, lists, bold, etc). Keep technical terms if appropriate.
    3. Provide translations for: ${LANGUAGES.join(", ")}.
    4. Every language value MUST actually be written in that language. Copying the Portuguese/source text into en-US, es-ES, fr-FR, or de-DE is invalid.
    5. This is validation attempt ${attempt}. RETURN ONLY RAW VALID JSON. No Markdown block. No explanation.

    === EXPECTED JSON FORMAT ===
    {
      "pt-BR": { "title": "Título em Português", "description": "Descrição traduzida..." },
      "en-US": { "title": "Title in English", "description": "Translated description..." },
      "es-ES": { "title": "Título en Español", "description": "Descripción traducida..." },
      "fr-FR": { "title": "Titre en Français", "description": "Description traduite..." },
      "de-DE": { "title": "Titel auf Deutsch", "description": "Übersetzte Beschreibung..." }
    }
  `;

  return requestOpenRouter(prompt);
}

async function callOpenRouterForLanguage(technicalTitle, description, lang) {
  const shortDesc = description ? description.slice(0, 10000) : "";
  return requestOpenRouter(`
    Translate this GitHub Issue to ${lang}.

    Technical Title: "${technicalTitle}"
    Description (Markdown):
    """
    ${shortDesc}
    """

    Remove conventional prefixes from the title and keep Markdown formatting
    in the description. The result MUST be written in ${lang}; do not copy the
    source language unless it is already ${lang}.

    Return ONLY this raw JSON shape:
    {"title":"Localized title","description":"Localized Markdown description"}
  `);
}

async function translateItemWithValidation(item) {
  // Batch translation is efficient for short issues, but long bodies can
  // exceed a single multi-language response and were previously truncated.
  const batchAttempts = item.description.length <= 700 ? 2 : 0;
  for (let attempt = 1; attempt <= batchAttempts; attempt += 1) {
    const translations = await callOpenRouter(
      item.title,
      item.description,
      attempt
    );
    const maps = extractTranslationMaps(translations);
    if (
      isUsableTranslationBundle(
        maps.titleI18n,
        maps.descriptionI18n,
        item.title,
        item.description
      )
    ) {
      return maps;
    }
    console.warn(
      `   ⚠️ Invalid translation bundle for #${item.id} (attempt ${attempt})`
    );
    await delay();
  }

  // A per-language fallback is slower, but it prevents a batch response that
  // repeats the source text five times from poisoning the persistent cache.
  const translations = {};
  for (const lang of LANGUAGES) {
    const localized = await callOpenRouterForLanguage(
      item.title,
      item.description,
      lang
    );
    if (localized && typeof localized === "object") {
      translations[lang] = localized;
    }
    await delay();
  }

  const maps = extractTranslationMaps(translations);
  return isUsableTranslationBundle(
    maps.titleI18n,
    maps.descriptionI18n,
    item.title,
    item.description
  )
    ? maps
    : null;
}

// --- Main ---

async function main() {
  console.log("🚀 Starting Roadmap Generation...");

  // 1. Load Cache (NEW FORMAT: requires both title_i18n AND description_i18n)
  let translationCache = {};
  const CACHE_FILE = "roadmap.cache.json";

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      // Cache format: { [id]: { original_title, original_desc_hash, title_i18n, description_i18n } }
      translationCache = cacheData;
      console.log(
        `📦 Loaded MASTER CACHE: ${Object.keys(translationCache).length} items`
      );
    } catch (e) {
      console.warn("Master cache load failed, will re-translate all");
    }
  } else if (fs.existsSync("roadmap.json")) {
    // Migration: Try loading from legacy roadmap.json but mark all for re-translation
    console.log(
      "⚠️ No master cache found. Will translate all items from scratch."
    );
  }

  // 2. Fetch from GitHub
  const result = await graphql(QUERY, {
    login: ORG_NAME,
    number: PROJECT_NUMBER,
  });
  const nodes = result.data?.organization?.projectV2?.items?.nodes || [];
  console.log(`📥 Fetched ${nodes.length} items from GitHub`);

  const items = [];

  for (const node of nodes) {
    const item = createRoadmapItemFromProjectNode(node, translationCache);
    if (!item) continue;
    process.stdout.write(item._needs_ai ? "!" : ".");
    items.push(item);
  }
  console.log("\n");

  // 3. Process with AI
  // Status synchronization must never wait for optional AI translation. A
  // normal run publishes cached translations when they are valid and falls
  // back to the issue's source text otherwise. Translation repair is an
  // explicit maintenance operation started through workflow_dispatch.
  const translateMissing = shouldTranslateMissing();
  const itemsToProcess = translateMissing
    ? items.filter((i) => i._needs_ai)
    : [];
  if (translateMissing) {
    console.log(`🤖 Processing ${itemsToProcess.length} items with OpenRouter...`);
  } else {
    console.log(
      "⏭️ AI translation disabled for this sync; publishing source-text fallbacks immediately"
    );
  }

  for (const item of itemsToProcess) {
    console.log(`   > Translating #${item.id}: ${item.title}`);
    try {
      const translations = await translateItemWithValidation(item);
      if (translations) {
        item.friendly_title =
          translations.titleI18n["pt-BR"] ||
          translations.titleI18n["en-US"] ||
          item.title;
        item.title_i18n = translations.titleI18n;
        item.description_i18n = translations.descriptionI18n;
      } else {
        console.error(
          `   ❌ Translation validation failed for #${item.id}; keeping it out of the publishable output`
        );
      }
      await delay();
    } catch (err) {
      console.error(`   ❌ Failed #${item.id}:`, err.message);
    }
  }

  const invalidTranslationIds = items
    .filter(
      (item) =>
        !isUsableTranslationBundle(
          item.title_i18n,
          item.description_i18n,
          item.title,
          item.description
        )
    )
    .map((item) => item.id);
  if (invalidTranslationIds.length > 0) {
    console.warn(
      `⚠️ Publishing source-text fallbacks for issues without valid translations: ${invalidTranslationIds.join(", ")}`
    );
  }

  // 3.5. Update and Save Master Cache
  const newCache = {};
  for (const item of items) {
    if (item.title_i18n && item.description_i18n) {
      newCache[item.id] = {
        original_title: item.title,
        original_desc_hash: item._original_desc_hash,
        title_i18n: item.title_i18n,
        description_i18n: item.description_i18n,
      };
    }
    // Clean internal fields
    delete item._needs_ai;
    delete item._original_desc_hash;

    // Compute friendly_title for backward compatibility
    if (item.title_i18n) {
      item.friendly_title =
        item.title_i18n["pt-BR"] ||
        item.title_i18n["en-US"] ||
        Object.values(item.title_i18n)[0] ||
        item.title;
    }
  }

  fs.writeFileSync("roadmap.cache.json", JSON.stringify(newCache, null, 2));
  console.log(`💾 Saved MASTER CACHE: ${Object.keys(newCache).length} items`);

  // 4. Use GitHub natural order (preserves project view order)
  // No manual sort here to keep GitHub sequence

  // 5. Generate Output Files (One per language)
  const now = new Date().toISOString();

  for (const lang of LANGUAGES) {
    const localizedItems = items.map((i) => createItemForLang(i, lang));

    const output = {
      version: "2.1.0",
      generated_at: now,
      lang: lang,
      source: {
        owner: ORG_NAME,
        repo: "downkingo",
        project_number: PROJECT_NUMBER,
      },
      items: localizedItems,
    };

    const fileName = `roadmap.${lang}.json`;
    fs.writeFileSync(fileName, JSON.stringify(output, null, 2));
    console.log(`✅ Generated ${fileName}`);
  }

  // Generate Default 'roadmap.json' (Copy of pt-BR for backward compatibility)
  // This ensures v1/v2 apps don't break
  const defaultItems = items.map((i) => createItemForLang(i, "pt-BR"));
  const defaultOutput = {
    version: "2.1.0",
    generated_at: now,
    source: {
      owner: ORG_NAME,
      repo: "downkingo",
      project_number: PROJECT_NUMBER,
    },
    items: defaultItems,
  };
  fs.writeFileSync("roadmap.json", JSON.stringify(defaultOutput, null, 2));
  console.log(`✅ Generated roadmap.json (Default/Legacy)`);

  // Meta file
  const meta = {
    version: "2.1.0",
    generated_at: now,
    items_count: items.length,
    languages: LANGUAGES,
  };
  fs.writeFileSync("roadmap.meta.json", JSON.stringify(meta, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  LANGUAGES,
  createItemForLang,
  createRoadmapItemFromProjectNode,
  extractTranslationMaps,
  hashDescription,
  isUsableTranslationBundle,
  resolveStatus,
  shouldTranslateMissing,
};
