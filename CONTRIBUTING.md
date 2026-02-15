# Contribuindo para o DownKingo

Obrigado por considerar contribuir para o DownKingo!

## Como Contribuir

### Reportando Bugs

1. Verifique se o bug ja nao foi reportado em [Issues](https://github.com/down-kingo/downkingo/issues)
2. Se nao encontrar, abra uma nova issue usando o template de bug report:
   - Descricao clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicavel)
   - Sistema operacional e versao

### Sugerindo Features

Voce pode sugerir features de duas formas:

- **Pelo app**: Use o Roadmap interativo dentro do DownKingo para votar e sugerir funcionalidades.
- **Pelo GitHub**: Abra uma issue com o template de feature request.

### Pull Requests

1. Fork o repositorio
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faca suas alteracoes
4. Rode os testes localmente (`task frontend:test` e `go test ./...`)
5. Commit suas mudancas (`git commit -m 'feat: adiciona nova feature'`)
6. Push para a branch (`git push origin feature/nova-feature`)
7. Abra um Pull Request

## Setup de Desenvolvimento

### Pre-requisitos

- **Go 1.25+**
- **Bun** (runtime JS rapido)
- **Task** — `go install github.com/go-task/task/v3/cmd/task@latest`
- **Wails v3 CLI** — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### Primeiros passos

```bash
# Clone
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

# Dependencias do Frontend
cd frontend && bun install && cd ..

# Modo desenvolvimento
task dev
```

### Tasks uteis

```bash
task dev                # Desenvolvimento com hot reload
task build              # Build da aplicacao
task build:production   # Build completo de producao
task generate           # Regenerar bindings TypeScript
task frontend:test      # Rodar testes do frontend
```

## Convencoes de Codigo

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova feature
- `fix:` correcao de bug
- `docs:` documentacao
- `style:` formatacao
- `refactor:` refatoracao
- `test:` testes
- `chore:` manutencao

### Go

- Use `gofmt` para formatacao
- Siga as convencoes do [Effective Go](https://go.dev/doc/effective_go)
- Handlers aceitam **interfaces** (nao tipos concretos) — Interface Segregation Principle
- Erros tipados via `AppError` com `Op`, `Message` e `Code`

### TypeScript/React

- TypeScript strict mode
- Componentes funcionais com hooks
- Tailwind CSS para estilizacao
- Zustand para gerenciamento de estado
- Todas as strings de UI devem passar por i18n (`useTranslation()`)

## Estrutura do Projeto

```
downkingo/
├── main.go                 # Bootstrap Wails v3
├── app.go                  # Facade (metodos expostos ao frontend)
├── Taskfile.yml            # Task runner
├── internal/               # Logica de negocio (Go)
│   ├── handlers/           # Camada de handlers (Video, Media, Settings, System, Converter, Transcriber)
│   ├── downloader/         # Worker pool com concorrencia controlada
│   ├── youtube/            # Wrapper do yt-dlp
│   ├── storage/            # SQLite (modernc, sem CGO)
│   ├── config/             # Configuracao JSON
│   ├── logger/             # Zerolog com rotacao
│   ├── whisper/            # Integracao Whisper
│   └── ...                 # auth, clipboard, events, errors, validate, etc.
└── frontend/               # React 19 + TypeScript
    ├── bindings/           # Bindings auto-gerados (Wails v3)
    ├── src/pages/          # Paginas (Home, Dashboard, Setup, Roadmap, Transcriber)
    ├── src/components/     # Componentes reutilizaveis
    ├── src/stores/         # Estado (Zustand)
    └── src/i18n/           # Internacionalizacao (5 locales)
```

## Testes

```bash
# Testes Go
go test ./...

# Testes do frontend
task frontend:test

# Testes com coverage
cd frontend && bun run test:coverage
```

## Duvidas?

- Abra uma [Discussion](https://github.com/down-kingo/downkingo/discussions)
- Reporte bugs via [Issues](https://github.com/down-kingo/downkingo/issues)
