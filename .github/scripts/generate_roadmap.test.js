const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createItemForLang,
  createRoadmapItemFromProjectNode,
  isUsableTranslationBundle,
  resolveStatus,
  shouldTranslateMissing,
} = require("./generate_roadmap");

test("roadmap status follows the GitHub Project column", () => {
  assert.equal(resolveStatus("Bastidores"), "idea");
  assert.equal(resolveStatus("Em Pauta"), "planned");
  assert.equal(resolveStatus("Em Produção"), "in-progress");
  assert.equal(resolveStatus("No Ar"), "shipped");
});

test("roadmap status normalization is case and whitespace insensitive", () => {
  assert.equal(resolveStatus("  EM PRODUÇÃO  "), "in-progress");
});

test("missing or unknown project status safely falls back to idea", () => {
  assert.equal(resolveStatus(), "idea");
  assert.equal(resolveStatus("unknown"), "idea");
});

test("AI translation repair is opt-in and cannot block a normal sync", () => {
  assert.equal(shouldTranslateMissing(undefined), false);
  assert.equal(shouldTranslateMissing("false"), false);
  assert.equal(shouldTranslateMissing("true"), true);
  assert.equal(shouldTranslateMissing("1"), true);
});

test("closed issues remain visible in their canonical Project column", () => {
  const closedIssue = createRoadmapItemFromProjectNode({
    content: {
      number: 77,
      title: "fix: closed but still in progress",
      body: "A closed issue that remains assigned to the roadmap.",
      closedAt: "2026-07-16T10:00:00Z",
      comments: { totalCount: 0 },
      reactions: { totalCount: 0 },
      reactions_down: { totalCount: 0 },
      labels: { nodes: [] },
      author: { login: "tester", avatarUrl: "" },
      createdAt: "2026-07-15T10:00:00Z",
      url: "https://github.com/down-kingo/downkingo/issues/77",
    },
    fieldValueByName: { name: "Em Produção" },
  });

  assert.ok(closedIssue);
  assert.equal(closedIssue.id, 77);
  assert.equal(closedIssue.status, "in-progress");
  assert.equal(closedIssue.shipped_at, null);
});

test("closedAt becomes release metadata only in the No Ar column", () => {
  const closedAt = "2026-07-16T10:00:00Z";
  const shippedIssue = createRoadmapItemFromProjectNode({
    content: {
      number: 78,
      title: "feat: shipped",
      body: "Released feature.",
      closedAt,
      comments: { totalCount: 0 },
      reactions: { totalCount: 0 },
      reactions_down: { totalCount: 0 },
      labels: { nodes: [] },
      createdAt: "2026-07-15T10:00:00Z",
      url: "https://github.com/down-kingo/downkingo/issues/78",
    },
    fieldValueByName: { name: "No Ar" },
  });

  assert.equal(shippedIssue.status, "shipped");
  assert.equal(shippedIssue.shipped_at, closedAt);
});

test("translation cache rejects five language keys containing the same source text", () => {
  const originalDescription =
    "## Contexto\nEsta descrição longa em português representa o defeito real que foi repetido em todos os idiomas do cache publicado.";
  const titles = {};
  const descriptions = {};
  for (const lang of ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE"]) {
    titles[lang] = "Migração Arquitetural para Wails v3";
    descriptions[lang] = originalDescription;
  }

  assert.equal(
    isUsableTranslationBundle(
      titles,
      descriptions,
      "feat(core): Migração Arquitetural para Wails v3",
      originalDescription,
    ),
    false,
  );
});

test("translation cache accepts a complete genuinely localized bundle", () => {
  const originalDescription =
    "## Contexto\nEsta descrição longa em português precisa ser traduzida corretamente antes de chegar ao aplicativo e ao CDN.";
  const titles = {
    "pt-BR": "Roadmap traduzido",
    "en-US": "Translated roadmap",
    "es-ES": "Hoja de ruta traducida",
    "fr-FR": "Feuille de route traduite",
    "de-DE": "Übersetzte Roadmap",
  };
  const descriptions = {
    "pt-BR": originalDescription,
    "en-US": "## Context\nThis long Portuguese description must be translated correctly before reaching the app and CDN.",
    "es-ES": "## Contexto\nEsta descripción larga debe traducirse correctamente antes de llegar a la aplicación y al CDN.",
    "fr-FR": "## Contexte\nCette longue description doit être traduite correctement avant d'arriver à l'application et au CDN.",
    "de-DE": "## Kontext\nDiese lange Beschreibung muss korrekt übersetzt werden, bevor sie die App und das CDN erreicht.",
  };

  assert.equal(
    isUsableTranslationBundle(
      titles,
      descriptions,
      "feat(roadmap): traduzir issues",
      originalDescription,
    ),
    true,
  );

  const localized = createItemForLang(
    {
      id: 1,
      title: "feat(roadmap): traduzir issues",
      title_i18n: titles,
      description: originalDescription,
      description_i18n: descriptions,
    },
    "en-US",
  );
  assert.equal(localized.friendly_title, "Translated roadmap");
  assert.equal(localized.description, descriptions["en-US"]);
  assert.equal(localized.title_i18n, undefined);
});

test("translation cache rejects truncated long descriptions", () => {
  const originalDescription = "Descrição completa em português. ".repeat(80);
  const titles = {
    "pt-BR": "Descrição completa",
    "en-US": "Complete description",
    "es-ES": "Descripción completa",
    "fr-FR": "Description complète",
    "de-DE": "Vollständige Beschreibung",
  };
  const descriptions = {
    "pt-BR": originalDescription,
    "en-US": "Truncated English output. ".repeat(5),
    "es-ES": "Descripción completa en español. ".repeat(80),
    "fr-FR": "Description complète en français. ".repeat(80),
    "de-DE": "Vollständige Beschreibung auf Deutsch. ".repeat(80),
  };

  assert.equal(
    isUsableTranslationBundle(
      titles,
      descriptions,
      "feat(roadmap): descrição completa",
      originalDescription,
    ),
    false,
  );
});

test("localized output falls back to source text without a valid translation", () => {
  const localized = createItemForLang(
    {
      id: 2,
      title: "Título original",
      title_i18n: null,
      description: "Descrição original",
      description_i18n: null,
    },
    "en-US",
  );

  assert.equal(localized.friendly_title, "Título original");
  assert.equal(localized.description, "Descrição original");
  assert.equal(localized.title_i18n, undefined);
  assert.equal(localized.description_i18n, undefined);
});
