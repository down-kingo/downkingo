# FAQ - Perguntas Frequentes

## Geral

### O que é o DownKingo?

DownKingo é um downloader de mídia desktop que permite baixar vídeos e áudios do YouTube e centenas de outras plataformas. Funciona em Windows, macOS e Linux.

### É gratuito?

Sim, 100% gratuito e open source sob licença MIT.

### É seguro?

Sim. O código é aberto e pode ser auditado. Não coletamos dados, não há telemetria, e os binários são baixados de fontes oficiais (GitHub).

---

## Instalação

### Preciso instalar FFmpeg ou yt-dlp?

**Não.** O DownKingo já vem com esses binários empacotados. É só instalar e usar.

### O Windows SmartScreen bloqueia o instalador

Isso acontece porque o instalador não é assinado digitalmente (custa ~$300/ano). Para prosseguir:

1. Clique em "Mais informações"
2. Clique em "Executar assim mesmo"

### O macOS diz que o app é de desenvolvedor não identificado

O app não é notarizado pela Apple. Para abrir:

1. Clique com botão direito no app
2. Selecione "Abrir"
3. Confirme na janela que aparecer

### No Linux o AppImage não abre

Verifique se tem permissão de execução:

```bash
chmod +x DownKingo-linux-amd64.AppImage
./DownKingo-linux-amd64.AppImage
```

Se ainda não funcionar, instale o FUSE:

```bash
sudo apt install libfuse2  # Ubuntu/Debian
```

---

## Uso

### Quais sites são suportados?

Todos os sites suportados pelo [yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), incluindo:

- YouTube
- Vimeo
- Twitter/X
- TikTok
- Instagram
- Facebook
- E centenas de outros...

### Onde os arquivos são salvos?

Por padrão:

- **Windows**: `C:\Users\SeuUsuario\Videos\DownKingo\`
- **macOS**: `~/Movies/DownKingo/`
- **Linux**: `~/Videos/DownKingo/`

### Posso baixar playlists?

Ainda não. Está no roadmap para uma versão futura.

### Posso escolher a qualidade do vídeo?

Atualmente baixa a melhor qualidade disponível. Seletor de qualidade está no roadmap.

---

## Problemas

### O download falha com erro 403

Alguns vídeos têm proteção anti-bot. Tente:

1. Atualizar o DownKingo para a versão mais recente
2. Aguardar alguns minutos e tentar novamente
3. Verificar se o vídeo não é privado ou restrito por região

### O app trava ou não responde

1. Verifique os logs em:
   - Windows: `%AppData%\DownKingo\logs\`
   - macOS: `~/Library/Application Support/DownKingo/logs/`
   - Linux: `~/.config/DownKingo/logs/`
2. Abra uma issue com o conteúdo do log

### Como reportar um bug?

Abra uma [Issue no GitHub](https://github.com/Capman002/DownKingo/issues) com:

- Descrição do problema
- Passos para reproduzir
- Sistema operacional
- Logs (se disponível)
