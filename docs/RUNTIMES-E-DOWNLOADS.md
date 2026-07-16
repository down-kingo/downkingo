# Runtimes locais, transcrição e downloads acelerados

Este documento registra as decisões técnicas, versões, fluxos, testes e limitações dos componentes externos usados pelo DownKingo. Ele deve ser atualizado sempre que Whisper.cpp, aria2c, yt-dlp, FFmpeg ou seus parâmetros forem alterados.

## Isolamento entre desenvolvimento e produção

O DownKingo mantém dados e binários separados por modo de execução:

| Ambiente | Diretório |
| --- | --- |
| `wails3 dev` | `%AppData%/DownKingo-dev` |
| Produção | `%AppData%/DownKingo` |

Em 11/07/2026, o aria2c estava instalado somente no ambiente dev. Ativar ou remover um componente em dev não altera a produção.

## Whisper.cpp

### Runtime suportado

- Versão: `1.9.1`.
- Pacote Windows x64: `whisper-bin-x64.zip`.
- SHA-256 do pacote: `7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539`.
- Instalação: `whisper/runtimes/v1.9.1`.
- O runtime é baixado em arquivo temporário, validado, extraído em staging e ativado por rename.
- A instalação só é aceita quando todos os arquivos obrigatórios existem e `whisper-cli --version` retorna a versão suportada.
- Instalações legadas, como `1.8.3`, não são usadas pela versão atual do aplicativo.

### Modelos

Os modelos são mantidos fora do diretório do runtime para sobreviver a atualizações. O catálogo aceita somente nomes, tamanhos e hashes conhecidos.

Modelos disponíveis:

- `tiny`;
- `base`;
- `small` e `small-q5_1`;
- `medium` e `medium-q5_0`;
- `large-v3-turbo` e `large-v3-turbo-q5_0`.

Downloads usam uma revisão fixa do repositório de modelos. O SHA-256 é conferido antes da ativação. Modelos antigos são verificados integralmente na primeira utilização e recebem um marcador local contendo hash, tamanho e data de modificação.

### Fluxo de transcrição

```text
arquivo de áudio/vídeo
        ↓
FFmpeg: WAV PCM 16-bit, mono, 16 kHz
        ↓
whisper-cli -l auto -oj
        ↓
JSON oficial com idioma, offsets e segmentos
        ↓
Go: TXT, SRT, VTT ou DOCX
```

- Todos os arquivos, inclusive WAV, são normalizados.
- Arquivos temporários são exclusivos e ficam no diretório temporário do sistema.
- A detecção automática e a transcrição acontecem na mesma execução.
- O parser não depende mais do texto formatado do terminal.
- VAD Silero `v6.2.0` é opcional, desativado por padrão e baixado com SHA-256 na primeira utilização.

### Legendas no editor de vídeo

O editor trabalha com uma lista canônica de trechos `{start, end, text}`. A origem pode ser:

1. uma legenda manual ou automática anunciada pelo yt-dlp;
2. uma transcrição nova feita localmente pelo Whisper;
3. o modo automático, que tenta a faixa do vídeo e usa o Whisper quando ela não existe.

Para pré-visualização e revisão, `GetVideoSubtitles` executa o yt-dlp sem baixar o vídeo, solicita apenas o idioma escolhido e converte SRT/VTT para a lista canônica. Os mapas completos de `subtitles` e `automatic_captions` não são enviados ao frontend; os metadados expõem somente a lista compacta de idiomas e a origem manual/automática. O texto importado pode ser corrigido no editor antes de entrar na fila.

Quando não há faixa e o modo permite fallback, o vídeo já baixado é normalizado pelo mesmo pipeline do Transcritor e processado pelo modelo Whisper selecionado. Se nenhum modelo estiver instalado, o job falha com uma orientação para instalar um na aba Transcritor. A transcrição recebe o contexto do job, portanto cancelar o download também cancela FFmpeg/Whisper.

As legendas visuais são geradas em ASS. O arquivo usa uma camada para o fundo e outra para texto/contorno, permitindo configurar independentemente fonte, tamanho, negrito, itálico, cores, opacidade, contorno e posição. O filtro `ass` do FFmpeg grava o resultado nos quadros; não se trata apenas de uma faixa opcional do contêiner. Por isso o vídeo passa por reencode H.264 (`libx264`, CRF 18, preset medium, `yuv420p`) e o áudio por AAC 192 kbit/s. Em vídeos com cortes, cada trecho de legenda é intersectado com os segmentos preservados e recebe o deslocamento da timeline final antes da renderização.

Fontes são resolvidas pelo provedor de fontes do sistema usado pelo libass. Quando uma família escolhida não estiver instalada, o sistema pode usar uma substituta. A prévia no WebView aproxima o resultado final, enquanto a renderização ASS/FFmpeg é a referência definitiva.

## aria2c e yt-dlp

### Autenticação e bloqueio anti-bot do YouTube

Quando o YouTube responde com `Sign in to confirm you're not a bot`, o problema também ocorre ao executar o yt-dlp diretamente e não é corrigido apenas atualizando o binário. O app transforma essa saída técnica em uma orientação curta e só usa `--cookies-from-browser` depois que o usuário escolhe explicitamente Chrome, Edge, Firefox ou Brave.

### Verificação automática do YouTube (PO Token)

O DownKingo usa o `bgutil-ytdlp-pot-provider-rs` 0.8.1 como processo local
separado e o plugin Python correspondente do yt-dlp. Os dois artefatos vêm da
mesma release pública, são exibidos individualmente no Setup e são verificados
antes do uso:

- provedor Windows x64 SHA-256: `25d6b05c79176aa792454c3d1727922ca47e56cf11cb1e866615d751819b14a0`;
- plugin ZIP SHA-256: `99fd83b98fa93b193d6a3b69dc74410d76e7a2b889868c54d16121cac9060344`;
- código e licença GPL-3.0: <https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs>.

O backend Go escolhe uma porta livre, inicia o servidor oculto somente em
`127.0.0.1`, valida `/ping`, mantém o cache dentro do AppData do DownKingo e
encerra o processo junto com o aplicativo. O yt-dlp recebe um diretório de
plugins isolado e o argumento documentado
`youtubepot-bgutilhttp:base_url=http://127.0.0.1:PORT`. Para requisições públicas,
o cliente `mweb` é usado conforme a recomendação atual do guia de PO Tokens do
yt-dlp. Ao usar cookies escolhidos explicitamente pelo usuário, o yt-dlp mantém
seu comportamento de cliente autenticado.

O sidecar só é iniciado para URLs do YouTube. Outros sites suportados pelo
yt-dlp não dependem dele. Tokens PO reduzem verificações de bot, mas não garantem
acesso quando o IP já está bloqueado; cookies continuam sendo solicitados apenas
para conteúdo realmente autenticado ou quando a proteção automática não basta.

O conteúdo dos cookies não passa pelo código do DownKingo e não é persistido. O navegador autorizado é associado apenas à URL durante a execução atual e propagado para consulta de metadados, prévia do editor, importação de legendas e download. Nomes de navegador recebidos do frontend passam por uma allowlist antes de chegar ao subprocesso.

### Runtime suportado

- Versão: `1.37.0`.
- Pacote: `aria2-1.37.0-win-64bit-build1.zip`.
- SHA-256 do pacote: `67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288`.
- SHA-256 do `aria2c.exe`: `be2099c214f63a3cb4954b09a0becd6e2e34660b886d4c898d260febfe9d70c2`.
- Tamanho esperado do executável: `5.649.408 bytes`.

O aria2c só é considerado instalado quando:

1. o arquivo existe e possui o tamanho esperado;
2. o SHA-256 do executável confere;
3. `aria2c --version` executa sem erro;
4. a versão retornada é exatamente a suportada.

Launcher, tela de status e cliente yt-dlp usam a mesma validação. Um arquivo vazio, adulterado, incompatível ou não executável não ativa o modo Turbo. O pacote é verificado antes da extração, e a substituição do executável usa staging, backup e rename.

### Parâmetros de desempenho

| Opção | Padrão | Objetivo |
| --- | ---: | --- |
| Conexões aria2c | 16 | Dividir arquivos HTTP em conexões paralelas |
| Fragmentos DASH/HLS | 8 | Baixar fragmentos de manifests em paralelo |
| Máximo configurável de fragmentos | 16 | Evitar excesso de requisições e instabilidade |
| Tamanho mínimo da parte aria2c | 1 MiB | Permitir divisão de arquivos grandes |
| Buffer inicial yt-dlp | 16 KiB | Buffer redimensionável do downloader nativo |
| `--throttled-rate` | 1 MB/s | Renovar URL de mídia quando o yt-dlp detectar throttling |

O modo Turbo usa:

```text
--external-downloader <caminho-validado-do-aria2c>
--external-downloader-args "aria2c:-x N -s N -k 1M --file-allocation=none"
```

O DownKingo não desativa mais a validação de certificados HTTPS. Se o modo Turbo estiver habilitado e o runtime validado não estiver disponível, o download falha com uma mensagem explícita em vez de continuar silenciosamente pelo downloader nativo.

### Velocidade exibida

Quando a linha de progresso contém percentual e tamanho total, a velocidade armazenada e exibida é calculada como média da transferência do arquivo/formato atual. A janela é reiniciada quando o yt-dlp inicia um novo destino, como a troca de vídeo para áudio. Quando esses dados não estão disponíveis, permanece a velocidade informada pelo próprio downloader.

Não se deve avaliar velocidade usando arquivos muito pequenos. A inicialização das conexões, TLS, redirecionamentos e descoberta da URL dominam o tempo de um arquivo de poucos megabytes.

Conversão de unidades:

```text
500 Mb/s = 62,5 MB/s ≈ 59,6 MiB/s (máximo teórico)
```

### Resultados medidos no ambiente dev

Teste funcional com arquivo de 1,63 MiB:

- aria2c foi invocado pelo yt-dlp;
- argumentos `-x`, `-s`, `-k` e `--file-allocation` foram confirmados;
- resultado: `5,43 MiB/s`;
- o resultado não representa velocidade sustentada devido ao tamanho reduzido.

Teste de 50 MB usando o mesmo `aria2c.exe` do ambiente dev:

| Configuração | MiB/s | Mb/s aproximados |
| --- | ---: | ---: |
| 1 conexão | 29,01 | 243,4 |
| 16 conexões | 42,96 | 360,4 |

Nesse teste, 16 conexões melhoraram a vazão em aproximadamente 48%. O resultado real de vídeos ainda depende da origem remota da mídia, formato escolhido, fragmentação, Wi-Fi/rede local e rota da operadora. Não existe servidor intermediário do DownKingo.

### Controle rápido do Modo Turbo

A configuração rápida fica no ícone de engrenagem dentro da barra de URL. O acionador possui uma área mínima de 40×40 px e é separado visualmente das ações de colar/limpar para não parecer parte do texto digitado. O painel é ancorado à barra, possui cabeçalho e fechamento explícito, agrupa o estado do Turbo e as preferências gerais e usa atributos de diálogo não modal. O controle segue os mesmos tokens `primary-*` do restante da interface, portanto acompanha automaticamente a cor escolhida no tema. O usuário pode:

A aplicação de `theme` e `data-color` ocorre na raiz `App`, antes da pintura da interface. Assim, dashboard, navegação, setup e páginas carregadas sob demanda herdam a paleta selecionada sem depender da montagem da tela de downloads. A cor primária é reservada para ações e estados de destaque. Textos auxiliares, incluindo “Ver histórico completo” e o subtítulo “Downloader” da marca, usam tokens semânticos `surface-*`, adaptando-se ao modo claro/escuro sem assumir a cor de destaque configurada.

- ativar ou desativar o aria2c pelo switch do menu;
- escolher 4, 8, 16 ou 32 conexões HTTP;
- escolher 2, 4, 8 ou 16 fragmentos simultâneos para DASH/HLS;
- alternar rapidamente `skipExisting` e `embedThumbnail`.

As opções de conexões e fragmentos só são renderizadas quando o Modo Turbo está ativo. As duas opções gerais de download continuam disponíveis independentemente do aria2c.

Antes de ativar, a interface chama `CheckAria2cStatus` e só grava `useAria2c=true` se o executável do ambiente atual existir e passar na validação. Quando não está instalado, o próprio switch inicia a instalação em segundo plano, valida o resultado e só então ativa. Isso mantém Wails dev e produção isolados. A configuração fecha por clique externo ou pela tecla `Esc`, usa atributos de acessibilidade e possui textos em `pt-BR`, `en-US`, `es-ES`, `fr-FR` e `de-DE`.

## Carrosséis de imagens do Instagram

O scraper HTML do Instagram pode retornar apenas a capa OpenGraph mesmo quando o post é um carrossel. Por isso, uma única imagem encontrada pelo scraper nativo é tratada como resultado provisório. O DownKingo tenta então o yt-dlp e só usa a capa como fallback quando não há carrossel disponível.

Para carrosséis compostos somente por imagens, `GetPlaylistInfo` usa `--ignore-no-formats-error`. Sem essa opção, o yt-dlp reconhece a playlist e seus itens, mas descarta cada imagem por não possuir formatos de vídeo. As URLs de `thumbnail` emitidas para cada entrada são usadas como URLs das imagens. Itens sem URL são ignorados e a deduplicação preserva a ordem do carrossel.

O campo `thumbnail` escolhido automaticamente pelo yt-dlp pode ser uma variante pequena destinada à interface. No post de regressão, ele apontava para 480×640 (aproximadamente 50 KB), embora `thumbnails[0]` contivesse a imagem sem crop de 1440×1920 (aproximadamente 313 KB). O DownKingo agora avalia todas as candidatas, prioriza dimensões maiores e, no Instagram, prefere a URL sem parâmetro `stp` de resize/crop. Essa URL de maior qualidade é usada como fonte do preview, dos metadados e do download.

Na interface, o parâmetro `img_index` é respeitado como índice inicial. Ao selecionar uma imagem, o frontend consulta os metadados da URL direta para exibir tipo e tamanho reais; a resolução é preenchida pelas dimensões naturais carregadas pelo navegador. Valores indisponíveis não são apresentados como `0 Bytes`. A galeria usa grade responsiva, não possui altura fixa pela viewport e não exibe badges internos de depuração. A página usa até 1600 px da largura disponível, ocupando melhor janelas grandes, com padding reduzido progressivamente em telas menores.

Quando há pelo menos dois itens, a interface oferece “Baixar tudo”. O tipo é detectado automaticamente. Imagens são processadas sequencialmente pelo pipeline de formato/escala, enquanto vídeos são enviados ao mesmo gerenciador e à mesma fila usados pela tela de vídeos, com progresso, velocidade, ETA, cancelamento e histórico. Em carrosséis mistos, uma única ação processa ambos e abre a fila quando houver vídeo. O download do item selecionado segue a mesma detecção automática.

Na navegação e no dashboard não existem mais entradas separadas para “Vídeos” e “Imagens”: há apenas “Downloads”, que sempre abre a interface original de downloads de vídeo. O campo de URL, cabeçalho, configurações rápidas e estrutura visual dessa tela são a base única. URLs de YouTube, TikTok, Vimeo e arquivos de vídeo diretos seguem normalmente pelo fluxo robusto de vídeo. Ao detectar Instagram, X/Twitter ou uma imagem direta, o inspetor de mídia é renderizado dentro da área de resultados da mesma tela, sem cabeçalho, formulário ou página de imagens separados. Vídeos encontrados por esse inspetor são encaminhados para a mesma fila. Os estados internos `video` e `images` continuam existindo somente para compatibilidade técnica das preferências de recursos.

### Formato e escala por download

A galeria permite escolher `original`, JPG, PNG, WEBP ou AVIF e escalas de 25%, 50%, 75%, 100%, 125%, 150% ou 200%. A opção `original` com escala de 100% não executa conversão e preserva o arquivo obtido da melhor candidata. Qualquer outra escala usa FFmpeg com filtro Lanczos; aumentar acima de 100% muda as dimensões, mas não recupera detalhes inexistentes. JPG, WEBP e AVIF também expõem controle de qualidade. As mesmas opções são aplicadas ao download individual e ao lote.

Os seletores de formato e escala são componentes próprios da interface, não controles nativos do sistema operacional. Assim, o menu aberto respeita cores claras/escuras e a cor primária selecionada. Cada seletor ocupa uma linha completa para não truncar traduções como “Original (sem conversão)”.

Validação real do post de regressão com oito imagens:

```powershell
$env:DOWNKINGO_INSTAGRAM_INTEGRATION = "1"
$env:DOWNKINGO_YTDLP = "$env:APPDATA\DownKingo-dev\bin\yt-dlp.exe"
go test ./internal/youtube -run TestInstagramImageCarouselIntegration -v
```

## Testes automatizados

Testes normais, sem rede:

```powershell
go test ./...
npm --prefix frontend run test -- --run
npm --prefix frontend run build
```

Validação real do pacote aria2c fixado:

```powershell
$env:DOWNKINGO_ARIA2_INTEGRATION = "1"
go test ./internal/launcher -run TestDownloadPinnedAria2Integration -v
```

Validação completa usando os binários do ambiente dev:

```powershell
$env:DOWNKINGO_ARIA2_INTEGRATION = "1"
$env:DOWNKINGO_ARIA2 = "$env:APPDATA\DownKingo-dev\bin\aria2c.exe"
$env:DOWNKINGO_YTDLP = "$env:APPDATA\DownKingo-dev\bin\yt-dlp.exe"
$env:DOWNKINGO_FFMPEG = "$env:APPDATA\DownKingo-dev\bin\ffmpeg.exe"
go test ./internal/youtube -run TestVerifiedAria2DownloadIntegration -v
```

Validação real de cortes e legendas ASS com FFmpeg:

```powershell
$env:DOWNKINGO_FFMPEG = "$env:APPDATA\DownKingo-dev\bin\ffmpeg.exe"
go test ./internal/youtube -run TestRenderTimelineCutsIntegration -v
```

Validação real do Whisper, modelo e JSON:

```powershell
$env:DOWNKINGO_WHISPER_INTEGRATION = "1"
$env:DOWNKINGO_FFMPEG = "$env:APPDATA\DownKingo-dev\bin\ffmpeg.exe"
go test ./internal/whisper -run TestDownloadPinnedRuntimeIntegration -v
```

Os testes de integração usam diretórios temporários e não alteram as instalações dev ou produção do usuário.

## Acompanhamento no GitHub

As alterações desta versão estão divididas nas seguintes issues, todas abertas, atribuídas a `Capman002` e marcadas como `em desenvolvimento`:

- [#35 — Whisper.cpp 1.9.1 e runtime com integridade](https://github.com/down-kingo/downkingo/issues/35);
- [#36 — JSON oficial, detecção única e VAD](https://github.com/down-kingo/downkingo/issues/36);
- [#37 — aria2c 1.37.0 e isolamento dev/produção](https://github.com/down-kingo/downkingo/issues/37);
- [#38 — desempenho yt-dlp/aria2c e telemetria](https://github.com/down-kingo/downkingo/issues/38);
- [#39 — carrosséis Instagram e resolução original](https://github.com/down-kingo/downkingo/issues/39);
- [#40 — lote, conversão, qualidade e escala de imagens](https://github.com/down-kingo/downkingo/issues/40);
- [#41 — experiência unificada de Downloads](https://github.com/down-kingo/downkingo/issues/41);
- [#42 — UX da galeria, configuração rápida e herança de tema](https://github.com/down-kingo/downkingo/issues/42);
- [#43 — traduções dos novos fluxos](https://github.com/down-kingo/downkingo/issues/43);
- [#44 — testes e documentação da arquitetura](https://github.com/down-kingo/downkingo/issues/44).

O GitHub Project v2 do Roadmap é o projeto nº 2 da organização `down-kingo`. A credencial disponível no Git Credential Manager durante esta atualização possuía os escopos `repo`, `workflow` e `gist`, mas não `read:project`/`project`; por isso a API permitiu criar e classificar as issues, mas bloqueou adicioná-las ao Project e alterar o campo `Status`. A etiqueta `em desenvolvimento` registra o estado enquanto os itens aguardam inclusão no Project.

## Checklist para futuras atualizações

Ao atualizar um runtime:

1. fixar uma versão explícita;
2. trocar URLs `latest` por URLs versionadas;
3. registrar SHA-256 do pacote e dos executáveis relevantes;
4. baixar e extrair em staging;
5. validar versão e capacidade de execução;
6. ativar por operação atômica e preservar rollback durante a troca;
7. testar com o binário real em diretório temporário;
8. regenerar bindings Wails quando contratos Go mudarem;
9. executar testes Go, frontend, build e lint;
10. atualizar este documento.
