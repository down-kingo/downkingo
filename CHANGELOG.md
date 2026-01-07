# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.0.0-beta] - 2025-01-07

### 🚀 Principais Novidades

- **Reescrita Completa**: Arquitetura refinada para maior performance e manutenibilidade.
- **SQLite Database**: Persistência robusta para histórico e fila de downloads.
- **Roadmap Build-in-Public**: Visualize e vote em features futuras direto pelo app.
- **Autenticação GitHub**: Login via Device Flow para interagir com o roadmap.

### ✨ Adicionado

- **Clipboard Monitor V2**: Detecção inteligente de links com "Adaptive Backoff" para economizar CPU.
- **Internacionalização (i18n)**: Suporte completo a Português (Brasil) e English (US).
- **Tema Escuro/Claro**: Alternância automática baseada no sistema ou manual.
- **Histórico Persistente**: Downloads concluídos agora são salvos no banco de dados.
- **Configurações Avançadas**: Painel de configurações para personalizar diretórios e qualidade.
- **Deep Linking**: Suporte para abrir o app via links `downkingo://`.

### 🛠️ Técnico

- Migração de armazenamento JSON simples para SQLite (`modernc.org/sqlite`).
- Arquitetura híbrida para o Roadmap (CDN para leitura, API direta para escrita).
- Refatoração do sistema de tratamento de erros (`appError`).

---

## [1.0.0] - 2024-12-28

### Adicionado

- 🎬 Download de vídeos do YouTube e outras plataformas.
- 🎵 Conversão para MP3 com alta qualidade.
- 📦 Instaladores nativos para Windows (NSIS), macOS (DMG) e Linux (AppImage).
- 🚀 Binários sidecar (ffmpeg + yt-dlp) empacotados.
- 📊 Interface básica com fila de downloads.
- 🔄 Sistema de auto-update via GitHub Releases.

---

[2.0.0-beta]: https://github.com/Capman002/DownKingo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Capman002/DownKingo/releases/tag/v1.0.0
