# Contrato de Eventos Go <-> React

Este documento define todos os eventos emitidos via Wails Event Bus entre backend (Go) e frontend (React).

## Convencao

- Nomes: `dominio:acao` (e.g., `download:progress`)
- Constantes Go: definidas em `internal/events/events.go`
- Frontend: escuta via `safeEventsOn<T>()` de `lib/wailsRuntime.ts`

## Eventos de Download

### `download:added`

Emitido quando um novo download entra na fila.

**Emitido por**: `downloader.Manager.AddJob()`

```typescript
interface DownloadAdded {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  format: string;
  audioOnly: boolean;
  status: "pending";
  progress: number;
  speed: string;
  eta: string;
  filePath: string;
  fileSize: number;
  errorMessage: string;
  createdAt: string; // ISO 8601
  startedAt: string | null;
  completedAt: string | null;
}
```

### `download:progress`

Emitido durante o progresso do download (a cada atualicao do yt-dlp).

**Emitido por**: `downloader.Manager.emitDetailedProgress()`

```typescript
interface DownloadProgress {
  id: string;
  status: "downloading" | "merging" | "completed" | "failed" | "cancelled";
  progress: number; // 0-100
  speed: string; // e.g., "5.2 MB/s"
  eta: string; // e.g., "2m 30s"
  thumbnail: string;
}
```

### `download:log`

Log raw do yt-dlp para o Terminal.

**Emitido por**: `downloader.Manager.emitLog()`

```typescript
interface DownloadLog {
  id: string;
  line: string; // Linha de output do yt-dlp
}
```

## Eventos de Console

### `console:log`

Mensagem amigavel para o usuario (exibida no Terminal).

**Emitido por**: Handlers via `consoleEmitter`

```typescript
type ConsoleLog = string; // Mensagem direta, e.g., "[Video] Buscando info..."
```

## Eventos do Launcher

### `launcher:progress`

Progresso do download de dependencias (yt-dlp, ffmpeg).

**Emitido por**: `launcher.Launcher`

```typescript
interface LauncherProgress {
  name: string; // "yt-dlp" | "ffmpeg"
  progress: number; // 0-100
  status: string; // "downloading" | "extracting" | "complete"
}
```

### `launcher:complete`

Todas as dependencias instaladas.

**Emitido por**: `launcher.Launcher`

```typescript
type LauncherComplete = null;
```

## Eventos do Updater

### `update:progress`

Progresso do download de atualizacao do app.

**Emitido por**: `updater.Updater`

```typescript
interface UpdateProgress {
  progress: number; // 0-100
  status: string;
}
```

### `update:complete`

Atualizacao baixada e pronta para aplicar.

**Emitido por**: `updater.Updater`

```typescript
type UpdateComplete = null;
```

## Eventos de Ciclo de Vida

### `app:ready`

Emitido quando o backend termina de inicializar.

**Emitido por**: `App.ServiceStartup()`

```typescript
interface AppReady {
  needsSetup: boolean; // true se dependencias faltam
}
```

### `deep-link`

Emitido quando o app recebe uma URL via protocolo `kingo://`.

**Emitido por**: `App.ServiceStartup()` (cold start) ou OS handler

```typescript
type DeepLink = string; // e.g., "kingo://open?url=https%3A%2F%2Fyoutube.com%2F..."
```
