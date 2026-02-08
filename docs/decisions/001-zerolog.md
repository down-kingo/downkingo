# ADR-001: zerolog para logging estruturado

## Status
Aceito

## Contexto
Precisamos de um logger estruturado para o backend Go. As opcoes consideradas:
- `log/slog` (stdlib, Go 1.21+)
- `zerolog` (terceiros, zero-allocation)
- `zap` (Uber, alto desempenho)

## Decisao
Escolhemos **zerolog** pelos seguintes motivos:

1. **Zero allocation**: nao aloca memoria no heap em hot paths, importante para um app desktop que roda continuamente
2. **API fluente**: `Log.Info().Str("id", id).Msg("done")` e mais legivel e Go-idiomatico que fmt-style
3. **JSON por padrao**: logs estruturados facilitam debug (grep por campo, filtro por nivel)
4. **Menor footprint** que zap, adequado para desktop (nao e um servidor de alta carga)

`slog` foi descartado porque na epoca da decisao inicial nao tinha a mesma maturidade de ecossistema, e zerolog ja atendia bem.

## Consequencias
- Dependencia externa (`github.com/rs/zerolog`)
- Todos os pacotes usam `logger.Log` global em vez de injetar logger
- Migracao para slog no futuro e possivel sem impacto na API publica
