<p align="center">
  <strong>English</strong> | <a href="README-pt.md">Português</a>
</p>

<p align="center">
  <img src="build/appicon.png" width="120" height="120" alt="DownKingo logo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>Download, edit, convert, and transcribe media in one native Windows app.</strong>
</p>

<p align="center">
  Powered by Go, Wails v3, React, yt-dlp, FFmpeg, and Whisper.cpp.
</p>

<p align="center">
  <a href="https://github.com/down-kingo/downkingo/releases/latest">
    <img src="https://img.shields.io/github/v/release/down-kingo/downkingo?style=for-the-badge&color=E11D48&logo=github" alt="Latest release">
  </a>
  <a href="https://github.com/down-kingo/downkingo/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/down-kingo/downkingo/release.yml?style=for-the-badge&label=Build&logo=github-actions" alt="Build status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/down-kingo/downkingo?style=for-the-badge&color=E11D48" alt="MIT license">
  </a>
</p>

<p align="center">
  <a href="https://downkingo.com">Website</a> ·
  <a href="https://github.com/down-kingo/downkingo/releases/latest">Download</a> ·
  <a href="https://github.com/orgs/down-kingo/projects/2">Live roadmap</a>
</p>

<p align="center">
  <img src="public/download-v3.1.2.avif" width="100%" alt="DownKingo v3.1.2 video download screen">
</p>

## What is DownKingo?

DownKingo is a desktop media workspace. Paste a link, inspect the available formats, choose video or audio quality, optionally trim the content or add captions, and send the result to a persistent download queue. The same app also downloads images, converts and compresses local media, transcribes audio and video offline, and keeps a download history.

Version **3.1.2** is built on the Wails v3 architecture and is currently distributed as a Windows executable.

## Current features

### Video and audio downloads

- Resolves URLs supported by **yt-dlp**, including YouTube, Instagram, TikTok, X/Twitter, and many other services.
- Shows media metadata and the available video, audio, resolution, and format choices before downloading.
- Can use cookies from an installed browser when a service requires an authenticated session.
- Includes a clipboard monitor for detecting copied media links.
- Supports configurable download folders and video compatibility preferences.

### Queue and history

- Persistent queue with real-time progress, cancellation, and concurrent downloads.
- Drag-and-drop reordering with a configurable worker limit.
- Persistent history for quickly locating completed downloads.
- Clear, actionable status and network error messages.

### Built-in video editor

- Trim and split a video into the sections you want before downloading.
- Preview the content and final duration on an interactive timeline.
- Select subtitle tracks, add captions, and configure their visual style.
- Produces the edited media through the same FFmpeg-backed download pipeline.

<p align="center">
  <img src="public/editor-de-video-v3.1.2.avif" width="100%" alt="DownKingo v3.1.2 video editor with timeline and captions">
</p>

### Image downloads

- Dedicated image download workflow with URL detection.
- Configurable destination folder, output format, and image quality.
- Keeps image tools separate from video downloads so each module can be enabled independently.

### Media converter

- Video-to-video conversion with format and codec choices.
- Video-to-audio extraction.
- Image-to-image conversion.
- Video and image compression with quality presets and estimated output size.
- Multiple-file input list, progress feedback, and result summary.

### Offline transcription

- Transcribes local audio and video with **Whisper.cpp** on your computer.
- Guided installation for the Whisper binary and downloadable speech models.
- Model manager for installing, selecting, and removing models.
- Automatic or explicit language selection.
- Results can be copied or saved as **TXT**, **SRT**, or **VTT**.

### Personalization and integration

- Five interface languages: English, Brazilian Portuguese, Spanish, French, and German.
- Light and dark themes, five accent colors, and sidebar or topbar navigation.
- Enable only the modules you use: videos, images, converter, and transcriber.
- Configurable keyboard shortcuts, clipboard monitoring, download folders, and Windows startup.
- In-app roadmap with GitHub authentication, voting, and new feature suggestions.
- Built-in update checks through GitHub Releases.

<table>
  <tr>
    <td width="50%">
      <img src="public/config-tema-v3.1.2.avif" alt="Theme, accent color, and navigation settings">
    </td>
    <td width="50%">
      <img src="public/config-idioma-3.1.2.avif" alt="Language, module, and storage settings">
    </td>
  </tr>
  <tr>
    <td align="center"><sub>Theme, accent color, and navigation layout</sub></td>
    <td align="center"><sub>Languages, optional modules, and download folders</sub></td>
  </tr>
</table>

## Local processing and network access

Media conversion and Whisper transcription run locally. Network access is used to inspect and download remote media, install optional dependencies and models, check for updates, and synchronize the community roadmap. GitHub sign-in is optional and only needed for actions such as voting or submitting suggestions.

## Installation

Official binaries are currently published for **Windows**.

| Platform | Status | Download |
| :--- | :--- | :--- |
| Windows | Supported release | [Download the latest `DownKingo.exe`](https://github.com/down-kingo/downkingo/releases/latest) |

Linux and macOS do not have official v3.1.2 binaries.

On the first run, DownKingo lets you choose the modules you want and installs required tools such as yt-dlp and FFmpeg. Whisper and its language models are installed only when transcription is enabled.

## Quick use

1. Paste a media URL on the **Downloads** page.
2. Choose video or audio and select the desired quality.
3. Optionally open the editor to trim sections or configure captions.
4. Add the item to the queue and follow its progress.
5. Use **Convert** for local media or **Transcriber** for offline speech-to-text.

## Development

### Requirements

- Go 1.25+
- Bun
- [Task](https://taskfile.dev/) — `go install github.com/go-task/task/v3/cmd/task@latest`
- Wails v3 CLI — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### Run locally

```bash
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

cd frontend
bun install
cd ..

task dev
```

### Useful commands

| Command | Description |
| :--- | :--- |
| `task dev` | Run the Wails application with frontend hot reload |
| `task build` | Build the Go application |
| `task build:production` | Build the production frontend and desktop executable |
| `task generate` | Regenerate Wails frontend bindings |
| `task frontend:test` | Run frontend tests with Vitest |
| `task frontend:build` | Type-check and build the frontend |

### Main architecture

```text
downkingo/
├── app.go                 # Wails facade exposed to the frontend
├── main.go                # Native application bootstrap
├── internal/
│   ├── downloader/        # Persistent concurrent download queue
│   ├── handlers/          # Video, image, converter, settings, and system flows
│   ├── roadmap/           # GitHub Project + CDN synchronization
│   ├── storage/           # SQLite persistence
│   ├── updater/           # GitHub Releases updater
│   ├── whisper/           # Whisper.cpp installation and transcription
│   └── youtube/           # yt-dlp integration and progress parsing
├── frontend/
│   ├── bindings/          # Generated Wails bindings
│   └── src/               # React 19, TypeScript, Tailwind CSS, Zustand, i18n
├── build/                 # Icons and Windows packaging resources
├── docs/                  # Architecture, operations, and contributor docs
└── .github/               # CI, release, and roadmap publishing workflows
```

## Technology

| Layer | Stack |
| :--- | :--- |
| Desktop runtime | Wails v3 |
| Backend | Go 1.25, zerolog, modernc/sqlite |
| Frontend | React 19, TypeScript 6, Vite 8 |
| UI and state | Tailwind CSS 4, Zustand |
| Media | yt-dlp, FFmpeg, aria2c, Whisper.cpp |
| Testing | Go test, Vitest, React Testing Library |
| Distribution | Windows executable and built-in updater |

## Roadmap

The source of truth is the public [DownKingo Project #2](https://github.com/orgs/down-kingo/projects/2). The app mirrors its four stages — ideas, planned, in production, and shipped — and uses the Project status field rather than the open/closed state of an issue.

The [Roadmap Sync workflow](.github/workflows/roadmap-sync.yml) publishes localized roadmap data to the CDN consumed by both production builds and `wails3 dev`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Event contract](docs/EVENTS.md)
- [FAQ](docs/FAQ.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Release process](docs/RELEASE.md)
- [Third-party licenses](docs/LICENSES.md)
- [Architecture decisions](docs/decisions/)

## Contributing

Contributions are welcome. Read the [Contributing Guide](CONTRIBUTING.md) before opening an issue or pull request.

## License

DownKingo is distributed under the [MIT License](LICENSE).
