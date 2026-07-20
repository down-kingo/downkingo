/**
 * ====================================
 * 🤖 AI Configuration - DownKingo
 * ====================================
 *
 * Configuração centralizada para todos os modelos de IA.
 * Altere os valores aqui para atualizar todos os scripts.
 *
 * @see https://openrouter.ai/docs
 */

// ═══════════════════════════════════════════════════════════════════
// 🎯 MODELOS (via OpenRouter)
// ═══════════════════════════════════════════════════════════════════

/**
 * Modelo usado para Release Notes e tradução de Roadmap
 */
const OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

// ═══════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES DE GERAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Configurações de geração para Release Notes
 */
const GENERATION_CONFIG_RELEASE_NOTES = {
  temperature: 0.7, // Mais criativo
  max_tokens: 4096,
};

/**
 * Configurações de geração para Roadmap/Traduções
 */
const GENERATION_CONFIG_ROADMAP = {
  temperature: 0.3, // Mais preciso/determinístico
  max_tokens: 4000,
};

// ═══════════════════════════════════════════════════════════════════
// 🌐 API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Endpoint de Chat Completions da OpenRouter (formato compatível com OpenAI)
 */
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  OPENROUTER_MODEL,

  // Configurações de geração
  GENERATION_CONFIG_RELEASE_NOTES,
  GENERATION_CONFIG_ROADMAP,

  // API
  OPENROUTER_API_URL,

  // Rate Limiting
  RATE_LIMIT_DELAY_MS,
  delay,
};
