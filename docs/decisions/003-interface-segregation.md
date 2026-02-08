# ADR-003: Interfaces definidas no consumidor (Interface Segregation)

## Status
Aceito

## Contexto
Os handlers precisam de servicos (YouTube client, download manager), mas nao devem depender de tipos concretos para manter testabilidade.

## Decisao
Seguimos o principio Go de **definir interfaces onde sao consumidas**, nao onde sao implementadas:

```go
// Em handlers/video.go (consumidor)
type YouTubeClientInterface interface {
    GetVideoInfo(ctx context.Context, url string) (*VideoInfo, error)
    Download(ctx context.Context, opts DownloadOptions, ...) error
    UpdateYtDlp(channel string) (string, error)
}
```

Em vez de uma interface gigante em `interfaces/interfaces.go`, cada handler declara **apenas os metodos que usa**.

## Consequencias
- **Positivo**: Mocks minimos nos testes (so implementar o necessario)
- **Positivo**: Dependencias explicitas (o handler documenta o que precisa)
- **Positivo**: Idiomatico em Go (Rob Pike: "the bigger the interface, the weaker the abstraction")
- **Negativo**: `interfaces/interfaces.go` ainda existe como referencia, pode confundir (manter como documentacao, nao como contrato)
- Cada handler pode evoluir independentemente
