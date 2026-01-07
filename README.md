<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo v2</h1>

<p align="center">
  <strong>O downloader de mídia definitivo para Windows, macOS e Linux.</strong>
</p>

<p align="center">
  Simples. Rápido. Poderoso.
</p>

<p align="center">
  <a href="https://github.com/Capman002/DownKingo/releases/latest">
    <img src="https://img.shields.io/github/v/release/Capman002/DownKingo?style=for-the-badge&color=E11D48&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/Capman002/DownKingo/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/Capman002/DownKingo/release.yml?style=for-the-badge&label=Build&logo=github-actions" alt="Build Status">
  </a>
  <a href="https://github.com/Capman002/DownKingo/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Capman002/DownKingo?style=for-the-badge&color=E11D48" alt="License">
  </a>
</p>

<p align="center">
  <a href="https://go.dev/">
    <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  </a>
  <a href="https://wails.io/">
    <img src="https://img.shields.io/badge/Wails-CF3A3A?style=for-the-badge&logo=wails&logoColor=white" alt="Wails">
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  </a>
  <a href="https://tailwindcss.com/">
    <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  </a>
</p>

---

## 🎯 Sobre o Projeto

DownKingo v2 é uma reescrita completa da versão original, focada em performance, design e experiência do usuário. Ele combina a robustez do **Go** no backend com a flexibilidade do **React** no frontend.

### Por que v2?

- **Zero Config**: FFmpeg e yt-dlp embutidos.
- **CDN-First**: Roadmap e metadados carregados via CDN para performance instantânea.
- **SQLite**: Persistência robusta para histórico e fila.
- **Ecosistema**: Integração nativa com GitHub para autenticação, updates e feedback (Build in Public).

---

## ✨ Features

### Core

- 🎬 **Download Universal**: YouTube, Instagram, TikTok, Twitter e centenas de outros.
- 🎵 **Conversão Inteligente**: Extração de áudio (MP3/M4A) com metadados automáticos.
- 📋 **Monitor de Clipboard**: Detecta links copiados automaticamente.
- 🚀 **Fila Concorrente**: Múltiplos downloads simultâneos acelerados.

### Experiência

- 🌓 **Tema Escuro/Claro**: Design moderno interface fluida.
- 🌐 **Internacionalização**: Suporte nativo a PT-BR e EN-US.
- 🗺️ **Roadmap Interativo**: Vote em features e acompanhe o desenvolvimento dentro do app.
- ⚡ **Auto-Update**: Atualizações silenciosas e seguras.

---

## 📥 Instalação

| Sistema     | Download                                                                                                                                                                |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | [![Windows](https://img.shields.io/badge/Download-.exe-0078D4?style=flat-square&logo=windows)](https://github.com/Capman002/DownKingo/releases/latest)                  |
| **Linux**   | [![Linux](https://img.shields.io/badge/Download-.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/Capman002/DownKingo/releases/latest) |
| **macOS**   | _Em breve_                                                                                                                                                              |

---

## 🛠️ Desenvolvimento

### Pré-requisitos

- **Go 1.21+**
- **Bun** (Runtime JS rápido)
- **Wails v2** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Setup

```bash
# Clone
git clone https://github.com/Capman002/DownKingo.git
cd DownKingo

# Dependências Frontend
cd frontend && bun install && cd ..

# Rodar em modo Dev
wails dev
```

### Estrutura

- `internal/`: Lógica Backend (Go)
  - `auth/`: OAuth2 Device Flow
  - `downloader/`: Gerenciador de fila e yt-dlp
  - `roadmap/`: Integração "Build in Public"
  - `storage/`: Camada SQLite
- `frontend/`: UI (React + Tailwind)

---

## 🗺️ Roadmap Atual

- [x] Arquitetura v2 (Wails + React)
- [x] Persistência SQLite
- [x] Monitor de Clipboard Inteligente
- [x] Internacionalização (i18n)
- [x] Sistema de Auto-Update
- [ ] Download de Playlists
- [ ] Extensão para Navegador
- [ ] Suporte a Plugins

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
