# Config Package

O pacote `internal/config` gerencia todas as configurações persistentes do usuário e estados da aplicação armazenados em `settings.json`.

## Estrutura de Configuração (`settings.json`)

A struct `Config` mapeia o arquivo JSON e inclui:

1.  **Caminhos de Download**:
    - `VideoDownloadPath`: Diretório para salvar vídeos.
    - `ImageDownloadPath`: Diretório para salvar imagens.
2.  **Configurações de Imagem**: Formato preferido (png, jpg, avif) e qualidade.
3.  **Atalhos (Shortcuts)**: Customização de teclas de atalho (ex: `Ctrl+Downloads`).
4.  **Monitoramento**: `ClipboardMonitorEnabled`.
5.  **Roadmap**: Integração com CDN (`CDNEnabled`, `CDNBaseURL`).

## Gerenciamento de Concorrência

Como as configurações podem ser lidas e gravadas por múltiplas goroutines (backend e chamadas do frontend via Wails), o pacote utiliza `sync.RWMutex` para garantir acesso thread-safe.

### Leitura

Use `config.Get()` para obter uma cópia segura (snapshot) da configuração atual.

```go
cfg := config.Get()
fmt.Println(cfg.DownloadsPath)
```

### Escrita

Use `config.Update()` passando uma função callback para garantir atomicidade nas mudanças.

```go
config.Update(func(c *Config) {
    c.ClipboardMonitorEnabled = false
})
// O arquivo settings.json é salvo automaticamente após Update se você chamar Save() (a ser verificado na implementação de uso)
// CORREÇÃO: O método Update apenas atualiza em memória. É necessário chamar Save() explicitamente se desejar persistir.
```

## Environment Variables (Overrides)

Para facilitar desenvolvimento, CI/CD e testes, algumas configurações podem ser sobrescritas por variáveis de ambiente:

- `DOWNKINGO_ROADMAP_CDN`: "true" ou "1" força o uso do CDN.
- `DOWNKINGO_ROADMAP_CDN_URL`: Define a URL base do CDN do roadmap.

## Migrações

O método `Load()` contém lógica de migração automática para suportar versões antigas do arquivo de configuração (ex: migrando `DownloadsPath` único para `VideoDownloadPath` e `ImageDownloadPath` separados).
