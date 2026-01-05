<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo</h1>

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
  <a href="https://github.com/Capman002/DownKingo/releases">
    <img src="https://img.shields.io/github/downloads/Capman002/DownKingo/total?style=for-the-badge&color=18181B&logo=docusign" alt="Total Downloads">
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
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
</p>

<p align="center">
  <a href="#-por-que-DownKingo">Por quê?</a> •
  <a href="#-features">Features</a> •
  <a href="#-instalação">Instalação</a> •
  <a href="#-como-usar">Como Usar</a> •
  <a href="#-desenvolvimento">Desenvolvimento</a> •
  <a href="#-recursos">Recursos</a>
</p>

---

<!--
  📸 SCREENSHOT/GIF DO APP
  Substitua o comentário abaixo por uma imagem real do app:
  ![DownKingo Screenshot](docs/screenshot.png)
-->

<p align="center">
  <em>📸 Screenshot do app em breve...</em>
</p>

---

## 🎯 Por que DownKingo?

- **📦 Zero Config** — FFmpeg e yt-dlp já vêm incluídos. Instala e funciona.
- **🚀 Rápido** — Downloads multi-thread acelerados pelo yt-dlp.
- **🎨 Interface Premium** — Design limpo e moderno, sem poluição visual.
- **🔄 Auto-Updates** — Atualizações automáticas via GitHub Releases.
- **💻 Multiplataforma** — Windows, macOS e Linux com instaladores nativos.
- **🛡️ Open Source** — Código aberto sob licença MIT.

---

## ✨ Features

### Core

| Feature                   | Descrição                                     |
| ------------------------- | --------------------------------------------- |
| 🎬 **Download Universal** | YouTube + centenas de outras plataformas      |
| 🎵 **Extração de Áudio**  | Conversão direta para MP3 de alta qualidade   |
| � **Fila de Downloads**   | Múltiplos downloads simultâneos com progresso |

### Técnico

| Feature                    | Descrição                                       |
| -------------------------- | ----------------------------------------------- |
| 📦 **Binários Sidecar**    | ffmpeg + yt-dlp empacotados no instalador       |
| � **Fallback Inteligente** | Download automático se binários não encontrados |
| 📝 **Logging Estruturado** | Logs em `%AppData%/DownKingo/logs/`             |

---

## 📋 Requisitos do Sistema

| Sistema     | Versão Mínima               | Arquitetura           |
| ----------- | --------------------------- | --------------------- |
| **Windows** | Windows 10                  | x64                   |
| **macOS**   | macOS 10.15 (Catalina)      | Intel / Apple Silicon |
| **Linux**   | Ubuntu 20.04+ / equivalente | x64                   |

---

## 📥 Instalação

| Sistema     | Formato           | Download                                                                                                                                                                                                      |
| :---------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Windows** | Instalador `.exe` | [![Windows](https://img.shields.io/badge/Download-Windows-0078D4?style=for-the-badge&logo=windows)](https://github.com/Capman002/DownKingo/releases/latest/download/DownKingo-windows-amd64-installer.exe)    |
| **macOS**   | Disk Image `.dmg` | [![macOS](https://img.shields.io/badge/Download-macOS-000000?style=for-the-badge&logo=apple)](https://github.com/Capman002/DownKingo/releases/latest/download/DownKingo.dmg)                                  |
| **Linux**   | AppImage          | [![Linux](https://img.shields.io/badge/Download-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/Capman002/DownKingo/releases/latest/download/DownKingo-linux-amd64.AppImage) |

<details>
<summary><strong>📋 Instruções Detalhadas</strong></summary>

### Windows

```powershell
# 1. Baixe o instalador
# 2. Execute DownKingo-windows-amd64-installer.exe
# 3. Siga o assistente de instalação
# 4. Atalhos criados no Menu Iniciar e Desktop
```

### macOS

```bash
# 1. Baixe o .dmg
# 2. Abra e arraste para Applications
# 3. Primeira execução: clique direito → Abrir (bypass Gatekeeper)
```

### Linux

```bash
# Download
curl -L -o DownKingo.AppImage \
  https://github.com/Capman002/DownKingo/releases/latest/download/DownKingo-linux-amd64.AppImage

# Permissão de execução
chmod +x DownKingo.AppImage

# Executar
./DownKingo.AppImage
```

</details>

---

## 🚀 Como Usar

```
1. Abra o DownKingo
2. Cole a URL do vídeo (YouTube, Vimeo, Twitter, etc.)
3. Escolha: 🎬 Vídeo (MP4) ou 🎵 Áudio (MP3)
4. Clique em Download
5. Arquivo salvo em ~/Videos/DownKingo/
```

---

## 🛠️ Desenvolvimento

### Pré-requisitos

| Ferramenta | Versão | Instalação                                                 |
| :--------- | :----- | :--------------------------------------------------------- |
| Go         | 1.21+  | [go.dev](https://go.dev/dl/)                               |
| Bun        | Latest | [bun.sh](https://bun.sh/)                                  |
| Wails CLI  | v2     | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |

### Quick Start

```bash
# Clone
git clone https://github.com/Capman002/DownKingo.git && cd DownKingo

# Instale dependências do frontend
cd frontend && bun install && cd ..

# Modo desenvolvimento (Hot Reload)
wails dev
```

### Build de Produção

```bash
# Windows (instalador NSIS)
wails build --nsis

# macOS / Linux
wails build -clean -ldflags "-s -w"
```

---

## 🏗️ Arquitetura

```
DownKingo/
├── app.go                  # Métodos expostos ao frontend
├── main.go                 # Entry point Wails
├── internal/
│   ├── app/                # Paths e diretórios
│   ├── events/             # Constantes de eventos
│   ├── launcher/           # Download de dependências (fallback)
│   ├── logger/             # Structured logging (zerolog)
│   ├── updater/            # Auto-update
│   └── youtube/            # Wrapper yt-dlp
├── frontend/
│   ├── src/pages/          # React pages
│   ├── src/components/     # Componentes UI
│   └── src/stores/         # Estado (Zustand)
└── build/
    ├── sidecar/            # Binários empacotados
    └── windows/installer/  # Script NSIS
```

---

## 📖 Recursos

### Documentação

| Documento                                     | Descrição             |
| --------------------------------------------- | --------------------- |
| 📋 [Changelog](CHANGELOG.md)                  | Histórico de versões  |
| 🤝 [Contribuindo](CONTRIBUTING.md)            | Guia de contribuição  |
| 🛡️ [Segurança](SECURITY.md)                   | Política de segurança |
| 🏗️ [Arquitetura](docs/ARCHITECTURE.md)        | Documentação técnica  |
| ❓ [FAQ](docs/FAQ.md)                         | Perguntas frequentes  |
| 🔧 [Troubleshooting](docs/TROUBLESHOOTING.md) | Solução de problemas  |
| 🚀 [Release](docs/RELEASE.md)                 | Processo de release   |

### Links

| Recurso           | Link                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| 🐛 **Issues**     | [GitHub Issues](https://github.com/Capman002/DownKingo/issues)           |
| 💬 **Discussões** | [GitHub Discussions](https://github.com/Capman002/DownKingo/discussions) |
| 📦 **Releases**   | [GitHub Releases](https://github.com/Capman002/DownKingo/releases)       |

---

## 🗺️ Roadmap

- [x] Download de vídeo/áudio
- [x] Instaladores nativos (NSIS, DMG, AppImage)
- [x] Binários sidecar empacotados
- [x] Logging estruturado
- [ ] Download de playlists
- [ ] Seletor de qualidade
- [ ] Histórico persistente
- [ ] Tema Escuro
- [ ] i18n

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja o [Guia de Contribuição](CONTRIBUTING.md) para detalhes.

## 📄 Licença

[MIT License](LICENSE) © [Capman002](https://github.com/Capman002)

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/Capman002">Capman002</a>
</p>
