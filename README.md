<p align="center">
  <strong>🇺🇸 English</strong> | <a href="README-pt.md">🇧🇷 Português</a>
</p>

<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>A modern, cross-platform media companion for Windows, macOS, and Linux.</strong>
</p>

<p align="center">
  Built with Go. Designed for speed.
</p>

<p align="center">
  <a href="https://github.com/down-kingo/downkingo/releases/latest">
    <img src="https://img.shields.io/github/v/release/down-kingo/downkingo?style=for-the-badge&color=E11D48&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/down-kingo/downkingo/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/down-kingo/downkingo/release.yml?style=for-the-badge&label=Build&logo=github-actions" alt="Build Status">
  </a>
  <a href="https://github.com/down-kingo/downkingo/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/down-kingo/downkingo?style=for-the-badge&color=E11D48" alt="License">
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

## 🎯 About

DownKingo is a complete rewrite focused on performance, design, and user experience. It combines the robustness of **Go** on the backend with the flexibility of **React** on the frontend.

### Why DownKingo?

- **Zero Config**: FFmpeg and yt-dlp come pre-bundled.
- **CDN-First**: Roadmap and metadata loaded via CDN for instant performance.
- **SQLite**: Robust persistence for history and queue.
- **Ecosystem**: Native GitHub integration for authentication, updates, and feedback.

---

## ✨ Features

### Core

- 🎬 **Universal Download** — YouTube, Instagram, TikTok, Twitter, and 1000+ sites.
- 🎵 **Smart Conversion** — Audio extraction (MP3/M4A) with automatic metadata.
- 📋 **Clipboard Monitor** — Automatically detects copied links.
- 🚀 **Concurrent Queue** — Multiple simultaneous downloads with high speed.

### Experience

- 🌓 **Dark/Light Theme** — Modern fluid interface with smooth transitions.
- 🌐 **Internationalization** — Native support for English and Portuguese.
- 🗺️ **Interactive Roadmap** — Vote on features and track development within the app.
- ⚡ **Auto-Update** — Silent and secure background updates.

---

## 📥 Installation

| Platform    | Download                                                                                                                                                                |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | [![Windows](https://img.shields.io/badge/Download-.exe-0078D4?style=flat-square&logo=windows)](https://github.com/down-kingo/downkingo/releases/latest)                  |
| **Linux**   | [![Linux](https://img.shields.io/badge/Download-.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/down-kingo/downkingo/releases/latest) |
| **macOS**   | _Coming Soon_                                                                                                                                                           |

---

## 🛠️ Development

### Prerequisites

- **Go 1.21+**
- **Bun** (Fast JS Runtime)
- **Wails v2** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

# Install frontend dependencies
cd frontend && bun install && cd ..

# Run in development mode
wails dev
```

### Project Structure

```
├── internal/           # Backend logic (Go)
│   ├── auth/           # OAuth2 Device Flow
│   ├── downloader/     # Queue manager and yt-dlp wrapper
│   ├── roadmap/        # "Build in Public" integration
│   └── storage/        # SQLite layer
├── frontend/           # UI (React + Tailwind)
└── build/              # Build resources
```

---

## 🗺️ Roadmap

- [x] v2 Architecture (Wails + React)
- [x] SQLite Persistence
- [x] Smart Clipboard Monitor
- [x] Internationalization (i18n)
- [x] Auto-Update System
- [ ] Playlist Downloads
- [ ] Browser Extension
- [ ] Plugin Support

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a Pull Request.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
