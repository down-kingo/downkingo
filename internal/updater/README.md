# Updater Package

O pacote `internal/updater` gerencia o ciclo de vida de atualizações automáticas da aplicação, integrando-se diretamente com o GitHub Releases.

## Configuração

Atualmente, o updater busca atualizações no repositório configurado nas constantes:

- **Owner**: `Capman002`
- **Repo**: `magpie`

> **Nota**: Verifique se estas constantes apontam para o repositório correto do DownKingo antes de produção.

## Fluxo de Atualização

1.  **Check**: `CheckForUpdate()` compara a versão atual (injetada no build) com a tag da última release no GitHub (ex: `v2.0.0` > `v1.9.0`).
2.  **Download**: Se disponível, baixa o asset correspondente ao SO (`windows`, `darwin`, `linux`) para um arquivo temporário.
3.  **Apply**: Realiza a substituição atômica do executável:
    - Renomeia o executável atual para `.old`.
    - Move o novo executável para o local original.
    - Em caso de falha, restaura o backup.
4.  **Restart**: Solicita ao Wails que encerre a aplicação (`RestartApp` ou `runtime.Quit`), permitindo que o usuário reinicie a nova versão.

## Estruturas de Dados

- `Release`: Mapeia a resposta da API do GitHub.
- `UpdateInfo`: Estrutura simplificada enviada ao Frontend contendo changelog, tamanho e URL.

## Eventos de Progresso

Durante o download, eventos são emitidos via Wails para exibir barra de progresso no frontend:

- `updater:progress`: `{ status: "downloading", percent: 45.5 }`
