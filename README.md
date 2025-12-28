<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="Kinematic Logo">
</p>

<h1 align="center">Kinematic</h1>

<p align="center">
  <strong>Downloader de mídia profissional para Windows, macOS e Linux</strong>
</p>

<p align="center">
  <a href="https://github.com/Capman002/kinematic/releases/latest">
    <img src="https://img.shields.io/github/v/release/Capman002/kinematic?style=flat-square&color=E11D48" alt="Latest Release">
  </a>
  <a href="https://github.com/Capman002/kinematic/releases">
    <img src="https://img.shields.io/github/downloads/Capman002/kinematic/total?style=flat-square&color=18181B" alt="Downloads">
  </a>
  <a href="https://github.com/Capman002/kinematic/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Capman002/kinematic?style=flat-square" alt="License">
  </a>
</p>

---

## ✨ Features

- 🎬 **Download de vídeos** do YouTube e outras plataformas
- 🎵 **Extração de áudio** em MP3 de alta qualidade
- 📊 **Fila de downloads** com progresso em tempo real
- 🔄 **Auto-update** automático via GitHub Releases
- 🪄 **Smart Launcher** - baixa dependências automaticamente (yt-dlp, FFmpeg)
- 🎨 **UI moderna** com tema Clinical Neon (branco + vermelho)

## 📥 Download

| Sistema | Download                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Windows | [kinematic-windows-amd64.exe](https://github.com/Capman002/kinematic/releases/latest/download/kinematic-windows-amd64.exe) |
| macOS   | [kinematic-darwin-universal](https://github.com/Capman002/kinematic/releases/latest/download/kinematic-darwin-universal)   |
| Linux   | [kinematic-linux-amd64](https://github.com/Capman002/kinematic/releases/latest/download/kinematic-linux-amd64)             |

## 🚀 Primeiro Uso

1. Baixe o executável para seu sistema
2. Execute o aplicativo
3. O **Smart Launcher** irá baixar automaticamente:
   - `yt-dlp` - engine de download
   - `FFmpeg` - processamento de mídia
4. Pronto! Cole a URL do vídeo e baixe

## 🛠️ Desenvolvimento

### Pré-requisitos

- [Go 1.21+](https://go.dev/dl/)
- [Bun](https://bun.sh/)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Setup

```bash
# Clonar repositório
git clone https://github.com/Capman002/kinematic.git
cd kinematic

# Instalar Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Instalar dependências frontend
cd frontend && bun install && cd ..

# Rodar em modo desenvolvimento
wails dev
```

### Build de Produção

```bash
wails build -clean -ldflags "-s -w"
```

## 📁 Estrutura do Projeto

```
kinematic/
├── frontend/           # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/      # Setup, Home
│   │   ├── stores/     # Zustand (state management)
│   │   └── index.css   # Design System
├── internal/
│   ├── app/            # Paths e configuração
│   ├── launcher/       # Smart Launcher (yt-dlp, FFmpeg)
│   ├── youtube/        # Wrapper yt-dlp
│   └── updater/        # Auto-update via GitHub API
├── main.go             # Entrypoint
└── app.go              # Métodos expostos ao frontend
```

## 🎨 Design System

**Clinical Neon Light Theme**

- Background: `#FFFFFF` (branco)
- Accent: `#E11D48` (vermelho rose-600)
- Text: `#18181B` (zinc-900)
- Fontes: Outfit (display), Inter (UI)

## 📄 Licença

MIT © [Capman002](https://github.com/Capman002)

---

<p align="center">
  Feito com ❤️ usando <a href="https://wails.io">Wails</a>
</p>
