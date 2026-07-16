const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const {
  OPENROUTER_MODEL,
  GENERATION_CONFIG_RELEASE_NOTES,
  OPENROUTER_API_URL,
} = require("./ai-config");

// Config
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME; // e.g., v2.0.1

async function generateNotes() {
  console.log(`🚀 Generating release notes for ${GITHUB_REF_NAME}...`);

  let commits = "";
  try {
    // 1. Get previous tag
    const previousTag = getPreviousTag();
    console.log(`📋 Comparing with previous tag: ${previousTag}`);

    // 2. Get commits between tags
    commits = getCommits(previousTag, GITHUB_REF_NAME);
    if (!commits) {
      console.log("⚠️ No commits found");
      commits = "Initial release";
    }

    // 3. Generate content with OpenRouter when configured. Release publishing
    // must not depend on the availability or rate limit of an external AI API.
    const releaseNotes = OPENROUTER_API_KEY
      ? await askOpenRouter(commits, GITHUB_REF_NAME)
      : createFallbackNotes(commits, GITHUB_REF_NAME);

    if (!OPENROUTER_API_KEY) {
      console.warn(
        "⚠️ OPENROUTER_API_KEY is missing; using commit-based release notes",
      );
    }

    // Output for GitHub Action
    console.log("📝 Generated Notes:");
    console.log(releaseNotes);

    fs.writeFileSync("RELEASE_NOTES.md", releaseNotes);
  } catch (error) {
    console.error("❌ Error generating notes:", error);
    fs.writeFileSync(
      "RELEASE_NOTES.md",
      createFallbackNotes(commits || "Bug fixes and improvements.", GITHUB_REF_NAME),
    );
  }
}

function createFallbackNotes(commits, version) {
  const bullets = commits
    .split("\n")
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
  return `## ${version || "DownKingo"}\n\n${bullets}`;
}

function getPreviousTag() {
  try {
    // Get list of tags, sort by creation date desc
    // This assumes we are in a git repo with history fetched
    const tags = execSync("git tag --sort=-creatordate")
      .toString()
      .trim()
      .split("\n");
    // Find current tag index
    const currentIndex = tags.indexOf(GITHUB_REF_NAME);
    // Return next tag (which is previous in time) or HEAD~1 if no tags
    return tags[currentIndex + 1] || null;
  } catch (e) {
    console.warn(
      "⚠️ Failed to get previous tag via git, assuming initial release or fetch depth issue"
    );
    return null;
  }
}

function getCommits(from, to) {
  try {
    const range = from ? `${from}..${to}` : to;
    // Format: hash | author | message
    const log = execSync(
      `git log ${range} --pretty=format:"%h | %an | %s"`
    ).toString();
    return log;
  } catch (e) {
    console.warn("⚠️ Failed to get git log");
    return null;
  }
}

function callOpenRouter(prompt) {
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: GENERATION_CONFIG_RELEASE_NOTES.temperature,
    max_tokens: GENERATION_CONFIG_RELEASE_NOTES.max_tokens,
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
          "X-Title": "DownKingo Release Notes",
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error(
              `OpenRouter returned HTTP ${res.statusCode}; using commit-based notes`,
            );
            return resolve(null);
          }
          try {
            const json = JSON.parse(responseBody);
            const text = json.choices?.[0]?.message?.content;
            resolve(text || null);
          } catch (e) {
            console.error("OpenRouter Parse Error:", e);
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

async function askOpenRouter(commits, version) {
  const prompt = `
    Persona: You are a Visionary Product Manager and Elite Tech Marketer for DownKingo (a premium video downloader app).
    Goal: Create engaging, high-impact release notes in a multilingual JSON format suitable for parsing by the application.

    Context:
    Version: ${version}
    Commits:
    ${commits}

    Style Guidelines:
    1. **Vibe**: Clean, Minimalist, and Professional. Focus on readability and structure.
    2. **Language**: Clear and direct. Use active voice.
    3. **Formatting**: Use bullet points for easy scanning. Add empty lines between sections.
    4. **Structure**:
       ### ⚡ Highlights
       (Top 1-2 major features)

       ### 🛠️ Improvements
       (Refinements and optimizations)

       ### 🛡️ Fixes
       (Bug fixes and stability)

    Output Format (Critical):
    Return ONLY a valid, raw JSON object (no markdown fencing like \`\`\`json).
    Matches this schema:
    {
      "pt-BR": "Markdown string...",
      "en-US": "Markdown string...",
      "es-ES": "Markdown string..."
    }
  `;

  /*
     The model returns a JSON string. We want to output:
     1. The Visible Fallback (pt-BR)
     2. The Hidden JSON payload for smart clients
  */

  const text = await callOpenRouter(prompt);
  if (!text) {
    console.error("OpenRouter returned no content, falling back to raw commits");
    return createFallbackNotes(commits, version);
  }

  // Cleanup
  const cleanText = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const json = JSON.parse(cleanText);

    // Fallback content (pt-BR)
    const visibleContent = json["pt-BR"] || Object.values(json)[0];

    // Hidden Payload
    const hiddenPayload = `<!-- JSON_I18N: ${JSON.stringify(json)} -->`;

    return `${visibleContent}\n\n${hiddenPayload}`;
  } catch (e) {
    console.error("Failed to parse OpenRouter JSON output, returning raw text", e);
    return cleanText; // Fail safe
  }
}

generateNotes();
