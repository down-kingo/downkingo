# Changelog v2 → v3

> Relatório completo de mudanças entre a branch `main` (v2) e `v3`.
> **191 arquivos alterados** | **+41.511 linhas** | **-5.165 linhas**

---

## Novas Funcionalidades

### Transcritor com Whisper
- Novo módulo backend completo (`internal/whisper/client.go` — 869 linhas) para transcrição de áudio/vídeo usando Whisper
- Exportação para DOCX (`internal/whisper/docx.go`)
- Handler dedicado (`internal/handlers/transcriber.go`) com endpoints para download de modelos, transcrição e gerenciamento
- Nova página `Transcriber.tsx` (501 linhas) com interface completa
- Componentes: `ModelManager`, `TranscriptionResult`, `WhisperSetup`
- Configurações do transcritor em `TranscriberSettings.tsx`
- Hook `useVideoFetch.ts` para fetch de vídeos com stream proxy local
- Novos eventos: `whisper:model-progress` e `whisper:transcribe-progress`
- Traduções completas em 5 idiomas (PT-BR, EN-US, ES-ES, FR-FR, DE-DE)

### Corte de Vídeo (Video Trimmer)
- Novo componente `VideoTrimmer.tsx` (579 linhas) para selecionar trechos antes do download
- Hook `useTrimmer.ts` com lógica de controle de início/fim
- Traduções do trimmer em todos os idiomas
- Preview de vídeo integrado com stream proxy local (`internal/handlers/video.go`)

### Sistema de Feature Toggles
- Nova lib `frontend/src/lib/features.ts` com sistema de features habilitáveis/desabilitáveis
- Hook `useFeatures.ts` para controle reativo
- Tipos: `videos`, `images`, `converter`, `transcriber` — mínimo 1 feature ativa
- Sidebar e Topbar renderizam abas condicionalmente baseado nas features ativas
- Tela de setup inclui etapa de seleção de features
- Persistência via Zustand (`kingo-settings-v3`)

### Modo Anônimo
- Campo `TelemetryEnabled` renomeado para `AnonymousMode` (inversão semântica: opt-in → opt-out)
- Controle na tela de onboarding e configurações
- Traduções atualizadas com descrição correta do modo

---

## Migração de Framework

### Wails v2 → Wails v3
- `main.go` reescrito: `wails.Run()` → `application.New()` + `app.Window.NewWithOptions()`
- Novo sistema de bindings tipados em `frontend/bindings/` (gerados automaticamente)
- Removido `frontend/wailsjs/` (runtime v2 antigo)
- Eventos migrados: `runtime.EventsEmit()` → `application.Get().Events.Emit()`
- Clipboard migrado: `runtime.ClipboardGetText()` → `application.Get().Clipboard.Text()`
- Novo `frontend/src/lib/wailsRuntime.ts` como camada de abstração do runtime v3
- Novo `build/config.yml` com configuração do Wails v3 (dev server, file watching, etc.)
- Arquivo `wails.json` (v2) removido

### Sistema de Build: Taskfile
- Novo `Taskfile.yml` na raiz com tasks: `dev`, `build`, `build:updater`, `build:production`, `generate`, `generate:bindings`
- Novo `build/Taskfile.yml` com tasks Wails v3: `build:frontend`, `generate:bindings`, `generate:icons`
- Usa `bun` para todas as operações do frontend

---

## Melhorias no Conversor de Imagens

- Suporte exclusivo para AVIF (novo ícone `appicon.avif` de 90KB substituindo PNG de 6.5MB)
- `internal/converter/image.go` — reescrito com +285 linhas de melhorias
- `internal/images/converter.go` — melhorias na conversão de imagens
- Novo componente `BatchFileList.tsx` para conversão em lote
- Novo `estimateSize.ts` para estimativa de tamanho do arquivo convertido
- Novos tipos em `converter/types.ts`
- Novos eventos: `converter:progress` e `converter:done`
- Traduções do conversor preenchidas (antes vazias) com chaves: `batch_processing`, `batch_add_more`, `estimated_size`, `drop_here`, etc.

---

## Melhorias no Download de Vídeos

- `internal/downloader/manager.go` — refatoração significativa (+129 linhas)
- Integração com `bun` como runtime para yt-dlp
- `internal/youtube/youtube.go` — 84 linhas de melhorias
- Ações de download refatoradas (`useDownloadActions.ts`)
- Página renomeada: `Home.tsx` → `Video.tsx` (+387 linhas de mudanças)
- Traduções de turbo mode (aria2c) adicionadas

---

## Melhorias de Performance

- **SQLite**: novos pragmas `busy_timeout = 5000`, `temp_store = MEMORY`, `mmap_size = 256MB`
- **Queries otimizadas**: constante `downloadColumns` compartilhada com `COALESCE`, eliminando ~8 alocações `sql.NullString` por row
- **Code splitting** no frontend (commit dedicado)
- **Logger com rotação**: arquivos limitados a 10MB com máximo de 5 backups
- **Rate limiter com contexto**: `Wait(ctx context.Context) error` — evita bloqueio infinito
- **Dependências atualizadas**: `modernc/sqlite` v1.42→v1.44, `samber/lo` v1.49→v1.52
- **Ícone otimizado**: PNG 6.5MB → AVIF 90KB (redução de 98.6%)

---

## Setup Inicial e Onboarding

- `OnboardingModal.tsx` — reescrito (+611 linhas de mudanças)
- Nova etapa de seleção de features no setup
- Novas opções: cor do tema, iniciar com Windows, monitor de clipboard, auto-update, modo anônimo
- `Setup.tsx` — 313 linhas de melhorias
- Traduções expandidas para todo o fluxo de onboarding

---

## Correções de Bugs

### Roadmap
- Lógica de votos reescrita: votos otimistas agora só alteram `userVotes` (highlight do botão), nunca os contadores exibidos
- Novo `syncUserVotes()` sincroniza reações do GitHub para popular votos existentes
- Novo evento `roadmap:vote-update` para atualizações direcionadas (bypass do CDN)
- Persistência de `userVotes` no localStorage via Zustand persist
- Correção de erro 401 nas reações (`fix: resolve roadmap reaction 401`)
- Isolamento de dados dev vs produção
- Guarda contra dupla inicialização via `useRef`

### Auto-Atualizador
- `UpdateModal.tsx` — reescrito (+291 linhas de mudanças)
- `internal/updater/updater.go` — 145 linhas de melhorias na lógica
- Novo sidecar binary: `cmd/updater/main.go` (138 linhas) — compilado separadamente no CI
- Embed condicional: `embed.go` (produção) e `embed_dev.go` (desenvolvimento)
- Novas traduções para modal de update (`update_modal.title`, `whats_new`, `update_now`, `later`)

### Versão e Nomeação
- Novo arquivo `VERSION` na raiz (embeddado no binário)
- Fallback: se `ldflags` não define versão, lê do arquivo `VERSION` embeddado
- `internal/constants/constants.go` — remoção de constante hardcoded

---

## Mudanças Adicionais Descobertas

### Auth: Refresh Token OAuth
- Fluxo completo de refresh token para tokens GitHub App (expiram em ~8h)
- Novo método `RefreshAccessToken()` via `github.com/login/oauth/access_token`
- Refresh token persistido em `session.json`
- HTTP client compartilhado com timeout de 15s (substitui `http.DefaultClient`)

### Logger: Rotação por Tamanho
- `rotatingWriter` com `sync.Mutex` para thread safety
- Rotação ao atingir 10MB, máximo 5 backups com timestamp no nome
- Limpeza de backups antigos assíncrona (`go w.cleanOldBackups()`)

### Clipboard: Notificações Nativas do Windows
- Toast notifications nativas via `go-toast/v2` (substitui evento simples)
- Detecção de plataforma para 15 domínios (YouTube, Instagram, TikTok, Twitter/X, etc.)
- Ícone do app no toast + botão de ação com deep-link (`downkingo:download:<url>`)
- Fallback gracioso para evento IPC se o toast falhar

### Error Boundary
- Novo `RouteErrorBoundary` (React class component) para capturar erros por rota
- Fallback visual com ícone, mensagem de erro em monospace e botão "Tentar novamente"
- Evita crash total do app por erro em uma feature individual

### Navegação Reestruturada
- Sidebar: "Converter" renomeado para "Tools"; Queue e History movidos para grupo "Downloads"; Roadmap movido para o footer
- Topbar: separadores visuais entre grupos lógicos
- Ambos condicionais baseados em features ativas

### ADR (Architecture Decision Records)
5 novos documentos de decisão arquitetural:
| ADR | Decisão |
|-----|---------|
| 001 | zerolog (zero-allocation) sobre slog/zap |
| 002 | modernc/sqlite (pure Go, sem CGO) sobre mattn/go-sqlite3 |
| 003 | Interface segregation — interfaces definidas no consumidor |
| 004 | Zustand (minimal, persist) sobre Redux/Jotai/Context |
| 005 | Token bucket customizado sobre `x/time/rate` |

### Documentação Atualizada
- `ARCHITECTURE.md` — reescrito completo para v3 (React 19, Wails v3, novos serviços)
- `CONTRIBUTING.md`, `README.md`, `README-pt.md` — atualizados
- `FAQ.md`, `LICENSES.md`, `RELEASE.md`, `TROUBLESHOOTING.md` — revisados
- `EVENTS.md` — novo documento de referência de eventos (174 linhas)

### Suite de Testes
- `internal/config/config_test.go` — 263 linhas (defaults, load, save, migrations, thread safety)
- `internal/storage/storage_test.go` — 461 linhas (CRUD, WAL mode, queries)
- `internal/downloader/manager_test.go` — 450 linhas (AddJob, CancelJob, concurrency, restore)
- `internal/ratelimit/limiter_test.go` — 29 linhas (Wait success, context cancelled)
- `internal/updater/updater_test.go` — 28 linhas
- `frontend/src/stores/downloadStore.test.ts` — 261 linhas (state, duplicates, ordering)
- `frontend/src/test/setup.ts` — migrado para mocks Wails v3

### Dependências
**Adicionadas:**
- `go-toast/v2` — toast notifications nativas Windows
- `wails/v3 v3.0.0-alpha.69` — novo framework
- `golang.org/x/image v0.36.0` — processamento de imagens (AVIF)

**Removidas:**
- `gorilla/websocket` (→ `coder/websocket`)
- `labstack/echo/v4` (não usado no Wails v3)
- `pkg/errors`, `wailsapp/mimetype`, `leaanthony/gosod`, `leaanthony/slicer`

### CI/CD
- Novo step no release workflow: compilação do updater sidecar para Windows e Linux
- Build flags: `-ldflags "-s -w"` para binários menores

---

## Resumo de Impacto

| Métrica | Valor |
|---------|-------|
| Arquivos alterados | 191 |
| Linhas adicionadas | +41.511 |
| Linhas removidas | -5.165 |
| Commits | 9 |
| Novos componentes React | 12 |
| Novos arquivos Go | 11 |
| Novos testes | 7 suites |
| Novos idiomas do transcritor | 10 |
| Locales suportados | 5 (PT-BR, EN-US, ES-ES, FR-FR, DE-DE) |
| ADRs adicionados | 5 |
