const { GoogleGenerativeAI } = require("@google/generative-ai");
const { execSync } = require("child_process");

// Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME; // e.g., v2.0.1
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO_NAME = process.env.GITHUB_REPOSITORY.split("/")[1];

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function generateNotes() {
  console.log(`🚀 Generating release notes for ${GITHUB_REF_NAME}...`);

  try {
    // 1. Get previous tag
    const previousTag = getPreviousTag();
    console.log(`📋 Comparing with previous tag: ${previousTag}`);

    // 2. Get commits between tags
    const commits = getCommits(previousTag, GITHUB_REF_NAME);
    if (!commits) {
      console.log("⚠️ No commits found");
      return "Initial Release";
    }

    // 3. Generate content with Gemini
    const releaseNotes = await askGemini(commits, GITHUB_REF_NAME);

    // Output for GitHub Action
    console.log("📝 Generated Notes:");
    console.log(releaseNotes);

    // Save to file allows the action to read it
    const fs = require("fs");
    fs.writeFileSync("RELEASE_NOTES.md", releaseNotes);
  } catch (error) {
    console.error("❌ Error generating notes:", error);
    process.exit(1);
  }
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

async function askGemini(commits, version) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    You are a Technical Writer for the DownKingo project (a video downloader app based on Wails/Go + React).
    
    Create engaging and well-structured release notes for version ${version} based on these commits:
    
    ${commits}
    
    **Guidelines:**
    1. **Structure:**
       - 🚀 **Highlights** (New features, big changes)
       - 🐛 **Bug Fixes** (Corrections)
       - 🛠️ **Under the Hood** (Refactoring, deps, docs)
    2. **Tone:** Professional yet excited. Use emojis.
    3. **Language:** Brazilian Portuguese (pt-BR).
    4. **Formatting:** Markdown. Use bullets.
    5. **Exclusions:** Ignore chore commits like "bump version", "merge branch", or "CI" unless critical.
    6. **Summary:** Start with a 1-sentence catchy summary of this release.
    
    Output ONLY the markdown content, no extra talk.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

generateNotes();
