<p align="center">
  <a href="README.md">English</a> | <strong>Português</strong>
</p>

<p align="center">
  <img src="build/appicon.png" width="120" height="120" alt="Logo do DownKingo">
</p>

<h1 align="center">DownKingo</h1>

<p align="center">
  <strong>Baixe, edite, converta e transcreva mídias em um único aplicativo nativo para Windows.</strong>
</p>

<p align="center">
  Desenvolvido com Go, Wails v3, React, yt-dlp, FFmpeg e Whisper.cpp.
</p>

<p align="center">
  <a href="https://github.com/down-kingo/downkingo/releases/latest">
    <img src="https://img.shields.io/github/v/release/down-kingo/downkingo?style=for-the-badge&color=E11D48&logo=github" alt="Versão mais recente">
  </a>
  <a href="https://github.com/down-kingo/downkingo/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/down-kingo/downkingo/release.yml?style=for-the-badge&label=Build&logo=github-actions" alt="Estado do build">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/down-kingo/downkingo?style=for-the-badge&color=E11D48" alt="Licença MIT">
  </a>
</p>

<p align="center">
  <a href="https://downkingo.com">Site</a> ·
  <a href="https://github.com/down-kingo/downkingo/releases/latest">Download</a> ·
  <a href="https://github.com/orgs/down-kingo/projects/2">Roadmap ao vivo</a>
</p>

<p align="center">
  <img src="public/download-v3.1.2.avif" width="100%" alt="Tela de download de vídeos do DownKingo v3.1.2">
</p>

## O que é o DownKingo?

O DownKingo é uma central de mídia para desktop. Cole um link, veja os formatos disponíveis, escolha a qualidade do vídeo ou do áudio, corte o conteúdo ou adicione legendas e envie o resultado para uma fila persistente. O mesmo aplicativo também baixa imagens, converte e comprime arquivos locais, transcreve áudio e vídeo de forma offline e mantém o histórico dos downloads.

A versão **3.1.2** utiliza a arquitetura Wails v3 e atualmente é distribuída como executável para Windows.

## Funcionalidades atuais

### Download de vídeo e áudio

- Resolve URLs aceitas pelo **yt-dlp**, incluindo YouTube, Instagram, TikTok, X/Twitter e muitos outros serviços.
- Exibe os metadados e as opções de vídeo, áudio, resolução e formato antes do download.
- Pode usar os cookies de um navegador instalado quando o serviço exige uma sessão autenticada.
- Inclui monitor da área de transferência para detectar links de mídia copiados.
- Permite configurar as pastas de destino e a compatibilidade do vídeo.

### Fila e histórico

- Fila persistente com progresso em tempo real, cancelamento e downloads simultâneos.
- Reordenação por arrastar e soltar e limite configurável de tarefas concorrentes.
- Histórico persistente para localizar rapidamente os downloads concluídos.
- Mensagens claras e acionáveis para estados e erros de rede.

### Editor de vídeo integrado

- Corte e divida o vídeo nas partes desejadas antes do download.
- Veja a prévia do conteúdo e da duração final em uma linha do tempo interativa.
- Selecione faixas de legenda, adicione legendas e configure o estilo visual.
- Gera a mídia editada pelo mesmo fluxo de download baseado em FFmpeg.

<p align="center">
  <img src="public/editor-de-video-v3.1.2.avif" width="100%" alt="Editor de vídeo do DownKingo v3.1.2 com linha do tempo e legendas">
</p>

### Download de imagens

- Fluxo dedicado ao download de imagens com detecção de URL.
- Pasta de destino, formato de saída e qualidade da imagem configuráveis.
- Ferramentas de imagem separadas dos vídeos, permitindo ativar cada módulo de forma independente.

### Conversor de mídia

- Conversão de vídeo para vídeo com escolha de formato e codec.
- Extração de áudio a partir de vídeos.
- Conversão de imagens entre formatos.
- Compressão de vídeos e imagens com níveis de qualidade e estimativa do tamanho final.
- Lista de vários arquivos, acompanhamento do progresso e resumo do resultado.

### Transcrição offline

- Transcreve áudio e vídeo locais com o **Whisper.cpp** no próprio computador.
- Instalação guiada do Whisper e dos modelos de reconhecimento de fala.
- Gerenciador para instalar, selecionar e remover modelos.
- Detecção automática ou seleção manual do idioma.
- O resultado pode ser copiado ou salvo como **TXT**, **SRT** ou **VTT**.

### Personalização e integrações

- Cinco idiomas de interface: português do Brasil, inglês, espanhol, francês e alemão.
- Temas claro e escuro, cinco cores de destaque e navegação lateral ou superior.
- Ative somente os módulos que usa: vídeos, imagens, conversor e transcritor.
- Atalhos de teclado, monitor da área de transferência, pastas de download e inicialização com o Windows configuráveis.
- Roadmap dentro do app com autenticação GitHub, votação e envio de novas sugestões.
- Verificação de atualizações integrada ao GitHub Releases.

<table>
  <tr>
    <td width="50%">
      <img src="public/config-tema-v3.1.2.avif" alt="Configurações de tema, cor e navegação">
    </td>
    <td width="50%">
      <img src="public/config-idioma-3.1.2.avif" alt="Configurações de idioma, módulos e armazenamento">
    </td>
  </tr>
  <tr>
    <td align="center"><sub>Tema, cor de destaque e formato da navegação</sub></td>
    <td align="center"><sub>Idiomas, módulos opcionais e pastas de download</sub></td>
  </tr>
</table>

## Processamento local e acesso à rede

A conversão de mídia e a transcrição com Whisper acontecem localmente. A rede é usada para consultar e baixar mídias remotas, instalar dependências e modelos opcionais, verificar atualizações e sincronizar o roadmap da comunidade. O login no GitHub é opcional e necessário apenas para ações como votar ou enviar sugestões.

## Instalação

Os binários oficiais são publicados atualmente para **Windows**.

| Plataforma | Estado | Download |
| :--- | :--- | :--- |
| Windows | Versão oficial disponível | [Baixar o `DownKingo.exe` mais recente](https://github.com/down-kingo/downkingo/releases/latest) |

Linux e macOS não possuem binários oficiais da v3.1.2.

Na primeira execução, o DownKingo permite escolher os módulos desejados e instala as ferramentas necessárias, como yt-dlp e FFmpeg. O Whisper e os modelos de idioma só são instalados quando a transcrição é ativada.

## Uso rápido

1. Cole uma URL de mídia na página **Downloads**.
2. Escolha vídeo ou áudio e selecione a qualidade desejada.
3. Se quiser, abra o editor para cortar trechos ou configurar legendas.
4. Adicione o item à fila e acompanhe o progresso.
5. Use **Converter** para arquivos locais ou **Transcritor** para transformar fala em texto de forma offline.

## Desenvolvimento

### Requisitos

- Go 1.25+
- Bun
- [Task](https://taskfile.dev/) — `go install github.com/go-task/task/v3/cmd/task@latest`
- CLI do Wails v3 — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`

### Executar localmente

```bash
git clone https://github.com/down-kingo/downkingo.git
cd downkingo

cd frontend
bun install
cd ..

task dev
```

### Comandos úteis

| Comando | Descrição |
| :--- | :--- |
| `task dev` | Executa o app Wails com recarregamento do frontend |
| `task build` | Compila a aplicação Go |
| `task build:production` | Compila o frontend e o executável de produção |
| `task generate` | Gera novamente os bindings do Wails |
| `task frontend:test` | Executa os testes do frontend com Vitest |
| `task frontend:build` | Verifica os tipos e compila o frontend |

### Arquitetura principal

```text
downkingo/
├── app.go                 # Fachada Wails exposta ao frontend
├── main.go                # Inicialização da aplicação nativa
├── internal/
│   ├── downloader/        # Fila persistente de downloads simultâneos
│   ├── handlers/          # Fluxos de vídeo, imagem, conversão e configurações
│   ├── roadmap/           # Sincronização do GitHub Project com o CDN
│   ├── storage/           # Persistência em SQLite
│   ├── updater/           # Atualizador via GitHub Releases
│   ├── whisper/           # Instalação e transcrição com Whisper.cpp
│   └── youtube/           # Integração com yt-dlp e leitura de progresso
├── frontend/
│   ├── bindings/          # Bindings gerados pelo Wails
│   └── src/               # React 19, TypeScript, Tailwind CSS, Zustand e i18n
├── build/                 # Ícones e recursos do pacote Windows
├── docs/                  # Documentação de arquitetura, operação e contribuição
└── .github/               # CI, release e publicação do roadmap
```

## Tecnologias

| Camada | Stack |
| :--- | :--- |
| Runtime desktop | Wails v3 |
| Backend | Go 1.25, zerolog, modernc/sqlite |
| Frontend | React 19, TypeScript 6, Vite 8 |
| Interface e estado | Tailwind CSS 4, Zustand |
| Mídia | yt-dlp, FFmpeg, aria2c, Whisper.cpp |
| Testes | Go test, Vitest, React Testing Library |
| Distribuição | Executável para Windows e atualizador integrado |

## Roadmap

A fonte oficial é o [Projeto público #2 do DownKingo](https://github.com/orgs/down-kingo/projects/2). O aplicativo reproduz as quatro etapas — ideias, planejado, em produção e entregue — usando o campo de status do Project, e não o estado aberto/fechado da issue.

O workflow [Roadmap Sync](.github/workflows/roadmap-sync.yml) publica o roadmap traduzido no CDN consumido tanto pelo aplicativo de produção quanto pelo `wails3 dev`.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contrato de eventos](docs/EVENTS.md)
- [Perguntas frequentes](docs/FAQ.md)
- [Solução de problemas](docs/TROUBLESHOOTING.md)
- [Processo de release](docs/RELEASE.md)
- [Licenças de terceiros](docs/LICENSES.md)
- [Decisões de arquitetura](docs/decisions/)

## Contribuindo

Contribuições são bem-vindas. Leia o [Guia de Contribuição](CONTRIBUTING.md) antes de abrir uma issue ou pull request.

## Licença

O DownKingo é distribuído sob a [Licença MIT](LICENSE).
