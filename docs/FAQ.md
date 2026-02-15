# FAQ - Perguntas Frequentes

## Geral

### O que e o DownKingo?

DownKingo e um companheiro de midia desktop que permite baixar videos e audios do YouTube e centenas de outras plataformas, converter formatos de midia e transcrever audio/video. Funciona em Windows, macOS e Linux.

### E gratuito?

Sim, 100% gratuito e open source sob licenca MIT.

### E seguro?

Sim. O codigo e aberto e pode ser auditado. Os binarios de terceiros (yt-dlp, FFmpeg) sao baixados de fontes oficiais (GitHub). Veja detalhes em [LICENSES.md](LICENSES.md).

### Quais idiomas sao suportados?

O app suporta 5 idiomas nativamente:

- Ingles (en-US)
- Portugues (pt-BR)
- Espanhol (es-ES)
- Frances (fr-FR)
- Alemao (de-DE)

---

## Instalacao

### Preciso instalar FFmpeg ou yt-dlp?

**Nao.** O DownKingo baixa esses binarios automaticamente na primeira execucao. Basta instalar e usar.

### O Windows SmartScreen bloqueia o instalador

Isso acontece porque o instalador nao e assinado digitalmente. Para prosseguir:

1. Clique em "Mais informacoes"
2. Clique em "Executar assim mesmo"

### O macOS diz que o app e de desenvolvedor nao identificado

O app nao e notarizado pela Apple. Para abrir:

1. Clique com botao direito no app
2. Selecione "Abrir"
3. Confirme na janela que aparecer

### No Linux o AppImage nao abre

Verifique se tem permissao de execucao:

```bash
chmod +x DownKingo-linux-amd64.AppImage
./DownKingo-linux-amd64.AppImage
```

Se ainda nao funcionar, instale o FUSE:

```bash
sudo apt install libfuse2  # Ubuntu/Debian
```

---

## Uso

### Quais sites sao suportados?

Todos os sites suportados pelo [yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), incluindo:

- YouTube
- Vimeo
- Twitter/X
- TikTok
- Instagram
- Facebook
- E centenas de outros...

### Onde os arquivos sao salvos?

Por padrao:

- **Windows**: `C:\Users\SeuUsuario\Videos\DownKingo\`
- **macOS**: `~/Movies/DownKingo/`
- **Linux**: `~/Videos/DownKingo/`

Voce pode alterar o diretorio de downloads nas Configuracoes do app.

### Posso baixar playlists?

Ainda nao. Esta no roadmap para uma versao futura.

### Posso escolher a qualidade do video?

Sim! Voce pode selecionar a qualidade desejada antes de iniciar o download.

### O que e o Transcritor?

O Transcritor permite converter audio/video em texto usando o Whisper, um modelo de IA que roda localmente no seu computador (offline). Suporta multiplos idiomas e gera timestamps.

### Preciso de internet para transcrever?

Apenas para baixar o modelo Whisper na primeira vez. Apos o download, a transcricao funciona completamente offline.

---

## Problemas

### O download falha com erro 403

Alguns videos tem protecao anti-bot. Tente:

1. Atualizar o DownKingo para a versao mais recente
2. Aguardar alguns minutos e tentar novamente
3. Verificar se o video nao e privado ou restrito por regiao

### O app trava ou nao responde

1. Verifique os logs em:
   - Windows: `%AppData%\DownKingo\logs\`
   - macOS: `~/Library/Application Support/DownKingo/logs/`
   - Linux: `~/.config/DownKingo/logs/`
2. Abra uma issue com o conteudo do log

### Como reportar um bug?

Abra uma [Issue no GitHub](https://github.com/down-kingo/downkingo/issues) com:

- Descricao do problema
- Passos para reproduzir
- Sistema operacional
- Logs (se disponivel)

Ou use os templates de issue disponiveis no repositorio.
