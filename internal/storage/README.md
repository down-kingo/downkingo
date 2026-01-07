# Storage Package

O pacote `internal/storage` gerencia a camada de persistência de dados do DownKingo, utilizando SQLite em modo Go-puro (sem CGO) via `modernc.org/sqlite`.

## Banco de Dados (`downkingo.db`)

O arquivo do banco é criado no diretório de dados da aplicação (`AppData`).

### Configuração de Performance

O banco é inicializado com PRAGMAs otimizados para aplicações desktop locais:

- `journal_mode = WAL`: Write-Ahead Logging para concorrência (leitura não bloqueia escrita).
- `synchronous = NORMAL`: Balanceia segurança e velocidade de disco.
- `foreign_keys = ON`: Integridade referencial.

## Esquema (Schema)

### Tabela `downloads`

Armazena o histórico e fila de downloads.

- `id` (UUID): Identificador único.
- `status`: Enum (`pending`, `downloading`, `completed`, etc.).
- `progress`, `speed`, `eta`: Dados voláteis de progresso.
- `file_path`: Caminho final do arquivo no disco.

### Tabela `settings`

Armazena preferências do usuário (chave-valor).

### Tabela `roadmap_cache`

Cache persistente para os dados do roadmap (Sincronizado via CDN).

## DownloadRepository

O `DownloadRepository` abstrai as queries SQL. Principais operações:

- `Create(d *Download)`: Insere novo download.
- `GetQueue()`: Retorna downloads não finalizados (Status != completed/failed).
- `GetHistory(limit)`: Retorna downloads finalizados ordenados por data.
- `UpdateProgress()`: Atualização otimizada apenas de campos de progresso.

## Uso

```go
db, err := storage.New(appDataDir)
repo := storage.NewDownloadRepository(db)

// Criar
repo.Create(&storage.Download{URL: "..."})

// Buscar Fila
queue, err := repo.GetQueue()
```
