# Logger Package

O pacote `internal/logger` implementa o sistema de logs do DownKingo, utilizando [zerolog](https://github.com/rs/zerolog) para alta performance e logs estruturados (JSON).

## Inicialização

O logger deve ser inicializado no startup da aplicação (normalmente em `app.go`), passando o diretório onde os logs devem ser salvos.

```go
// Em app.go
logger.Init(appDataDir)
```

Isso cria um arquivo `downkingo.log` dentro de `AppData/logs/`.

## Características

- **Saída Estruturada**: Logs são gravados em JSON, facilitando parseamento por ferramentas externas se necessário.
- **Contexto Automático**: Inclui Timestamp (`RFC3339`) e Caller (arquivo:linha) para facilitar debugging.
- **Rotação**: Atualmente o log é incrementado em um arquivo único `downkingo.log` (TO-DO: Implementar rotação de logs).

## Uso

O pacote expõe uma variável global `Log` (zerolog.Logger).

```go
import "downkingo/internal/logger"

// Info
logger.Log.Info().Str("module", "main").Msg("Aplicação iniciada")

// Erro
logger.Log.Error().Err(err).Str("url", url).Msg("Falha ao baixar vídeo")

// Debug
logger.Log.Debug().Int("count", 42).Msg("Processando items")
```

> **Nota:** Use `Log.Debug()` para informações verbosas que não devem poluir o log de produção, a menos que o nível de log seja alterado.
