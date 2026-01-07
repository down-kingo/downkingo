# Roadmap Package

O pacote `internal/roadmap` implementa a funcionalidade "Build in Public", permitindo que usuários visualizem, votem e sugiram features.

## Arquitetura: SGML + Hybrid

Utilizamos uma arquitetura híbrida para performance leitura e interatividade na escrita.

### 1. Leitura (Static Generation Multi-Language)

Para garantir zero latência, o roadmap de leitura **não** acessa a API do GitHub diretamente.

- **Fonte**: GitHub Projects V2.
- **Processamento**: GitHub Actions + Scripts Node.js + Gemini Flash Lite (para tradução).
- **Output**: JSON estático (`roadmap.json`) hospedado na Cloudflare Pages.
- **Consumo**: O app baixa o JSON da CDN, validando via ETag/Cache local.

**Stale-While-Revalidate**:

1. O app carrega imediatamente a versão em cache (SQLite/Memória).
2. Em background, busca atualização na CDN.
3. Se houver mudanças, emite evento `roadmap:update` para o frontend.

### 2. Escrita (Direct API)

Para interações que exigem autenticação (votar, sugerir), o app se comunica diretamente com a API do GitHub.

- **Voto (+1)**: `POST /repos/:owner/:repo/issues/:id/reactions`
- **Sugestão**: `POST /repos/:owner/:repo/issues` (com labels `enhancement`, `suggestion`).

> **Nota**: Essas operações requerem que o usuário esteja logado via `internal/auth`.

## Estrutura de Dados (`roadmap.json`)

O JSON gerado contém metadados de tradução:

```json
{
  "id": 123,
  "title": "feat: dark mode",
  "friendly_title": {
    "pt-BR": "Modo Escuro",
    "en-US": "Dark Mode"
  },
  "status": "planned",
  "votes": 42
}
```

## Configuração

Em `settings.json`, é possível alterar a fonte de dados (útil para dev/staging):

- `cdnEnabled`: Liga/Desliga o uso da CDN.
- `cdnBaseUrl`: URL base customizada.

## Mapeamento de Status

O pacote mapeia colunas do GitHub Project para status internos:

- `Todo/Backlog` -> `idea`
- `In Progress` -> `in-progress`
- `Done/Shipped` -> `shipped`
