<p align="center">
  <a href="README.md">🇺🇸 English</a> | <strong>🇧🇷 Português</strong>
</p>

<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>Um companheiro de mídia moderno e multiplataforma para Windows, macOS e Linux.</strong>
</p>

<p align="center">
  Construído com Go. Projetado para velocidade.
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

## 🎯 Sobre

DownKingo é uma reescrita completa focada em performance, design e experiência do usuário. Combina a robustez do **Go** no backend com a flexibilidade do **React** no frontend.

### Por que DownKingo?

- **Zero Config**: FFmpeg e yt-dlp embutidos.
- **CDN-First**: Roadmap e metadados carregados via CDN para performance instantânea.
- **SQLite**: Persistência robusta para histórico e fila.
- **Ecosistema**: Integração nativa com GitHub para autenticação, updates e feedback.

---

## ✨ Funcionalidades

### Core

- 🎬 **Download Universal** — YouTube, Instagram, TikTok, Twitter e mais de 1000 sites.
- 🎵 **Conversão Inteligente** — Extração de áudio (MP3/M4A) com metadados automáticos.
- 📋 **Monitor de Clipboard** — Detecta links copiados automaticamente.
- 🚀 **Fila Concorrente** — Múltiplos downloads simultâneos em alta velocidade.

### Experiência

- 🌓 **Tema Escuro/Claro** — Interface moderna e fluida com transições suaves.
- 🌐 **Internacionalização** — Suporte nativo a Português e Inglês.
- 🗺️ **Roadmap Interativo** — Vote em funcionalidades e acompanhe o desenvolvimento dentro do app.
- ⚡ **Auto-Update** — Atualizações silenciosas e seguras.

---

## 📥 Instalação

| Plataforma  | Download                                                                                                                                                                |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | [![Windows](https://img.shields.io/badge/Download-.exe-0078D4?style=flat-square&logo=windows)](https://github.com/down-kingo/downkingo/releases/latest)                  |
| **Linux**   | [![Linux](https://img.shields.io/badge/Download-.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/down-kingo/downkingo/releases/latest) |
| **macOS**   | _Em breve_                                                                                                                                                              |

---

## 🛠️ Desenvolvimento

### Pré-requisitos

- **Go 1.21+**
- **Bun** (Runtime JS rápido)
- **Wails v2** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Início Rápido

```bash
# Clone o repositório
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

# Instale as dependências do frontend
cd frontend && bun install && cd ..

# Execute em modo de desenvolvimento
wails dev
```

### Estrutura do Projeto

```
├── internal/           # Lógica backend (Go)
│   ├── auth/           # OAuth2 Device Flow
│   ├── downloader/     # Gerenciador de fila e wrapper yt-dlp
│   ├── roadmap/        # Integração "Build in Public"
│   └── storage/        # Camada SQLite
├── frontend/           # UI (React + Tailwind)
└── build/              # Recursos de build
```

---

## 🗺️ Roadmap

- [x] Arquitetura v2 (Wails + React)
- [x] Persistência SQLite
- [x] Monitor de Clipboard Inteligente
- [x] Internacionalização (i18n)
- [x] Sistema de Auto-Update
- [ ] Download de Playlists
- [ ] Extensão para Navegador
- [ ] Suporte a Plugins

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, leia nosso [Guia de Contribuição](CONTRIBUTING.md) antes de enviar um Pull Request.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.
