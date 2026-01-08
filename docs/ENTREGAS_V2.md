# 🎉 Entregas v2.0.0 - Build in Public

> Issues para criar no GitHub Projects e mover para **"No Ar"**

---

## 🏗️ Arquitetura & Core

### 1. feat(core): Reescrita Completa da Arquitetura

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Arquitetura refinada para maior performance e manutenibilidade. Separação clara de responsabilidades entre camadas.

---

### 2. feat(storage): Migração para SQLite

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Persistência robusta substituindo armazenamento JSON por SQLite (`modernc.org/sqlite`). Suporte a histórico, fila de downloads e configurações.

---

### 3. feat(core): Sistema de Erros Tipados

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Refatoração completa do tratamento de erros com `appError`. Erros categorizados e mensagens amigáveis ao usuário.

---

### 4. feat(download): Suporte a Aria2c

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Motor de download alternativo via Aria2c para maior velocidade, estabilidade e suporte a downloads segmentados.

---

## 🎬 Download & Vídeo

### 5. feat(download): Melhorias no Downloader de Vídeo

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Performance e estabilidade aprimoradas no download de vídeos. Suporte a mais plataformas e melhor tratamento de erros.

---

### 6. feat(ui): Terminal Integrado

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Visualização em tempo real do progresso e logs do download. Interface estilo terminal com output colorido e interativo.

---

### 7. feat(download): Download de Imagens

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Suporte para baixar imagens de plataformas compatíveis. Detecção automática de URLs de imagem.

---

### 8. feat(history): Histórico Persistente

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Downloads concluídos salvos no banco de dados SQLite. Visualização do histórico com opção de reabrir arquivos.

---

## 🔄 Conversores de Mídia

### 9. feat(converter): Conversor de Vídeo

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Conversão entre formatos de vídeo (MP4, MKV, WEBM, AVI, MOV). Suporte a codecs modernos e configuração de qualidade.

---

### 10. feat(converter): Conversor de Áudio

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Extração e conversão de áudio (MP3, AAC, FLAC, WAV, OGG). Configuração de bitrate e qualidade.

---

### 11. feat(converter): Conversor de Imagens

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Conversão entre formatos de imagem (PNG, JPG, WEBP, GIF). Compressão e redimensionamento opcional.

---

## 🌍 Internacionalização & Roadmap

### 12. feat(i18n): Suporte a 5 Idiomas

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Internacionalização completa com suporte a:

- 🇧🇷 Português (Brasil)
- 🇺🇸 English (US)
- 🇪🇸 Español
- 🇫🇷 Français
- 🇩🇪 Deutsch

---

### 13. feat(roadmap): Build-in-Public com Votação

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Visualize e vote em features futuras direto pelo app. Arquitetura híbrida: CDN para leitura rápida, API para escrita.

---

### 14. feat(auth): Login via GitHub Device Flow

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Autenticação segura via GitHub Device Flow para interagir com o roadmap e votar em sugestões.

---

### 15. feat(roadmap): Modal de Sugestões

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Envie sugestões de features direto pelo app. Integração com GitHub Issues para transparência.

---

## 🎨 Interface & Aparência

### 16. feat(ui): Tema Claro/Escuro

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Alternância automática (baseada no sistema) ou manual entre temas claro e escuro.

---

### 17. feat(ui): Customização de Aparência

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Personalização avançada: cores de destaque (accent color), bordas, transparência, densidade visual e mais.

---

### 18. feat(ux): Onboarding Interativo

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Fluxo de boas-vindas com configuração inicial: seleção de idioma, tema e aceite de disclaimer.

---

### 19. feat(ui): Toast de Clipboard

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Feedback visual quando links são detectados na área de transferência. Ação rápida para iniciar download.

---

## ⚙️ Configurações Completas

### 20. feat(settings): Configurações Gerais

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Painel de configurações para diretórios de download, idioma, comportamento do app e integração com sistema.

---

### 21. feat(settings): Configurações de Vídeo

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Qualidade padrão, formato preferido, codecs, legendas automáticas e opções de download.

---

### 22. feat(settings): Configurações de Imagem

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Formato de saída padrão, qualidade de compressão e opções de redimensionamento.

---

### 23. feat(settings): Configurações de Aparência

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Tema, accent color, densidade visual, animações e personalização da interface.

---

### 24. feat(settings): Atalhos de Teclado

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Personalização de shortcuts para ações frequentes. Visualização de atalhos disponíveis.

---

## 🔗 Outras Funcionalidades

### 25. feat(deep-link): Suporte a Links kingo://

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Abrir app via links `kingo://` e `downkingo://`. Integração com navegadores e outras aplicações.

---

### 26. feat(clipboard): Monitor V2 com Adaptive Backoff

**Labels:** `enhancement`, `v2.0.0`, `shipped`

Detecção inteligente de links com algoritmo de Adaptive Backoff para economizar CPU quando não há atividade.

---

## 📋 Resumo Rápido (Copiar & Colar)

```text
feat(core): Reescrita Completa da Arquitetura
feat(storage): Migração para SQLite
feat(core): Sistema de Erros Tipados
feat(download): Suporte a Aria2c
feat(download): Melhorias no Downloader de Vídeo
feat(ui): Terminal Integrado
feat(download): Download de Imagens
feat(history): Histórico Persistente
feat(converter): Conversor de Vídeo
feat(converter): Conversor de Áudio
feat(converter): Conversor de Imagens
feat(i18n): Suporte a 5 Idiomas
feat(roadmap): Build-in-Public com Votação
feat(auth): Login via GitHub Device Flow
feat(roadmap): Modal de Sugestões
feat(ui): Tema Claro/Escuro
feat(ui): Customização de Aparência
feat(ux): Onboarding Interativo
feat(ui): Toast de Clipboard
feat(settings): Configurações Gerais
feat(settings): Configurações de Vídeo
feat(settings): Configurações de Imagem
feat(settings): Configurações de Aparência
feat(settings): Atalhos de Teclado
feat(deep-link): Suporte a Links kingo://
feat(clipboard): Monitor V2 com Adaptive Backoff
```

---

> 💡 **Dica:** Crie cada issue, adicione as labels, feche imediatamente com "✅ Entregue na v2.0.0" e mova para "No Ar".
