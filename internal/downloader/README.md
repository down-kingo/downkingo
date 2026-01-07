# Downloader Package

O pacote `internal/downloader` é o núcleo de processamento do DownKingo, responsável por orquestrar a fila de downloads, gerenciar concorrência e integrar com o wrapper do `youtube-dl/yt-dlp`.

## Arquitetura do Manager

O `Manager` utiliza o padrão **Worker Pool** com um semáforo para controle de concorrência.

### Componentes Chave

- **Queue (`chan *Job`)**: Canal bufferizado que recebe novos pedidos de download.
- **ActiveSlots (`chan struct{} `)**: Semáforo que limita downloads simultâneos (Padrão: 3).
- **Jobs Map**: Mapa thread-safe para rastrear e cancelar downloads ativos por ID.

## Ciclo de Vida de um Job

1.  **AddJob**:

    - Verifica duplicidade ativa.
    - Cria registro `pending` no banco de dados.
    - Emite evento `download:added` para UI.
    - Envia para a fila.

2.  **ProcessJob** (Worker):

    - Adquire slot do semáforo.
    - **Etapa 1: Metadados**: Bate na API (yt-dlp -J) para pegar título/thumb. Atualiza DB.
    - **Etapa 2: Download**: Inicia o download real (bloqueante).
    - **Callbacks**: Recebe progresso e logs do `yt-dlp` e retransmite via Wails events.

3.  **Finalização**:
    - **Sucesso**: Marca como `completed` no DB.
    - **Falha**: Marca como `failed` e salva mensagem de erro.
    - **Incognito**: Se a flag `Incognito` estiver ativa, o registro é deletado do banco imediatamente após conclusão (sucesso ou falha).

## Restauração de Sessão

Ao iniciar, o Manager chama `restorePendingJobs()`. Isso busca no banco de dados downloads que foram interrompidos (status `pending`) e os recoloca na fila automaticamente, garantindo que nada seja perdido se o app for fechado.

## Eventos Emitidos

- `download:added`: Novo download na fila.
- `download:progress`: Atualização de % ou metadados.
- `download:log`: Log "cru" do terminal (para modo debug/verbose na UI).
