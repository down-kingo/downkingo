# Clipboard Package

O pacote `internal/clipboard` implementa um monitoramento inteligente da área de transferência do sistema para detectar links de mídia suportados (YouTube, Instagram, etc.).

## Funcionalidades

### Adaptive Backoff (Polling Eficiente)

O monitor não utiliza um intervalo ouvinte do SO (hooks), mas sim um polling adaptativo para economizar CPU:

- **Fast Mode (`500ms`)**: Ativado quando o conteúdo do clipboard muda.
- **Slow Mode (`3s`)**: Ativado quando o clipboard está ocioso.
- **Backoff**: O intervalo aumenta exponencialmente (`x2`) até o máximo quando não há mudanças.

### Validação de Links

A validação é feita sem Regex complexas para performance, utilizando `net/url` e verificação de sufixo de domínio.

**Domínios Suportados:**

- YouTube (`youtube.com`, `youtu.be`)
- Instagram (`instagram.com`)
- TikTok (`tiktok.com`)
- Twitter/X (`twitter.com`, `x.com`)
- Facebook (`facebook.com`, `fb.watch`)
- Twitch, Vimeo, Dailymotion, Pinterest, Reddit, Threads, SoundCloud.

## Uso

O monitor deve ser instanciado e iniciado com um contexto cancelável.

```go
monitor := clipboard.NewMonitor()
monitor.Start(ctx)
defer monitor.Stop()
```

### Eventos

Quando um link válido é detectado, o monitor emite um evento Wails para o frontend:

- **Evento**: `clipboard:link-detected`
- **Payload**: `string` (A URL detectada)
