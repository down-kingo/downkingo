<p align="center">
  <strong>English</strong> | <a href="README-pt.md">Portugues</a>
</p>

<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>A modern, cross-platform media companion for Windows, macOS, and Linux.</strong>
</p>

<p align="center">
  Built with Go + Wails v3. Designed for speed.
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
    <img src="https://img.shields.io/badge/Go_1.25-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  </a>
  <a href="https://wails.io/">
    <img src="https://img.shields.io/badge/Wails_v3-CF3A3A?style=for-the-badge&logo=wails&logoColor=white" alt="Wails">
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  </a>
  <a href="https://tailwindcss.com/">
    <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  </a>
</p>

<p align="center">
  <a href="https://downkingo.com">
    <img src="https://img.shields.io/badge/Website-downkingo.com-E11D48?style=for-the-badge" alt="Website">
  </a>
</p>

---

## About

DownKingo is a full-featured media companion built for performance, design, and user experience. It combines the robustness of **Go** on the backend with the flexibility of **React 19** on the frontend, powered by **Wails v3** for native desktop integration.

### Why DownKingo?

- **Zero Config** — FFmpeg and yt-dlp are downloaded automatically on first launch.
- **CDN-First** — Roadmap and metadata loaded via CDN for instant performance.
- **SQLite** — Robust persistence for download history and queue.
- **5 Languages** — Full i18n support: English, Portuguese, Spanish, French, and German.
- **Ecosystem** — Native GitHub integration for authentication, updates, and community feedback.

---

## Features

### Core

- **Universal Download** — YouTube, Instagram, TikTok, Twitter, and 1000+ sites via yt-dlp.
- **Smart Conversion** — Convert video, audio, and images between formats using FFmpeg.
- **Clipboard Monitor** — Automatically detects copied links with adaptive backoff.
- **Concurrent Queue** — Multiple simultaneous downloads with worker pool (configurable concurrency).
- **Transcriber** — Audio/video transcription powered by Whisper (local, offline).

### Experience

- **Dark/Light Theme** — Modern fluid interface with accent color customization.
- **Internationalization** — Native support for 5 languages (en-US, pt-BR, es-ES, fr-FR, de-DE).
- **Interactive Roadmap** — Vote on features and track development within the app via GitHub integration.
- **Auto-Update** — Silent and secure background updates via GitHub Releases.
- **Deep Links** — Open the app via `kingo://` protocol from browsers and other apps.

---

## Installation

| Platform    | Download                                                                                                                                                                 |
| :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | [![Windows](https://img.shields.io/badge/Download-.exe-0078D4?style=flat-square&logo=windows)](https://github.com/down-kingo/downkingo/releases/latest)                  |
| **Linux**   | [![Linux](https://img.shields.io/badge/Download-.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/down-kingo/downkingo/releases/latest) |
| **macOS**   | _Coming Soon_                                                                                                                                                            |

---

## Development

### Prerequisites

- **Go 1.25+**
- **Bun** (fast JS runtime)
- **Task** (task runner) — `go install github.com/go-task/task/v3/cmd/task@latest`
- **Wails v3 CLI** — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### Quick Start

```bash
# Clone the repository
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

# Install frontend dependencies
cd frontend && bun install && cd ..

# Run in development mode
task dev

# Or build for production
task build:production
```

### Available Tasks

| Command                | Description                        |
| :--------------------- | :--------------------------------- |
| `task dev`             | Run in development mode (hot reload) |
| `task build`           | Build the Go application           |
| `task build:production`| Full production build (frontend + Go) |
| `task generate`        | Generate frontend bindings         |
| `task frontend:test`   | Run frontend tests (Vitest)        |
| `task frontend:build`  | Build frontend for production      |

### Project Structure

```
downkingo/
├── main.go                 # Wails v3 application bootstrap
├── app.go                  # App facade — all methods exposed to frontend
├── Taskfile.yml            # Task runner (replaces wails CLI)
├── VERSION                 # Semantic version (3.0.0)
├── internal/               # Backend logic (Go)
│   ├── app/                # Application paths and lifecycle
│   ├── auth/               # GitHub OAuth2 Device Flow
│   ├── clipboard/          # Clipboard monitor with adaptive backoff
│   ├── config/             # JSON config with migration and env overrides
│   ├── constants/          # Shared constants
│   ├── downloader/         # Worker pool queue manager
│   ├── errors/             # Typed AppError with sentinels
│   ├── events/             # Centralized event name constants
│   ├── handlers/           # Business logic layer (Video, Media, Settings, System, Converter, Transcriber)
│   ├── images/             # Image download client
│   ├── launcher/           # Dependency auto-installer (yt-dlp, FFmpeg)
│   ├── logger/             # Zerolog with file rotation
│   ├── ratelimit/          # Token bucket rate limiter
│   ├── roadmap/            # GitHub Projects API + CDN cache
│   ├── storage/            # SQLite via modernc (pure Go, no CGO)
│   ├── telemetry/          # Anonymous usage analytics
│   ├── updater/            # Auto-update via GitHub Releases
│   ├── validate/           # Input sanitization
│   ├── whisper/            # Whisper integration for transcription
│   └── youtube/            # yt-dlp wrapper with progress parsing
├── frontend/               # UI (React 19 + TypeScript + Tailwind)
│   ├── bindings/           # Auto-generated Wails v3 type-safe bindings
│   ├── src/
│   │   ├── pages/          # Home, Dashboard, Setup, Roadmap, Transcriber
│   │   ├── components/     # Reusable UI components
│   │   ├── stores/         # Zustand state management
│   │   ├── i18n/           # Internationalization (5 locales)
│   │   └── lib/            # Wails runtime wrapper
│   └── package.json
├── build/                  # Build resources, icons, NSIS config
├── docs/                   # Architecture docs and ADRs
└── .github/                # CI/CD workflows, issue templates
```

---

## Tech Stack

| Layer           | Technology                                              |
| :-------------- | :------------------------------------------------------ |
| **Runtime**     | Wails v3                                                |
| **Backend**     | Go 1.25, zerolog, modernc/sqlite                        |
| **Frontend**    | React 19, TypeScript, Vite                              |
| **Styling**     | Tailwind CSS                                            |
| **State**       | Zustand                                                 |
| **i18n**        | react-i18next (pt-BR, en-US, es-ES, fr-FR, de-DE)      |
| **Testing**     | Go stdlib + Vitest + React Testing Library              |
| **Media**       | yt-dlp, FFmpeg, aria2c, Whisper                         |
| **Distribution**| NSIS (Windows), AppImage (Linux)                        |

---

## Roadmap

- [x] v2 Architecture (Wails v2 + React)
- [x] SQLite Persistence
- [x] Smart Clipboard Monitor
- [x] Internationalization (5 languages)
- [x] Auto-Update System
- [x] Media Converters (Video, Audio, Image)
- [x] Interactive Roadmap with GitHub voting
- [x] GitHub Authentication (Device Flow)
- [x] Deep Link Support (`kingo://`)
- [x] v3 Architecture (Wails v3 migration)
- [x] Transcriber (Whisper integration)
- [ ] Playlist Downloads
- [ ] Browser Extension
- [ ] Plugin Support

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and component overview
- [Events Contract](docs/EVENTS.md) — Go <-> React event bus specification
- [FAQ](docs/FAQ.md) — Frequently asked questions
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues and solutions
- [Release Process](docs/RELEASE.md) — How releases are created
- [Third-Party Licenses](docs/LICENSES.md) — Open source dependencies
- [Architecture Decisions](docs/decisions/) — ADRs for key technical choices

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a Pull Request.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
