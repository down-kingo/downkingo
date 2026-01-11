/**
 * ====================================
 * 🤖 AI Configuration - DownKingo
 * ====================================
 *
 * Configuração centralizada para todos os modelos de IA.
 * Altere os valores aqui para atualizar todos os scripts.
 *
 * @see https://ai.google.dev/gemini-api/docs/models
 */

// ═══════════════════════════════════════════════════════════════════
// 🎯 MODELOS GEMINI
// ═══════════════════════════════════════════════════════════════════

/**
 * Modelo para geração de Release Notes
 * Requer: Alta qualidade de escrita, criatividade
 * Recomendado: gemini-3-flash-preview
 */
const GEMINI_MODEL_RELEASE_NOTES = "gemini-3-flash-preview";

/**
 * Modelo para tradução de Roadmap
 * Requer: Rápido, eficiente, bom custo-benefício
 * Recomendado: gemini-3-flash-preview
 */
const GEMINI_MODEL_ROADMAP = "gemini-3-flash-preview";

// ═══════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES DE GERAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Configurações de geração para Release Notes
 */
const GENERATION_CONFIG_RELEASE_NOTES = {
  temperature: 0.7, // Mais criativo
  maxOutputTokens: 4096,
};

/**
 * Configurações de geração para Roadmap/Traduções
 */
const GENERATION_CONFIG_ROADMAP = {
  temperature: 0.3, // Mais preciso/determinístico
  maxOutputTokens: 4000,
};

// ═══════════════════════════════════════════════════════════════════
// 🌐 API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Base URL para API REST do Gemini
 * Usado quando não se usa a SDK oficial
 */
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Monta a URL completa para chamada REST do Gemini
 * @param {string} model - Nome do modelo
 * @param {string} apiKey - Chave da API
 * @returns {string} URL completa
 */
function getGeminiRestUrl(model, apiKey) {
  return `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
}

// ═══════════════════════════════════════════════════════════════════
// 🔧 RATE LIMITING
// ═══════════════════════════════════════════════════════════════════

/**
 * Delay entre requisições (em ms) para evitar rate limiting
 * Ajuste conforme seu tier de API
 */
const RATE_LIMIT_DELAY_MS = 2000;

/**
 * Helper para aplicar delay entre requisições
 * @param {number} ms - Milissegundos (usa RATE_LIMIT_DELAY_MS se não especificado)
 */
function delay(ms = RATE_LIMIT_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Modelos
  GEMINI_MODEL_RELEASE_NOTES,
  GEMINI_MODEL_ROADMAP,

  // Configurações de geração
  GENERATION_CONFIG_RELEASE_NOTES,
  GENERATION_CONFIG_ROADMAP,

  // API
  GEMINI_API_BASE_URL,
  getGeminiRestUrl,

  // Rate Limiting
  RATE_LIMIT_DELAY_MS,
  delay,
};
