# 🛣️ Roadmap Service Architecture

Este documento descreve a arquitetura **"Static Generation Multi-Language" (SGML)** utilizada no roadmap do DownKingo.

## 🏗️ Conceito

Para garantir zero latência e uma experiência nativa, o roadmap **não** é traduzido em tempo real pelo navegador do usuário. Em vez disso, pré-processamos todas as traduções durante o build/sync.

1.  **Fonte**: GitHub Projects V2 (onde criamos os cards).
2.  **Processador**: GitHub Actions + Script Node.js + Gemini Flash Lite.
3.  **Output**: JSON estático (`roadmap.json`) hospedado na CDN (Cloudflare Pages).
4.  **Consumo**: O App busca o JSON e exibe o título no idioma do usuário instantaneamente.

---

## 🤖 O Gerador (`.github/scripts/generate_roadmap.js`)

Este script substituiu o antigo fluxo complexo de `jq/bash`. Ele faz:

1.  **Cache Inteligente**: Lê o `roadmap.json` anterior para não re-traduzir items inalterados (economiza tokens AI e tempo).
2.  **Tradução via Gemini**: Para novos itens, chama a API do Gemini pedindo um JSON com traduções para `pt-BR`, `en-US`, `es-ES`, `de-DE`, `fr-FR`.
3.  **Fallback**: Se a AI falhar, limpa o título técnico (remove `feat:`, `fix:`) e usa como fallback.
4.  **Estrutura de Dados**: Salva o título traduzido no campo `friendly_title` como um objeto:

```json
{
  "id": 123,
  "title": "feat: dark mode support",
  "friendly_title": {
    "pt-BR": "Suporte a Modo Escuro",
    "en-US": "Dark Mode Support",
    "es-ES": "Soporte de Modo Oscuro"
    // ...
  }
}
```

---

## 🔄 Fluxo de Atualização

O workflow `roadmap-sync.yml` roda a cada 30 minutos ou quando uma issue é editada. Ele commita o novo JSON direto na branch `roadmap-data`, que a Cloudflare Pages publica automaticamente.

## 🖥️ Frontend & Backend

- **Backend (Go)**: O struct `RoadmapItem` mapeia `FriendlyTitle` como `map[string]string`. Ele apenas repassa o JSON da CDN para o frontend.
- **Frontend (React)**: O componente `RoadmapCard` detecta o idioma atual (`i18n.language`) e busca a chave correspondente no objeto.
  - Ex: `item.friendly_title['pt-BR']`
  - Se não houver tradução para o idioma, tenta `en-US` ou `pt-BR` como fallback.

## 🚀 Como Manter

- **Adicionar Idioma**: Basta incluir a sigla no array `languages` dentro do script `generate_roadmap.js`.
- **Mudar Prompt**: Edite a variável `prompt` no script para ajustar o tom de voz.
