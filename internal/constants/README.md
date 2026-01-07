# Constants Package

O pacote `internal/constants` centraliza todas as constantes mágicas, configurações estáticas e definições de limites do DownKingo.

## Propósito

Evitar "números mágicos" e strings espalhadas pelo código, facilitando a manutenção e garantindo consistência em toda a aplicação.

## Categorias de Constantes

### Application Metadata

Informações fundamentais da aplicação.

- `AppName`: Nome da aplicação ("DownKingo").
- `ConfigFile`: Nome do arquivo de configurações persistidas ("settings.json").
- `DBFile`: Nome do banco de dados local ("downkingo.db").

### Timeouts

Definições de tempo limite para operações de rede e I/O.

- `HTTPTimeout`: 30 segundos.
- `DownloadTimeout`: 2 horas (limite máximo por download).
- `ClipboardPollInterval`: Frequência de verificação da área de transferência.

### Queue Settings

Configurações da fila de downloads.

- `MaxConcurrentDownloads`: Limite padrão de downloads paralelos (3).
- `MaxQueueSize`: Tamanho máximo da fila (100).

### Supported Formats

Listas de formatos suportados que são validadas em todo o sistema.

- **Audio**: mp3, m4a, opus, flac, wav, aac.
- **Video**: mp4, mkv, webm, avi, mov.
- **Image**: original, png, jpg, jpeg, webp, avif.

### Wails Events

Nomes de eventos utilizados na comunicação Backend <-> Frontend.

- `EventAppReady`: Aplicação carregada.
- `EventDownloadProgress`: Atualização de progresso.
- `EventClipboardDetected`: Link detectado na área de transferência.
- ... e outros definidos em `constants.go`.
