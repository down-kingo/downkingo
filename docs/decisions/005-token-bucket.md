# ADR-005: Token Bucket para rate limiting

## Status
Aceito

## Contexto
O app faz chamadas a servicos externos (YouTube, Instagram, GitHub) que podem bloquear por excesso de requests. Precisamos de rate limiting no client-side.

Opcoes:
- Token bucket
- Leaky bucket
- Fixed window counter
- `golang.org/x/time/rate`

## Decisao
Implementacao propria de **token bucket** porque:

1. **Burst-friendly**: permite rajadas curtas (o usuario pode colar 5 URLs rapido), diferente do leaky bucket que forca taxa constante
2. **Simplicidade**: ~90 linhas de codigo, sem dependencia externa
3. **Per-endpoint**: `PerEndpointLimiter` permite limites diferentes (Instagram mais restrito que YouTube)
4. **Previsivel**: o usuario entende "10 requests, recarrega 2/seg" melhor que abstrações complexas

`x/time/rate` foi descartado por ser mais complexo do que o necessario para um app desktop.

## Consequencias
- Limiters globais: `VideoInfoLimiter`, `DownloadLimiter`, `InstagramLimiter`
- `Wait(ctx)` aceita context para cancelamento (nao bloqueia infinitamente)
- Sem persistencia: limites resetam ao reiniciar o app (comportamento desejado)
