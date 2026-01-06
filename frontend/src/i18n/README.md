# 🌐 DownKingo Internationalization (i18n)

This project uses a professional ("Senior Level") automated translation workflow to ensure the interface is always translated and consistent, avoiding error-prone manual JSON editing.

## 🛠️ Tech Stack

- **Core**: `i18next` + `react-i18next`
- **Extraction**: `i18next-parser` (Scans code and creates JSONs)
- **Automation**: Custom script with `@iamtraction/google-translate`
- **Quality**: `eslint-plugin-i18next` (Prevents hardcoded text in code)

---

## 📂 File Structure

Translations are located in `src/i18n/locales/{language}/{namespace}.json`.
We use **namespaces** to better organize strings:

- `common.json`: General buttons, error messages, status (used throughout the app).
- `settings.json`: Specific text for the settings screen.
- `converter.json`: Strings for the conversion tool.
- `roadmap.json`, `images.json`, etc.

**Base Language (Source of Truth):** 🇧🇷 `pt-BR` (Brazilian Portuguese).
The translation script uses Portuguese as the base to generate other languages.

---

## 🚀 Translation Workflow

### 1. Developing (Adding Text)

In your React component, never write fixed text. Use the `t()` function:

```tsx
// ❌ WRONG (Linter will complain!)
<span>Welcome to DownKingo</span>;

// ✅ CORRECT
import { useTranslation } from "react-i18next";

export function MyComponent() {
  const { t } = useTranslation("common"); // 'common' is the namespace
  return <span>{t("welcome_message")}</span>;
}
```

### 2. Extracting Keys (Automatic)

After adding `t('key')` in the code, you **do not need** to create the JSON manually. Run:

```bash
bun run i18n:extract
```

🔹 **What does this do?**

- Scans all `.tsx/.ts` source code.
- Finds all new keys.
- Creates/Updates JSON files in `src/i18n/locales` for **all** languages.
- If the key is new, it enters empty (`""`) in other languages, ready to be translated.

### 3. Translating (Automatic) 🤖

To avoid wasting time manually using Google Translate, use our translation bot:

```bash
bun run i18n:translate
```

🔹 **What does this do?**

- Reads `pt-BR` files as the base.
- Scans files for other languages (`en-US`, `es-ES`, `de-DE`, `fr-FR`).
- If it finds an empty or missing key, it **automatically translates** and fills the file.
- Saves the updated file.

### 4. Validating (CI/CD)

In our CI pipeline (Github Actions), we run:

```bash
bun run i18n:check
```

This ensures no one pushed new code without running the extraction. If there are keys in the code that are not in the JSONs, the build fails.

---

## ⚠️ Linter Rules

We have a strict rule in ESLint (`i18next/no-literal-string`).
If you try to type loose text in JSX, VS Code will underline it in red.

**To ignore (rare cases):**
If it's text that shouldn't be translated (e.g., symbols, codes), use:

```tsx
{
  /* i18next-disable-line */
}
<span>12345</span>;
```

Or add the prop to the ignore list in `.eslintrc.cjs` if it's a technical attribute (like `testId` or `animate`).
