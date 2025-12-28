# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planejado

- Suporte a download de playlists
- Seletor de qualidade de vídeo
- Histórico de downloads persistente
- Tema Escuro (Dark Mode)
- Internacionalização (i18n)

---

## [1.0.0] - 2024-12-28

### Adicionado

- 🎬 Download de vídeos do YouTube e outras plataformas
- 🎵 Conversão para MP3 com alta qualidade
- 📦 Instaladores nativos para Windows (NSIS), macOS (DMG) e Linux (AppImage)
- 🚀 Binários sidecar (ffmpeg + yt-dlp) empacotados - zero configuração
- 📊 Interface com fila de downloads e progresso em tempo real
- 🔄 Sistema de auto-update via GitHub Releases
- 📝 Logging estruturado com zerolog
- 🛡️ Context propagation para cancelamento correto de operações

### Técnico

- Backend em Go com Wails v2
- Frontend em React + TypeScript + Tailwind CSS
- Pipeline CI/CD com GitHub Actions
- Detecção inteligente de binários sidecar por plataforma

---

[Unreleased]: https://github.com/Capman002/kinematic/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Capman002/kinematic/releases/tag/v1.0.0
