# Troubleshooting

Guia para resolver problemas comuns do DownKingo.

## Indice

- [Problemas de Instalacao](#problemas-de-instalacao)
- [Problemas de Download](#problemas-de-download)
- [Problemas de Transcricao](#problemas-de-transcricao)
- [Problemas de Performance](#problemas-de-performance)
- [Logs e Diagnostico](#logs-e-diagnostico)

---

## Problemas de Instalacao

### Windows: SmartScreen bloqueia o instalador

**Causa:** O instalador nao e assinado digitalmente.

**Solucao:**

1. Clique em "Mais informacoes"
2. Clique em "Executar assim mesmo"

### Windows: "VCRUNTIME140.dll nao encontrado"

**Causa:** Visual C++ Redistributable nao instalado.

**Solucao:**
Baixe e instale o [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).

### macOS: "O app nao pode ser aberto pois e de desenvolvedor nao identificado"

**Causa:** App nao e notarizado pela Apple.

**Solucao:**

```bash
# No Terminal:
xattr -cr /Applications/DownKingo.app
```

Ou: Clique direito -> Abrir -> Confirmar.

### Linux: AppImage nao executa

**Causa 1:** Sem permissao de execucao.

```bash
chmod +x DownKingo-linux-amd64.AppImage
```

**Causa 2:** FUSE nao instalado.

```bash
# Ubuntu/Debian
sudo apt install libfuse2

# Fedora
sudo dnf install fuse

# Arch
sudo pacman -S fuse2
```

---

## Problemas de Download

### Erro 403 Forbidden

**Causa:** Protecao anti-bot do site ou sessao expirada.

**Solucoes:**

1. Atualize o DownKingo para a ultima versao
2. Aguarde alguns minutos e tente novamente
3. Verifique se o video nao e privado

### Erro "Unable to extract video data"

**Causa:** Formato do site mudou ou yt-dlp desatualizado.

**Solucao:** Aguarde uma atualizacao do DownKingo que inclua nova versao do yt-dlp, ou atualize o yt-dlp manualmente pelo app (Configuracoes -> Atualizar yt-dlp).

### Download lento

**Causas possiveis:**

1. Limitacao do servidor de origem
2. Conexao de internet lenta
3. VPN ativa

**Solucoes:**

1. Tente em horarios de menor trafego
2. Desative VPN temporariamente
3. Verifique sua conexao de internet
4. Ative o aria2c nas configuracoes para downloads segmentados

### Video baixado sem audio

**Causa:** Alguns sites separam video e audio em streams diferentes.

**Solucao:** O DownKingo usa FFmpeg para mesclar automaticamente. Se falhar:

1. Verifique os logs
2. Tente baixar como "Apenas Audio" separadamente

---

## Problemas de Transcricao

### Whisper nao esta instalado

**Causa:** O binario do Whisper precisa ser baixado separadamente.

**Solucao:** Na pagina do Transcritor, clique em "Instalar Whisper" para baixar o binario automaticamente.

### Transcricao muito lenta

**Causa:** O modelo Whisper selecionado e muito grande para o seu hardware.

**Solucao:** Use um modelo menor (tiny ou base) para transcricoes mais rapidas, com tradeoff de precisao.

### Modelo nao encontrado

**Causa:** O modelo Whisper nao foi baixado ainda.

**Solucao:** Na pagina do Transcritor, baixe o modelo desejado antes de iniciar a transcricao.

---

## Problemas de Performance

### App lento para iniciar

**Causa:** Verificacao de atualizacoes ou dependencias.

**Solucoes:**

1. Aguarde a primeira inicializacao completar
2. Verifique se antivirus nao esta escaneando o app

### Alto uso de memoria

**Causa:** Multiplos downloads simultaneos ou transcricao com modelo grande.

**Solucao:** Limite o numero de downloads paralelos ou use modelos Whisper menores.

### App congela durante download

**Causa:** Possivel deadlock ou processo yt-dlp travado.

**Solucao:**

1. Feche e reabra o app
2. Verifique se ha processos `yt-dlp` orfaos no gerenciador de tarefas
3. Reporte o bug com logs

---

## Logs e Diagnostico

### Localizacao dos Logs

| Sistema | Caminho                                                      |
| ------- | ------------------------------------------------------------ |
| Windows | `%AppData%\DownKingo\logs\DownKingo.log`                     |
| macOS   | `~/Library/Application Support/DownKingo/logs/DownKingo.log` |
| Linux   | `~/.config/DownKingo/logs/DownKingo.log`                     |

### Como ler os logs

Os logs sao em formato JSON estruturado (zerolog):

```json
{"level":"info","time":"2025-01-15T10:00:00Z","version":"3.0.0","message":"kingo starting up"}
{"level":"error","time":"2025-01-15T10:00:05Z","error":"network timeout","message":"download failed"}
```

### Debug mode

Para ativar logs detalhados em producao, defina a variavel de ambiente:

```bash
KINGO_DEBUG=true
```

### Reportando Problemas

Ao abrir uma issue, inclua:

1. **Versao do DownKingo** (visivel em Configuracoes ou via `GetVersion()`)
2. **Sistema operacional e versao**
3. **Passos para reproduzir**
4. **Logs relevantes** (remova informacoes sensiveis)
5. **Screenshots** (se aplicavel)

---

## Ainda com problemas?

- Consulte o [FAQ](FAQ.md)
- Abra uma [Issue](https://github.com/down-kingo/downkingo/issues)
- Pergunte nas [Discussoes](https://github.com/down-kingo/downkingo/discussions)
