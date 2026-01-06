const fs = require("fs");
const https = require("https");

// --- Configuration ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ORG_NAME = process.env.ORG_NAME || "down-kingo";
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER || "2");

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
                state
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

async function callGemini(technicalTitle, description) {
  const languages = ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE"];

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
    3. Provide translations for: ${languages.join(", ")}.
    4. RETURN ONLY RAW VALID JSON. No Markdown block. No explanation.

    === EXPECTED JSON FORMAT ===
    {
      "pt-BR": { "title": "Título em Português", "description": "Descrição traduzida..." },
      "en-US": { "title": "Title in English", "description": "Translated description..." },
      "es-ES": { "title": "Título en Español", "description": "Descripción traducida..." },
      "fr-FR": { "title": "Titre en Français", "description": "Description traduite..." },
      "de-DE": { "title": "Titel auf Deutsch", "description": "Übersetzte Beschreibung..." }
    }
  `;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(responseBody);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return resolve(null);

            // Clean markdown code blocks if present
            const cleanJson = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            resolve(JSON.parse(cleanJson));
          } catch (e) {
            console.error("Gemini Parse Error:", e);
            console.error("Raw Response:", responseBody.slice(0, 500));
            resolve(null);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// --- Main ---

async function main() {
  console.log("🚀 Starting Roadmap Generation...");

  // 1. Load Cache
  let titleCache = {};
  if (fs.existsSync("roadmap.json")) {
    try {
      const oldData = JSON.parse(fs.readFileSync("roadmap.json", "utf8"));
      (oldData.items || []).forEach((item) => {
        if (item.friendly_title && typeof item.friendly_title === "object") {
          titleCache[item.id] = {
            original_title: item.title, // store original to detect changes
            friendly_title: item.friendly_title,
          };
        }
      });
      console.log(`📦 Loaded cache: ${Object.keys(titleCache).length} items`);
    } catch (e) {
      console.warn("Cache load failed or empty");
    }
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
    const c = node.content;
    if (!c || !c.number) continue;

    const statusName = node.fieldValueByName?.name?.toLowerCase() || "idea";
    const status = STATUS_MAPPING[statusName] || "idea";

    // Check Cache
    const cached = titleCache[c.number];
    let friendly_title = null;
    let needsAi = false;

    if (cached && cached.original_title === c.title) {
      friendly_title = cached.friendly_title;
      process.stdout.write("."); // Dot progress for cache hit
    } else {
      needsAi = true;
      process.stdout.write("!"); // Exclamation for new/changed
    }

    items.push({
      id: c.number,
      title: c.title,
      friendly_title, // null if needs AI
      description: c.body || "",
      status,
      votes: c.reactions.totalCount || 0,
      votes_up: c.reactions.totalCount || 0,
      votes_down: c.reactions_down.totalCount || 0,
      comments: c.comments.totalCount || 0,
      url: c.url,
      labels: (c.labels.nodes || []).map((l) => l.name),
      author: c.author?.login || "",
      author_avatar: c.author?.avatarUrl || "",
      created_at: c.createdAt,
      shipped_at: c.state === "CLOSED" ? c.closedAt : null,
      _needs_ai: needsAi,
    });
  }
  console.log("\n");

  // 3. Process with AI
  const itemsToProcess = items.filter((i) => i._needs_ai);
  console.log(`🤖 Processing ${itemsToProcess.length} items with Gemini...`);

  for (const item of itemsToProcess) {
    console.log(`   > Translating #${item.id}: ${item.title}`);
    try {
      // NEW: Pass both title and description for translation
      const translations = await callGemini(item.title, item.description);
      if (translations) {
        // translations format: { "pt-BR": { title: "...", description: "..." }, ... }

        // Extract title translations for backward compatibility
        const titleI18n = {};
        const descI18n = {};

        for (const [lang, content] of Object.entries(translations)) {
          if (content && typeof content === "object") {
            titleI18n[lang] = content.title || item.title;
            descI18n[lang] = content.description || item.description;
          }
        }

        // BACKWARD COMPATIBILITY: friendly_title as string (pt-BR default)
        item.friendly_title =
          titleI18n["pt-BR"] ||
          titleI18n["en-US"] ||
          Object.values(titleI18n)[0] ||
          item.title;

        item.title_i18n = titleI18n;
        item.description_i18n = descI18n;
      } else {
        // Fallback - no translation available
        const fallback = item.title.replace(
          /^(feat|fix|chore|docs|refactor|style|test|ci)\([^)]*\):\s*/i,
          ""
        );
        item.friendly_title = fallback;
        item.title_i18n = { "en-US": fallback, "pt-BR": fallback };
        item.description_i18n = {
          "en-US": item.description,
          "pt-BR": item.description,
        };
      }
      // Rate limiting - increased due to larger payload
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`   ❌ Failed #${item.id}:`, err.message);
    }
    delete item._needs_ai;
  }

  // 4. Sort
  items.sort((a, b) => {
    if (a.status === "shipped" && b.status === "shipped") return b.id - a.id;
    if (a.status === "shipped") return 1;
    if (b.status === "shipped") return -1;
    return b.votes - a.votes;
  });

  // 5. Generate Output Files (One per language)
  const languages = ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE"];
  const now = new Date().toISOString();

  // Helper to create item for specific lang
  const createItemForLang = (item, lang) => {
    // Get translated title or fallback
    let displayTitle = item.title; // default technical
    let displayDescription = item.description; // default original

    if (item.title_i18n && item.title_i18n[lang]) {
      displayTitle = item.title_i18n[lang];
    } else if (item.friendly_title && typeof item.friendly_title === "string") {
      // Legacy cache/fallback
      displayTitle = item.friendly_title;
    }

    // Get translated description
    if (item.description_i18n && item.description_i18n[lang]) {
      displayDescription = item.description_i18n[lang];
    }

    return {
      ...item,
      friendly_title: displayTitle, // Simple string for title
      description: displayDescription, // Translated description
      // Remove internal/bulk fields to keep payload clean
      title_i18n: undefined,
      description_i18n: undefined,
      _needs_ai: undefined,
    };
  };

  for (const lang of languages) {
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
    languages: languages,
  };
  fs.writeFileSync("roadmap.meta.json", JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
