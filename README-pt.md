<p align="center">
  <a href="README.md">English</a> | <strong>Portugues</strong>
</p>

<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="DownKingo Logo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>Um companheiro de midia moderno e multiplataforma para Windows, macOS e Linux.</strong>
</p>

<p align="center">
  Construido com Go + Wails v3. Projetado para velocidade.
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

## Sobre

DownKingo e um companheiro de midia completo, construido com foco em performance, design e experiencia do usuario. Combina a robustez do **Go** no backend com a flexibilidade do **React 19** no frontend, utilizando o **Wails v3** para integracao desktop nativa.

### Por que DownKingo?

- **Zero Config** — FFmpeg e yt-dlp sao baixados automaticamente na primeira execucao.
- **CDN-First** — Roadmap e metadados carregados via CDN para performance instantanea.
- **SQLite** — Persistencia robusta para historico e fila de downloads.
- **5 Idiomas** — Suporte completo a i18n: Ingles, Portugues, Espanhol, Frances e Alemao.
- **Ecosistema** — Integracao nativa com GitHub para autenticacao, updates e feedback da comunidade.

---

## Funcionalidades

### Core

- **Download Universal** — YouTube, Instagram, TikTok, Twitter e mais de 1000 sites via yt-dlp.
- **Conversao Inteligente** — Converta video, audio e imagens entre formatos usando FFmpeg.
- **Monitor de Clipboard** — Detecta links copiados automaticamente com adaptive backoff.
- **Fila Concorrente** — Multiplos downloads simultaneos com worker pool (concorrencia configuravel).
- **Transcritor** — Transcricao de audio/video via Whisper (local, offline).

### Experiencia

- **Tema Escuro/Claro** — Interface moderna e fluida com customizacao de accent color.
- **Internacionalizacao** — Suporte nativo a 5 idiomas (en-US, pt-BR, es-ES, fr-FR, de-DE).
- **Roadmap Interativo** — Vote em funcionalidades e acompanhe o desenvolvimento dentro do app via GitHub.
- **Auto-Update** — Atualizacoes silenciosas e seguras via GitHub Releases.
- **Deep Links** — Abra o app via protocolo `kingo://` a partir de navegadores e outros apps.

---

## Instalacao

| Plataforma  | Download                                                                                                                                                                |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | [![Windows](https://img.shields.io/badge/Download-.exe-0078D4?style=flat-square&logo=windows)](https://github.com/down-kingo/downkingo/releases/latest)                  |
| **Linux**   | [![Linux](https://img.shields.io/badge/Download-.AppImage-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/down-kingo/downkingo/releases/latest) |
| **macOS**   | _Em breve_                                                                                                                                                              |

---

## Desenvolvimento

### Pre-requisitos

- **Go 1.25+**
- **Bun** (runtime JS rapido)
- **Task** (task runner) — `go install github.com/go-task/task/v3/cmd/task@latest`
- **Wails v3 CLI** — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### Inicio Rapido

```bash
# Clone o repositorio
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

# Instale as dependencias do frontend
cd frontend && bun install && cd ..

# Execute em modo de desenvolvimento
task dev

# Ou build para producao
task build:production
```

### Tasks Disponiveis

| Comando                 | Descricao                               |
| :---------------------- | :-------------------------------------- |
| `task dev`              | Modo de desenvolvimento (hot reload)    |
| `task build`            | Build da aplicacao Go                   |
| `task build:production` | Build completo de producao (frontend + Go) |
| `task generate`         | Gerar bindings do frontend              |
| `task frontend:test`    | Executar testes do frontend (Vitest)    |
| `task frontend:build`   | Build do frontend para producao         |

### Estrutura do Projeto

```
downkingo/
├── main.go                 # Bootstrap da aplicacao Wails v3
├── app.go                  # Facade — todos os metodos expostos ao frontend
├── Taskfile.yml            # Task runner (substitui o Wails CLI)
├── VERSION                 # Versao semantica (3.0.0)
├── internal/               # Logica backend (Go)
│   ├── app/                # Paths e ciclo de vida da aplicacao
│   ├── auth/               # GitHub OAuth2 Device Flow
│   ├── clipboard/          # Monitor de clipboard com adaptive backoff
│   ├── config/             # Config JSON com migracao e env overrides
│   ├── constants/          # Constantes compartilhadas
│   ├── downloader/         # Gerenciador de fila com worker pool
│   ├── errors/             # AppError tipado com sentinels
│   ├── events/             # Constantes centralizadas de nomes de eventos
│   ├── handlers/           # Camada de logica de negocio (Video, Media, Settings, System, Converter, Transcriber)
│   ├── images/             # Cliente de download de imagens
│   ├── launcher/           # Auto-instalador de dependencias (yt-dlp, FFmpeg)
│   ├── logger/             # Zerolog com rotacao de arquivos
│   ├── ratelimit/          # Rate limiter token bucket
│   ├── roadmap/            # GitHub Projects API + CDN cache
│   ├── storage/            # SQLite via modernc (Go puro, sem CGO)
│   ├── telemetry/          # Analytics anonimo
│   ├── updater/            # Auto-update via GitHub Releases
│   ├── validate/           # Sanitizacao de entrada
│   ├── whisper/            # Integracao Whisper para transcricao
│   └── youtube/            # Wrapper yt-dlp com parsing de progresso
├── frontend/               # UI (React 19 + TypeScript + Tailwind)
│   ├── bindings/           # Bindings type-safe auto-gerados (Wails v3)
│   ├── src/
│   │   ├── pages/          # Home, Dashboard, Setup, Roadmap, Transcriber
│   │   ├── components/     # Componentes reutilizaveis
│   │   ├── stores/         # Gerenciamento de estado (Zustand)
│   │   ├── i18n/           # Internacionalizacao (5 locales)
│   │   └── lib/            # Wrapper do runtime Wails
│   └── package.json
├── build/                  # Recursos de build, icones, config NSIS
├── docs/                   # Documentacao de arquitetura e ADRs
└── .github/                # Workflows CI/CD, templates de issues
```

---

## Stack Tecnologico

| Camada          | Tecnologia                                              |
| :-------------- | :------------------------------------------------------ |
| **Runtime**     | Wails v3                                                |
| **Backend**     | Go 1.25, zerolog, modernc/sqlite                        |
| **Frontend**    | React 19, TypeScript, Vite                              |
| **Estilizacao** | Tailwind CSS                                            |
| **Estado**      | Zustand                                                 |
| **i18n**        | react-i18next (pt-BR, en-US, es-ES, fr-FR, de-DE)      |
| **Testes**      | Go stdlib + Vitest + React Testing Library              |
| **Media**       | yt-dlp, FFmpeg, aria2c, Whisper                         |
| **Distribuicao**| NSIS (Windows), AppImage (Linux)                        |

---

## Roadmap

- [x] Arquitetura v2 (Wails v2 + React)
- [x] Persistencia SQLite
- [x] Monitor de Clipboard Inteligente
- [x] Internacionalizacao (5 idiomas)
- [x] Sistema de Auto-Update
- [x] Conversores de Midia (Video, Audio, Imagem)
- [x] Roadmap Interativo com votacao via GitHub
- [x] Autenticacao GitHub (Device Flow)
- [x] Suporte a Deep Links (`kingo://`)
- [x] Arquitetura v3 (migracao Wails v3)
- [x] Transcritor (integracao Whisper)
- [ ] Download de Playlists
- [ ] Extensao para Navegador
- [ ] Suporte a Plugins

---

## Documentacao

- [Arquitetura](docs/ARCHITECTURE.md) — Design do sistema e visao dos componentes
- [Contrato de Eventos](docs/EVENTS.md) — Especificacao do event bus Go <-> React
- [FAQ](docs/FAQ.md) — Perguntas frequentes
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Problemas comuns e solucoes
- [Processo de Release](docs/RELEASE.md) — Como releases sao criadas
- [Licencas de Terceiros](docs/LICENSES.md) — Dependencias open source
- [Decisoes de Arquitetura](docs/decisions/) — ADRs para escolhas tecnicas

---

## Contribuindo

Contribuicoes sao bem-vindas! Por favor, leia nosso [Guia de Contribuicao](CONTRIBUTING.md) antes de enviar um Pull Request.

---

## Licenca

Distribuido sob a licenca MIT. Veja [LICENSE](LICENSE) para mais informacoes.
