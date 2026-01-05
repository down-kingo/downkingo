# 📋 Plano: Migração do Roadmap para CDN + Cache Local

## Contexto

O app **DownKingo** (Wails/Go + React) atualmente busca dados do roadmap diretamente do GitHub Projects via GraphQL. Para escalar para 10k+ usuários sem sobrecarregar o GitHub e sem manter servidor próprio, vamos migrar para uma arquitetura **CDN-first com cache local**.

---

## Arquitetura Alvo

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. GITHUB ACTIONS (trigger: issue/project change)                   │
│     └── Busca dados do Project via GraphQL                           │
│     └── (Futuro) IA processa títulos                                 │
│     └── Gera roadmap.json + roadmap.meta.json                        │
│     └── Deploy → Cloudflare Pages                                    │
├──────────────────────────────────────────────────────────────────────┤
│  2. CLOUDFLARE PAGES CDN                                             │
│     └── URL: https://downkingo-roadmap.pages.dev/                    │
│     └── Serve: roadmap.json, roadmap.meta.json                       │
│     └── Headers automáticos: ETag, gzip/brotli, Cache-Control        │
├──────────────────────────────────────────────────────────────────────┤
│  3. APP DESKTOP (Wails/Go)                                           │
│     └── Abre → Lê cache local (SQLite) imediatamente                 │
│     └── Background → GET roadmap.meta.json (< 100 bytes)             │
│     └── Se content_hash mudou → GET roadmap.json com If-None-Match   │
│     └── 200 → Salva no SQLite + EventsEmit("roadmap:update")         │
│     └── 304 → Não faz nada                                           │
│     └── React renderiza via EventsOn                                 │
├──────────────────────────────────────────────────────────────────────┤
│  4. ESCRITA (votar/sugerir)                                          │
│     └── Continua direto para GitHub API (precisa do token do usuário)│
└──────────────────────────────────────────────────────────────────────┘
```

---

## Contrato: `roadmap.json`

```json
{
  "version": "1.0.0",
  "generated_at": "2026-01-05T01:00:00Z",
  "source": {
    "owner": "down-kingo",
    "repo": "downkingo",
    "project_number": 2
  },
  "items": [
    {
      "id": 42,
      "title": "Título original da issue",
      "friendly_title": "Título processado pela IA (opcional)",
      "description": "Descrição truncada (150 chars max)...",
      "status": "in-progress",
      "votes_up": 15,
      "votes_down": 2,
      "comments": 3,
      "url": "https://github.com/down-kingo/downkingo/issues/42",
      "labels": ["enhancement", "priority"],
      "author": "Capman002",
      "author_avatar": "https://avatars.githubusercontent.com/u/12345",
      "created_at": "2026-01-01T12:34:56Z",
      "shipped_at": null
    }
  ]
}
```

### Enum `status`

| Valor         | Descrição          | Mapeamento do Project                   |
| ------------- | ------------------ | --------------------------------------- |
| `idea`        | Ideia/Backlog      | "Bastidores", "Backlog", "Todo"         |
| `planned`     | Planejado          | "Em Pauta", "Ready", "Planned"          |
| `in-progress` | Em desenvolvimento | "Em Produção", "In Progress"            |
| `shipped`     | Entregue           | "No Ar", "Done", "Shipped", "Completed" |

---

## Contrato: `roadmap.meta.json`

```json
{
  "version": "1.0.0",
  "generated_at": "2026-01-05T01:00:00Z",
  "items_count": 42,
  "content_hash": "sha256:abc123def456..."
}
```

O `content_hash` é o SHA256 do conteúdo de `roadmap.json`, permitindo ao app decidir se precisa baixar sem depender do ETag do CDN.

---

## Fases de Implementação

---

## Fase 1: GitHub Action + Cloudflare Pages

**Objetivo**: Ter a URL pública funcionando com os JSONs.

### Tarefas

- [ ] Criar repositório auxiliar (ou branch `roadmap-data`) para hospedar os JSONs
- [ ] Configurar projeto no Cloudflare Pages apontando para esse repo/branch
- [x] Criar workflow `.github/workflows/roadmap-sync.yml`:
  - [x] Trigger: `workflow_dispatch` + `schedule` (cron a cada 30 min) + `issues` + `project`
  - [x] Job: busca dados via GraphQL, gera JSONs, commit na branch `roadmap-data`
- [ ] Cloudflare Pages detecta o commit e faz deploy automático

### Secrets necessários

- `GITHUB_TOKEN` (automático para GraphQL)
- `CLOUDFLARE_API_TOKEN` (se usar Wrangler para deploy direto)

### Validação

- [ ] Acessar `https://downkingo-roadmap.pages.dev/roadmap.json` e ver dados
- [ ] Verificar headers: `ETag`, `Content-Encoding: gzip`

---

## Fase 2: RoadmapService no Go

**Objetivo**: App consome do Pages com cache HTTP.

### Tarefas

- [x] Adicionar constante com URL do Pages no `service.go` (`internal/roadmap/types.go` → `DefaultConfig()`)
- [x] Implementar `fetchFromCDN()` (`internal/roadmap/cdn.go`):
  - [x] GET `roadmap.meta.json` para check leve
  - [x] Se `content_hash` diferente do cache local → GET `roadmap.json` com `If-None-Match`
  - [x] Tratar `200` (atualiza cache) e `304` (mantém cache)
- [x] Implementar jitter no sync:
  - [x] `time.Sleep(time.Duration(rand.Intn(30)) * time.Second)` antes de sincronizar
  - [x] Evita thundering herd quando muitos apps abrem ao mesmo tempo
- [x] Implementar backoff exponencial em caso de erro:
  - [x] 1s → 2s → 4s → 8s → max 60s

### Manter funcionando

- [x] `VoteOnIssue()` → continua direto para GitHub API
- [x] `CreateIssue()` → continua direto para GitHub API

### Configuração (settings.json ou ENV)

O CDN é **desabilitado por padrão** (seguro para dev). Para habilitar:

**Via `settings.json`** (persistido em AppData):

```json
{
  "roadmap": {
    "cdnEnabled": true,
    "cdnBaseUrl": "https://downkingo-roadmap.pages.dev"
  }
}
```

**Via Variáveis de Ambiente** (útil para dev/CI):

```bash
# Windows PowerShell
$env:DOWNKINGO_ROADMAP_CDN = "true"
$env:DOWNKINGO_ROADMAP_CDN_URL = "https://preview-abc123.pages.dev"

# Linux/macOS
export DOWNKINGO_ROADMAP_CDN=true
export DOWNKINGO_ROADMAP_CDN_URL=https://preview-abc123.pages.dev
```

**Prioridade**: `env var > settings.json > default (false)`

---

## Fase 3: Schema SQLite + Persistência

**Objetivo**: Cache local persiste entre sessões, funciona offline.

### Tarefas

- [x] Adicionar migration em `db.go`:
  - [x] Tabela `roadmap_cache` com campos: `id`, `data` (JSON), `content_hash`, `etag`, `fetched_at`
- [x] Implementar `loadFromCache()` e `saveToCache()` no Service (`internal/roadmap/cache.go`)
- [x] Alterar `FetchRoadmap()`:
  - [x] Retorna cache local imediatamente (Stale-While-Revalidate)
  - [x] Dispara goroutine para sync em background
  - [x] Emite `EventsEmit("roadmap:update", newData)` quando atualizar
- [x] Frontend React:
  - [x] Adicionar listener `EventsOn("roadmap:update", handler)` (`stores/roadmapStore.ts`)
  - [x] Atualizar estado (zustand) quando evento chegar

### Schema SQL

```sql
CREATE TABLE IF NOT EXISTS roadmap_cache (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT NOT NULL,
    content_hash TEXT,
    etag TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Fase 4: IA para Títulos

**Objetivo**: Títulos mais amigáveis processados por IA.

### Tarefas

- [ ] No GitHub Action, após buscar dados:
  - [ ] Chamar API de LLM (OpenAI, Claude, etc.) para gerar `friendly_title`
  - [ ] Cachear resultados para não reprocessar títulos já conhecidos
- [ ] Incluir `friendly_title` no JSON
- [ ] Frontend exibe `friendly_title` se existir, senão `title`

### Prompt sugerido para IA

```
Dado o título técnico de uma issue de software, gere um título amigável em português brasileiro que seja claro para usuários não-técnicos.

Entrada: "feat(network): Compartilhamento de downloads via redes sociais"
Saída: "Compartilhar downloads nas redes sociais"

Entrada: "fix(core): Memory leak no gerenciador de downloads"
Saída: "Correção de uso excessivo de memória"
```

---

## Fase 5: Refatoração do Frontend

**Objetivo**: Exibir apenas títulos amigáveis (processados pela IA) e simplificar a UI do Roadmap.

### Estado Atual

- Títulos técnicos: `feat(network): Compartilhament...`, `feat(core): Migração...`
- Descrições com markdown: `## Contexto Atualmente...`
- Colunas: Bastidores, Em Pauta, Em Produção, No Ar

### Estado Alvo

- Títulos amigáveis: `Compartilhar downloads nas redes sociais`, `Migração para nova arquitetura`
- Descrições limpas (sem markdown)
- Colunas mantidas (apenas visual atualizado)

### Tarefas

#### 5.1 Atualizar Componente de Card

**Arquivo**: `frontend/src/pages/Roadmap.tsx` (componente `RoadmapCard`)

- [x] Exibir `friendly_title` como título principal
- [x] Fallback para `title` se `friendly_title` não existir
- [x] Remover prefixos técnicos (`feat()`, `fix()`, etc.) do título original no fallback
- [x] Limpar markdown da descrição (remover `##`, `**`, etc.)

#### 5.2 Atualizar Store/Hook do Roadmap

**Arquivo**: `frontend/src/stores/roadmapStore.ts`

- [x] Adicionar listener `EventsOn("roadmap:update")`
- [x] Processar dados recebidos e atualizar estado
- [x] Aplicar transformações de limpeza se necessário

#### 5.3 Atualizar Tipagem

**Arquivo**: `frontend/src/types/roadmap.ts` (ou criar)

```typescript
interface RoadmapItem {
  id: number;
  title: string;
  friendly_title?: string; // NOVO
  description: string;
  status: "idea" | "planned" | "in-progress" | "shipped";
  votes_up: number; // RENOMEADO de votes
  votes_down: number; // NOVO
  comments: number;
  url: string;
  labels: string[];
  author: string;
  author_avatar: string;
  created_at: string;
  shipped_at: string | null;
}
```

#### 5.4 Utilitário de Limpeza de Texto

**Arquivo**: `frontend/src/utils/textUtils.ts`

- [x] `cleanTitle(title: string): string` - Remove prefixos técnicos do título
- [x] `cleanDescription(desc: string): string` - Remove markdown da descrição
- [x] `getDisplayTitle(item: RoadmapItem): string` - Retorna friendly_title ou title limpo

#### 5.5 Atualizar UI dos Cards

- [x] Título principal: `getDisplayTitle(item)` em fonte maior
- [x] Remover exibição do título técnico (mostrar como tooltip)
- [x] Descrição: `getDisplayDescription(item.description)`
- [ ] Votos: Mostrar `votes_up` e `votes_down` separados (👍 15 👎 2) - _aguardando CDN_
- [x] Badge de status com cores correspondentes

### Mapeamento de Campos (Antes → Depois)

| UI Atual       | Campo Antigo  | Campo Novo               | Exibição        |
| -------------- | ------------- | ------------------------ | --------------- |
| Título do card | `title`       | `friendly_title`         | Título amigável |
| Descrição      | `description` | `description`            | Sem markdown    |
| Votos          | `votes`       | `votes_up`, `votes_down` | 👍 15 👎 2      |
| Status         | interno       | `status`                 | Badge colorido  |

### Validação da Fase 5

- [x] Cards exibem títulos amigáveis legíveis por humanos
- [x] Nenhum prefixo técnico (`feat()`, `fix()`) visível
- [x] Descrições sem markdown renderizado como texto
- [ ] Votos separados funcionando - _aguardando CDN_
- [x] Fallback gracioso se `friendly_title` não existir

---

## Resumo de Arquivos a Criar/Modificar

| Arquivo                                   | Ação             | Descrição                         |
| ----------------------------------------- | ---------------- | --------------------------------- |
| `.github/workflows/roadmap-sync.yml`      | Criar            | Workflow de sync + deploy         |
| `internal/storage/db.go`                  | Modificar        | Adicionar tabela `roadmap_cache`  |
| `internal/roadmap/service.go`             | Modificar        | Refatorar para CDN + SQLite cache |
| `internal/roadmap/types.go`               | Criar (opcional) | Structs para o novo JSON          |
| `frontend/src/hooks/useRoadmapStore.ts`   | Criar            | Store com listener de eventos     |
| `frontend/src/types/roadmap.ts`           | Criar            | Tipagem TypeScript                |
| `frontend/src/utils/textUtils.ts`         | Criar            | Utilitários de limpeza de texto   |
| `frontend/src/components/RoadmapCard.tsx` | Modificar        | Exibir títulos amigáveis          |

---

## Configuração Cloudflare Pages

1. Criar projeto no painel Cloudflare Pages
2. Conectar ao repositório GitHub
3. Branch de produção: `roadmap-data` (ou `main` se for repo separado)
4. Build command: (nenhum, são arquivos estáticos)
5. Output directory: `/` ou pasta onde estão os JSONs

---

## Benefícios Finais

| Aspecto               | Antes                        | Depois               |
| --------------------- | ---------------------------- | -------------------- |
| **Custo**             | $0                           | $0                   |
| **Latência inicial**  | ~500ms (GraphQL)             | ~5ms (SQLite local)  |
| **Funciona offline**  | ❌ Não                       | ✅ Sim               |
| **Rate limit GitHub** | Compartilhado entre usuários | Zero (só Action usa) |
| **Escala**            | Limitado                     | Ilimitado (CDN)      |
| **Servidor próprio**  | N/A                          | Não precisa          |
| **Títulos**           | Técnicos                     | Amigáveis (IA)       |

---

## Perguntas Pendentes

1. **Repo separado ou branch?** Usar branch `roadmap-data` no repo principal ou criar repo auxiliar tipo `downkingo-roadmap`?

2. **Frequência do cron?** A cada 5 minutos é suficiente? (500 builds/mês = ~16/dia = a cada 90 min se quiser economizar)

3. **IA de títulos**: incluir na Fase 1 ou deixar como melhoria futura?

---

## Resumo das 5 Fases

| Fase  | Objetivo                         | Entrega                                 |
| ----- | -------------------------------- | --------------------------------------- |
| **1** | GitHub Action + Cloudflare Pages | URL pública com JSONs                   |
| **2** | RoadmapService no Go             | Consumo do CDN com ETag                 |
| **3** | Schema SQLite + Persistência     | Cache local offline-first               |
| **4** | IA para Títulos                  | `friendly_title` gerado automaticamente |
| **5** | Refatoração do Frontend          | UI exibe apenas títulos amigáveis       |

---

_Este plano pode ser executado incrementalmente. A Fase 1 é independente e já entrega valor._
