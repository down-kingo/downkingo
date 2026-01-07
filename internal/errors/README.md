# Errors Package

O pacote `internal/errors` fornece uma estratégia unificada de tratamento de erros para o DownKingo, permitindo erros ricos com contexto, códigos para o frontend e mensagens amigáveis para o usuário.

## Estrutura `AppError`

A base do tratamento de erros é a struct `AppError`:

```go
type AppError struct {
    Op      string // Operação onde o erro ocorreu (ex: "VideoHandler.GetVideoInfo")
    Err     error  // O erro original (underlying error)
    Message string // Mensagem amigável para o usuário (ex: "Não foi possível conectar...")
    Code    string // Código de erro para o Frontend (ex: "ERR_NETWORK")
}
```

## Como Usar

### Criando Erros

Use os construtores para adicionar contexto ao erro original:

```go
// Erro técnico com operação
return errors.New("VideoHandler.Fetch", err)

// Erro com mensagem para o usuário
return errors.NewWithMessage("Service.Login", err, "Credenciais inválidas")

// Erro com código para o Frontend tratar
return errors.NewWithCode("API.GetData", err, "ERR_RATE_LIMIT", "Muitas requisições")
```

### Checando Erros (Sentinel Errors)

O pacote define erros sentinela que podem ser verificados com `errors.Is()`:

- `ErrNotFound`: Recurso não encontrado.
- `ErrAlreadyExists`: Recurso duplicado.
- `ErrDownloadFailed`: Falha genérica no download.
- `ErrRateLimited`: Limite de requisições excedido.

Exemplo de verificação:

```go
if errors.IsNotFound(err) {
    // Tratar 404
}
```

### Wrapping

Para adicionar contexto a um erro existente sem perder a referência original (permitindo `errors.Is` e `errors.As` funcionarem):

```go
if err != nil {
    return errors.Wrap("Database.Query", err)
}
```
