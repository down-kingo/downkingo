const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveStatus } = require("./generate_roadmap");

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
