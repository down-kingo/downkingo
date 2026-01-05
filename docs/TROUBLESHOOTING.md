# Troubleshooting

Guia para resolver problemas comuns do DownKingo.

## Índice

- [Problemas de Instalação](#problemas-de-instalação)
- [Problemas de Download](#problemas-de-download)
- [Problemas de Performance](#problemas-de-performance)
- [Logs e Diagnóstico](#logs-e-diagnóstico)

---

## Problemas de Instalação

### Windows: SmartScreen bloqueia o instalador

**Causa:** O instalador não é assinado digitalmente.

**Solução:**

1. Clique em "Mais informações"
2. Clique em "Executar assim mesmo"

### Windows: "VCRUNTIME140.dll não encontrado"

**Causa:** Visual C++ Redistributable não instalado.

**Solução:**
Baixe e instale o [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).

### macOS: "O app não pode ser aberto pois é de desenvolvedor não identificado"

**Causa:** App não é notarizado pela Apple.

**Solução:**

```bash
# No Terminal:
xattr -cr /Applications/DownKingo.app
```

Ou: Clique direito → Abrir → Confirmar.

### Linux: AppImage não executa

**Causa 1:** Sem permissão de execução.

```bash
chmod +x DownKingo-linux-amd64.AppImage
```

**Causa 2:** FUSE não instalado.

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

**Causa:** Proteção anti-bot do site ou sessão expirada.

**Soluções:**

1. Atualize o DownKingo para a última versão
2. Aguarde alguns minutos e tente novamente
3. Verifique se o vídeo não é privado

### Erro "Unable to extract video data"

**Causa:** Formato do site mudou ou yt-dlp desatualizado.

**Solução:** Aguarde uma atualização do DownKingo que inclua nova versão do yt-dlp.

### Download lento

**Causas possíveis:**

1. Limitação do servidor de origem
2. Conexão de internet lenta
3. VPN ativa

**Soluções:**

1. Tente em horários de menor tráfego
2. Desative VPN temporariamente
3. Verifique sua conexão de internet

### Vídeo baixado sem áudio

**Causa:** Alguns sites separam vídeo e áudio em streams diferentes.

**Solução:** O DownKingo usa FFmpeg para mesclar automaticamente. Se falhar:

1. Verifique os logs
2. Tente baixar como "Apenas Áudio" separadamente

---

## Problemas de Performance

### App lento para iniciar

**Causa:** Verificação de atualizações ou dependências.

**Soluções:**

1. Aguarde a primeira inicialização completar
2. Verifique se antivírus não está escaneando o app

### Alto uso de memória

**Causa:** Múltiplos downloads simultâneos.

**Solução:** Limite o número de downloads paralelos.

### App congela durante download

**Causa:** Possível deadlock ou processo yt-dlp travado.

**Solução:**

1. Feche e reabra o app
2. Verifique se há processos `yt-dlp` órfãos no gerenciador de tarefas
3. Reporte o bug com logs

---

## Logs e Diagnóstico

### Localização dos Logs

| Sistema | Caminho                                                      |
| ------- | ------------------------------------------------------------ |
| Windows | `%AppData%\DownKingo\logs\DownKingo.log`                     |
| macOS   | `~/Library/Application Support/DownKingo/logs/DownKingo.log` |
| Linux   | `~/.config/DownKingo/logs/DownKingo.log`                     |

### Como ler os logs

Os logs são em formato JSON estruturado:

```json
{"level":"info","time":"2024-12-28T10:00:00Z","message":"download started","url":"..."}
{"level":"error","time":"2024-12-28T10:00:05Z","error":"network timeout","message":"download failed"}
```

### Reportando Problemas

Ao abrir uma issue, inclua:

1. **Versão do DownKingo**
2. **Sistema operacional e versão**
3. **Passos para reproduzir**
4. **Logs relevantes** (remova informações sensíveis)
5. **Screenshots** (se aplicável)

---

## Ainda com problemas?

- 📖 Consulte o [FAQ](FAQ.md)
- 🐛 Abra uma [Issue](https://github.com/Capman002/DownKingo/issues)
- 💬 Pergunte nas [Discussões](https://github.com/Capman002/DownKingo/discussions)
