# Arquitetura

Documentacao tecnica da arquitetura do DownKingo v3.

## Visao Geral

O DownKingo e uma aplicacao desktop construida com [Wails v3](https://wails.io/), que combina um backend em Go com um frontend em React/TypeScript.

```
+-----------------------------------------------------------------+
|                          DownKingo v3                            |
+-----------------------------------------------------------------+
|  +-----------------------------------------------------------+ |
|  |                       FRONTEND                             | |
|  |  React 19 + TypeScript + Tailwind CSS + Zustand            | |
|  |                                                             | |
|  |  +----------+  +-----------+  +------------------+          | |
|  |  |  Pages   |  |Components |  |     Stores       |          | |
|  |  |  - Home  |  |  - Modals |  |  - downloadStore |          | |
|  |  |  - Setup |  |  - Video  |  |  - settingsStore |          | |
|  |  |  - Dash  |  |  - Nav    |  |  - roadmapStore  |          | |
|  |  |  - Road  |  |  - Trans  |  |                  |          | |
|  |  |  - Trans |  |  - Road   |  |                  |          | |
|  |  +----------+  +-----------+  +------------------+          | |
|  +-----------------------------------------------------------+ |
|                              |                                   |
|                   Wails v3 Bridge (IPC)                          |
|              Bindings (type-safe) + Events (bus)                 |
|                              |                                   |
|  +-----------------------------------------------------------+ |
|  |                     BACKEND (Go)                           | |
|  |                                                             | |
|  |  +----------+  +------------+  +------------------+         | |
|  |  |  app.go  |  |  Handlers  |  |    Services      |         | |
|  |  | (Facade) |<-| - Video    |<-|  - youtube       |         | |
|  |  |          |  | - Media    |  |  - downloader    |         | |
|  |  |          |  | - Settings |  |  - converter     |         | |
|  |  |          |  | - System   |  |  - storage (SQL) |         | |
|  |  |          |  | - Convert  |  |  - config        |         | |
|  |  |          |  | - Transcr  |  |  - whisper       |         | |
|  |  +----------+  +------------+  +------------------+         | |
|  |                                      |                       | |
|  |  +-----------+  +------------+  +----------+                | |
|  |  | validate  |  | ratelimit  |  | External |                | |
|  |  | (input)   |  | (throttle) |  | Binaries |                | |
|  |  +-----------+  +------------+  | - yt-dlp |                | |
|  |                                  | - ffmpeg |                | |
|  |  +-----------+  +------------+  | - aria2c |                | |
|  |  |  errors   |  |   logger   |  | - whisper|                | |
|  |  | (AppError)|  | (zerolog)  |  +----------+                | |
|  |  +-----------+  +------------+                               | |
|  +-----------------------------------------------------------+ |
+-----------------------------------------------------------------+
```

## Camadas

### 1. App Facade (`app.go`)

Ponto unico de exposicao para o frontend. Cada metodo publico vira uma funcao TypeScript type-safe via Wails v3 binding generator.

- Inicializa todos os servicos no `ServiceStartup()` (ciclo de vida Wails v3)
- Delega para handlers especializados
- Gerencia ciclo de vida (`ServiceStartup` / `ServiceShutdown`)

### 2. Handlers (`internal/handlers/`)

Camada de logica de negocio. Cada handler tem responsabilidade unica:

| Handler | Responsabilidade |
|---------|-----------------|
| `VideoHandler` | Busca de info, fila de download, cancelamento |
| `MediaHandler` | Instagram carousel, imagens, Twitter |
| `SettingsHandler` | Configuracao, seletores de diretorio |
| `SystemHandler` | Dependencias, updates, operacoes de sistema |
| `ConverterHandler` | Conversao de video, audio e imagens via FFmpeg |
| `TranscriberHandler` | Transcricao de audio/video via Whisper |

Cada handler aceita **interfaces** (nao tipos concretos) via construtor, seguindo Interface Segregation Principle.

### 3. Services (`internal/`)

Implementacoes concretas:

| Service | Pacote | Descricao |
|---------|--------|-----------|
| YouTube Client | `youtube/` | Wrapper do yt-dlp com parsing de progresso |
| Download Manager | `downloader/` | Worker pool com concorrencia controlada (semaforo) |
| Storage | `storage/` | SQLite via modernc (pure Go, sem CGO) |
| Config | `config/` | JSON com migracao de legado e env overrides |
| Logger | `logger/` | Zerolog com rotacao por tamanho (10MB, 5 backups) |
| Rate Limiter | `ratelimit/` | Token bucket com Wait() cancelavel via context |
| Updater | `updater/` | Auto-update via GitHub Releases |
| Roadmap | `roadmap/` | GitHub Projects API + CDN cache com ETag |
| Auth | `auth/` | GitHub OAuth2 Device Flow com refresh token |
| Whisper | `whisper/` | Transcricao local via Whisper CLI |
| Telemetry | `telemetry/` | Analytics anonimo de uso |

### 4. Cross-cutting

| Pacote | Descricao |
|--------|-----------|
| `errors/` | `AppError` com Op/Err/Message/Code + sentinels (`ErrNotFound`, etc.) |
| `validate/` | Sanitizacao de URLs, paths, filenames, formatos |
| `events/` | Constantes centralizadas de eventos (sem magic strings) |
| `ratelimit/` | Token bucket com limiters globais por endpoint |
| `constants/` | Constantes globais da aplicacao |

## Comunicacao Go <-> React

### Bindings (Metodos)

Wails v3 gera automaticamente funcoes TypeScript type-safe a partir dos metodos publicos do App. Os bindings ficam em `frontend/bindings/`.

```go
// Go
func (a *App) GetVideoInfo(url string) (*youtube.VideoInfo, error)
```

```typescript
// TypeScript (auto-gerado em frontend/bindings/)
export function GetVideoInfo(url: string): Promise<youtube.VideoInfo>
```

### Events (Bus)

Para comunicacao assincrona (progresso, notificacoes), Go emite eventos:

```go
application.Get().Event.Emit("download:progress", data)
```

React escuta via wrapper type-safe:

```typescript
const unsub = await safeEventsOn<DownloadProgress>("download:progress", (p) => {
  updateDownload(p.id, p)
})
```

Ver `docs/EVENTS.md` para o contrato completo.

## Fluxo de Download

```
User -> Frontend -> AddToQueue() -> VideoHandler -> Manager.AddJob()
                                                        |
                                                   [persiste no SQLite]
                                                        |
                                                   [enfileira no channel]
                                                        |
                                              Worker Pool (max 3 concurrent)
                                                        |
                                              1. GetVideoInfo (metadata)
                                              2. Download (yt-dlp)
                                              3. Emit progress events
                                              4. Update DB status
                                                        |
                                              [completeJob / failJob]
                                                        |
                                              Frontend <- Events <- Manager
```

## Fluxo de Transcricao

```
User -> Frontend -> TranscribeFile() -> TranscriberHandler -> whisper.Client
                                                                    |
                                                          1. Verifica binario whisper
                                                          2. Verifica modelo selecionado
                                                          3. Executa whisper CLI
                                                          4. Retorna resultado (texto + timestamps)
```

## Tratamento de Erros

Estrategia em camadas:

1. **Validacao na fronteira** (`validate` package): toda entrada do usuario e sanitizada antes de processar
2. **Sentinel errors** (`errors` package): `ErrNotFound`, `ErrTimeout`, etc. verificaveis com `errors.Is()`
3. **AppError com contexto**: cada handler wrapa erros com `Op` (operacao), `Message` (user-friendly), `Code` (frontend)
4. **Console logging**: mensagens amigaveis emitidas via `console:log` para o Terminal do usuario

## Observabilidade

- **Logs estruturados**: zerolog com campos tipados (traceID, phase, etc.)
- **Rotacao automatica**: 10MB por arquivo, 5 backups
- **Build tags**: `debug`/`dev` = Debug level, producao = Info level
- **Override**: `KINGO_DEBUG=true` ativa debug mesmo em prod
- **Metricas do Manager**: log periodico de jobs ativos, fila, taxa de sucesso/falha

## Ciclo de Vida (Wails v3)

```
main.go
  └── application.New()          # Cria a aplicacao Wails v3
       ├── Services: [App]       # Registra o App como Service
       ├── Assets: embed.FS      # Frontend embutido no binario
       └── app.Run()
            ├── ServiceStartup() # Inicializa todos os servicos
            │   ├── Paths
            │   ├── Auth
            │   ├── Config
            │   ├── Logger
            │   ├── SQLite
            │   ├── Launcher
            │   ├── YouTube Client
            │   ├── Download Manager
            │   ├── Updater
            │   ├── Telemetry
            │   ├── Handlers
            │   ├── Clipboard Monitor
            │   └── Emit app:ready
            └── ServiceShutdown()
                ├── Stop Manager
                ├── Stop Clipboard
                └── Close DB
```

## Tecnologias

| Camada | Stack |
|--------|-------|
| **Runtime** | Wails v3 (alpha) |
| **Backend** | Go 1.25, zerolog, modernc/sqlite |
| **Frontend** | React 19, TypeScript, Vite |
| **Estilizacao** | Tailwind CSS |
| **Estado** | Zustand |
| **i18n** | react-i18next (pt-BR, en-US, es-ES, fr-FR, de-DE) |
| **Testes Go** | stdlib testing, httptest |
| **Testes Frontend** | Vitest, React Testing Library |
| **Media** | yt-dlp, FFmpeg, aria2c, Whisper |
| **Build** | Taskfile (substitui Wails CLI) |
| **Distribuicao** | NSIS (Windows), AppImage (Linux) |

## Decisoes de Arquitetura (ADRs)

As decisoes tecnicas relevantes estao documentadas em `docs/decisions/`:

- [001 - Zerolog](decisions/001-zerolog.md)
- [002 - SQLite modernc](decisions/002-sqlite-modernc.md)
- [003 - Interface Segregation](decisions/003-interface-segregation.md)
- [004 - Zustand](decisions/004-zustand.md)
- [005 - Token Bucket](decisions/005-token-bucket.md)
