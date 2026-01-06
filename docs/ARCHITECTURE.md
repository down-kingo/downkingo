# Arquitetura

Documentação técnica da arquitetura do DownKingo.

## Visão Geral

O DownKingo é uma aplicação desktop construída com [Wails](https://wails.io/), que combina um backend em Go com um frontend em React/TypeScript.

```
┌─────────────────────────────────────────────────────────────┐
│                        DownKingo                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    FRONTEND                          │    │
│  │  React 18 + TypeScript + Tailwind CSS + Zustand     │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │  Pages   │  │Components│  │     Stores       │   │    │
│  │  │  - Home  │  │  - UI    │  │  - downloadStore │   │    │
│  │  │  - Setup │  │  - Cards │  │                  │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                    Wails Bridge (IPC)                        │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    BACKEND (Go)                      │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │  app.go  │  │ internal │  │    External      │   │    │
│  │  │  (API)   │  │ packages │  │    Binaries      │   │    │
│  │  │          │◄─┤          │◄─┤    - yt-dlp      │   │    │
│  │  │          │  │ -youtube │  │    - ffmpeg      │   │    │
│  │  │          │  │ -launcher│  │                  │   │    │
│  │  │          │  │ -logger  │  │                  │   │    │
│  │  │          │  │ -updater │  │                  │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Estrutura de Diretórios

```
DownKingo/
├── main.go                 # Entry point, configuração Wails
├── app.go                  # Struct App, métodos expostos ao frontend
│
├── internal/               # Pacotes internos (não exportados)
│   ├── app/
│   │   └── paths.go        # Gerenciamento de diretórios
│   ├── events/
│   │   └── events.go       # Constantes de eventos centralizadas
│   ├── launcher/
│   │   └── launcher.go     # Download de dependências (fallback)
│   ├── logger/
│   │   └── logger.go       # Structured logging (zerolog)
│   ├── updater/
│   │   └── updater.go      # Sistema de auto-update
│   └── youtube/
│       └── youtube.go      # Wrapper do yt-dlp
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Componente raiz
│   │   ├── pages/          # Páginas (Home, Setup)
│   │   ├── components/     # Componentes reutilizáveis
│   │   └── stores/         # Estado global (Zustand)
│   └── wailsjs/            # Bindings gerados automaticamente
│
├── build/
│   ├── appicon.png         # Ícone do app
│   ├── sidecar/            # Binários empacotados
│   │   ├── windows/
│   │   ├── darwin/
│   │   └── linux/
│   └── windows/
│       └── installer/
│           └── project.nsi # Script NSIS
│
└── docs/                   # Documentação
```

## Componentes Principais

### Backend (Go)

#### `app.go`

Struct principal que expõe métodos para o frontend via Wails bridge:

- `GetVideoInfo(url)` - Obtém metadados do vídeo
- `Download(opts)` - Inicia download
- `CheckForUpdate()` - Verifica atualizações
- `GetDownloadsPath()` - Retorna pasta de downloads

#### `internal/youtube`

Wrapper do yt-dlp:

- Executa yt-dlp como subprocesso
- Parseia output JSON para metadados
- Emite eventos de progresso via Wails

#### `internal/launcher`

Gerencia dependências (ffmpeg, yt-dlp):

- Verifica se binários existem
- Baixa se necessário (fallback)
- Context propagation para cancelamento

#### `internal/logger`

Logging estruturado com zerolog:

- Logs em arquivo JSON
- Rotação diária
- Níveis: debug, info, warn, error

### Frontend (React)

#### Estado (Zustand)

```typescript
// downloadStore.ts
interface DownloadState {
  queue: DownloadItem[];
  addToQueue(url): string;
  updateProgress(id, progress): void;
  removeFromQueue(id): void;
}
```

#### Comunicação com Backend

```typescript
// Chamada de método Go
import { GetVideoInfo } from '../wailsjs/go/main/App';
const info = await GetVideoInfo(url);

// Escutar eventos
import { EventsOn } from '../wailsjs/runtime';
EventsOn('download:progress', (data) => { ... });
```

## Fluxo de Download

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ Frontend │    │ Backend  │    │  yt-dlp  │
│  Input   │───▶│  React   │───▶│   Go     │───▶│  Binary  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │  Cola URL     │               │               │
     │──────────────▶│               │               │
     │               │  GetVideoInfo │               │
     │               │──────────────▶│               │
     │               │               │  --dump-json  │
     │               │               │──────────────▶│
     │               │               │◀──────────────│
     │               │◀──────────────│  JSON metadata│
     │  Mostra Info  │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │  Clica Download               │               │
     │──────────────▶│  Download()   │               │
     │               │──────────────▶│  -f best ...  │
     │               │               │──────────────▶│
     │               │    progress   │◀──────────────│
     │               │◀──Events──────│  (streaming)  │
     │  Progress Bar │               │               │
     │◀──────────────│               │               │
     │               │               │  [Complete]   │
     │  Done! ✅     │◀──────────────│◀──────────────│
     │◀──────────────│               │               │
```

## Detecção de Binários (Sidecar)

O app procura binários nesta ordem de prioridade:

### Windows

1. `$INSTDIR\bin\` (instalador NSIS)
2. `%AppData%\DownKingo\bin\` (fallback download)

### macOS

1. `DownKingo.app/Contents/Resources/bin/` (bundle)
2. `~/Library/Application Support/DownKingo/bin/` (fallback)

### Linux

1. Mesmo diretório do executável (AppImage)
2. `~/.config/DownKingo/bin/` (fallback)

## Tecnologias

| Camada           | Stack                      |
| ---------------- | -------------------------- |
| **Runtime**      | Wails v2                   |
| **Backend**      | Go 1.21, zerolog           |
| **Frontend**     | React 18, TypeScript, Vite |
| **Estilização**  | Tailwind CSS               |
| **Estado**       | Zustand                    |
| **Media**        | yt-dlp, FFmpeg             |
| **Distribuição** | NSIS, DMG, AppImage        |
