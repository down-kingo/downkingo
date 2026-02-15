# Releases

Este documento descreve o processo de release do DownKingo.

## Versionamento

Seguimos o [Semantic Versioning](https://semver.org/lang/pt-BR/):

- **MAJOR** (3.x.x): Mudancas incompativeis com versoes anteriores
- **MINOR** (x.1.x): Novas features mantendo compatibilidade
- **PATCH** (x.x.1): Correcoes de bugs

A versao atual e definida no arquivo `VERSION` na raiz do projeto.

## Como Criar uma Release

### 1. Preparacao

```bash
# Atualize o VERSION com a nova versao
echo "3.1.0" > VERSION

# Verifique se todos os testes passam
go test ./...
task frontend:test

# Build local para validar
task build:production
```

### 2. Criar Tag

```bash
# Commit final
git add VERSION
git commit -m "chore: prepare v3.x.x release"

# Criar tag
git tag v3.x.x
git push origin main --tags
```

### 3. Build Automatico

O GitHub Actions e disparado automaticamente quando uma tag `v*` e criada:

1. **Windows**: Build com NSIS -> `DownKingo.exe` (instalador)
2. **Linux**: Build + AppImage -> `DownKingo.AppImage`

O pipeline inclui:
- Download automatico de sidecars (yt-dlp, FFmpeg) para empacotamento
- Geracao de release notes via IA (Gemini)
- Upload automatico dos artefatos na Release do GitHub

### 4. Publicacao

Os artefatos sao automaticamente anexados a Release no GitHub com release notes geradas.

## Build System

O DownKingo v3 usa **Taskfile** como task runner (substitui os comandos `wails` da v2):

```bash
task build              # Build rapido (Go apenas)
task build:production   # Build completo (frontend + Go)
task generate           # Regenerar bindings Wails v3
```

## Cadencia de Releases

| Tipo       | Frequencia          | Descricao                     |
| ---------- | ------------------- | ----------------------------- |
| **Stable** | Mensal              | Features completas e testadas |
| **Patch**  | Conforme necessario | Correcoes urgentes de bugs    |

## Checklist de Release

- [ ] `VERSION` atualizado
- [ ] Testes Go passando (`go test ./...`)
- [ ] Testes frontend passando (`task frontend:test`)
- [ ] Build local funcionando (`task build:production`)
- [ ] Tag criada e pushada
- [ ] Release notes geradas automaticamente
- [ ] Artefatos anexados na Release do GitHub
