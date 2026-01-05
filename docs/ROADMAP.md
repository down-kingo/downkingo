# DownKingo - Roadmap de Features

> Consolidação das funcionalidades dos principais downloaders do mercado:
> Video Downloader, Stacher7, Parabolic, Cobalt, Media-Downloader

---

## 📊 Status Atual do DownKingo

✅ **Implementado:**

- Download de vídeo do YouTube
- Seleção de qualidade/resolução
- Instalação automática de yt-dlp e FFmpeg
- Interface premium com tema Clinical Neon
- Cross-platform (Windows, macOS, Linux)

---

## 🎯 Fase 1: Fundamentos (Prioridade Alta)

### 1.1 Download de Áudio

- [ ] Extrair apenas áudio de vídeos
- [ ] Formatos: MP3, OPUS, FLAC, WAV, AAC, M4A
- [ ] Controle de bitrate (128k, 192k, 256k, 320k)
- [ ] Usar thumbnail como capa do álbum

### 1.2 Suporte a Playlists

- [ ] Detectar e listar vídeos de uma playlist
- [ ] Seleção individual de vídeos para download
- [ ] Download de playlist completa
- [ ] Barra de progresso por playlist

### 1.3 Suporte a Múltiplas Plataformas

- [ ] Instagram (posts, reels, stories)
- [ ] TikTok
- [ ] Twitter/X
- [ ] Facebook
- [ ] Vimeo
- [ ] Twitch (VODs e clips)
- [ ] SoundCloud
- [ ] Bandcamp
- [ ] Reddit
- [ ] 1000+ sites suportados pelo yt-dlp

### 1.4 Fila de Downloads

- [ ] Adicionar múltiplas URLs à fila
- [ ] Gerenciar ordem da fila
- [ ] Pausar/retomar downloads individuais
- [ ] Downloads simultâneos (configurável: 1-5)

---

## 🎯 Fase 2: Experiência do Usuário (Prioridade Alta)

### 2.1 Clipboard Listener

- [ ] Detectar automaticamente URLs copiadas
- [ ] Popup para confirmar download
- [ ] Opção de download automático (configurável)
- [ ] Suporte a múltiplas URLs coladas de uma vez

### 2.2 Histórico de Downloads

- [ ] Lista de downloads concluídos
- [ ] Metadados (título, duração, tamanho, data)
- [ ] Abrir pasta do arquivo
- [ ] Reproduzir com player padrão
- [ ] Redownload rápido

### 2.3 Preview de Vídeo

- [ ] Thumbnail grande antes do download
- [ ] Informações detalhadas (duração, views, canal)
- [ ] Preview dos formatos disponíveis
- [ ] Estimativa de tamanho do arquivo

### 2.4 Notificações

- [ ] Notificação na conclusão do download
- [ ] Notificação de erro
- [ ] Badge no ícone da bandeja (Windows/macOS)
- [ ] Som de conclusão (opcional)

---

## 🎯 Fase 3: Features Avançadas (Prioridade Média)

### 3.1 Conversão de Formatos

- [ ] Converter vídeo para MP4, MKV, AVI, WebM
- [ ] Converter áudio para MP3, FLAC, AAC, WAV
- [ ] Re-encode com parâmetros customizados
- [ ] Remux sem re-encode (rápido)

### 3.2 Edição de Metadados

- [ ] Editar título, artista, álbum
- [ ] Adicionar/trocar thumbnail
- [ ] Download automático de legendas
- [ ] Embed de legendas no vídeo

### 3.3 Video Trimming

- [ ] Definir ponto inicial e final (timeframe)
- [ ] Preview visual do trim
- [ ] Download apenas do trecho selecionado
- [ ] Split por capítulos

### 3.4 Limites e Controle

- [ ] Limite de velocidade de download
- [ ] Agendamento de downloads
- [ ] Modo silencioso (bandeja do sistema)
- [ ] Auto-shutdown após downloads

---

## 🎯 Fase 4: Produtividade (Prioridade Média)

### 4.1 Assinaturas/Subscriptions

- [ ] Monitorar canais/playlists
- [ ] Download automático de novos vídeos
- [ ] Intervalo configurável (horário, diário)
- [ ] Filtros por título/duração

### 4.2 Perfis de Configuração

- [ ] Múltiplos perfis de download
- [ ] Quick-switch entre perfis
- [ ] Perfis por tipo de conteúdo (música, vídeo, podcast)

### 4.3 Templates de Nomenclatura

- [ ] Padrão customizável para nomes de arquivo
- [ ] Variáveis: {title}, {channel}, {date}, {quality}
- [ ] Organização automática em pastas

### 4.4 Batch Download

- [ ] Importar lista de URLs (txt, csv)
- [ ] Exportar fila atual
- [ ] Processar arquivo de URLs automaticamente

---

## 🎯 Fase 5: Integração (Prioridade Baixa)

### 5.1 Integração com Navegadores

- [ ] Extensão para Chrome
- [ ] Extensão para Firefox
- [ ] Botão "Download com DownKingo" nas páginas
- [ ] Enviar URL diretamente do browser

### 5.2 Streaming/Preview

- [ ] Enviar para VLC/player externo
- [ ] Player embutido no app
- [ ] Preview antes de baixar

### 5.3 Proxy e Autenticação

- [ ] Suporte a proxy HTTP/SOCKS5
- [ ] Cookies de navegador para sites privados
- [ ] Login/senha para conteúdo protegido
- [ ] Suporte a 2FA via cookies

### 5.4 Backends Alternativos

- [ ] gallery-dl (imagens)
- [ ] aria2c (downloads paralelos)
- [ ] Plugin system para novos backends

---

## 🎯 Fase 6: Polish (Prioridade Baixa)

### 6.1 Temas e Customização

- [ ] Tema escuro (Dark Mode)
- [ ] Cores customizáveis
- [ ] Densidade da interface (compact/normal)

### 6.2 Internacionalização

- [ ] Português (Brasil) ✅
- [ ] Inglês
- [ ] Espanhol
- [ ] Outros idiomas via contribuição

### 6.3 Acessibilidade

- [ ] Suporte a leitores de tela
- [ ] Navegação por teclado
- [ ] Alto contraste

### 6.4 Performance

- [ ] Downloads paralelos com aria2c
- [ ] Cache de metadados
- [ ] Menor uso de memória

---

## 📈 Priorização por Impacto

| Feature               | Impacto | Esforço | Prioridade |
| --------------------- | ------- | ------- | ---------- |
| Download de Áudio     | Alto    | Baixo   | 🔴 Crítico |
| Suporte a Playlists   | Alto    | Médio   | 🔴 Crítico |
| Clipboard Listener    | Alto    | Baixo   | 🔴 Crítico |
| Múltiplas Plataformas | Alto    | Baixo   | 🔴 Crítico |
| Fila de Downloads     | Alto    | Médio   | 🟡 Alto    |
| Histórico             | Médio   | Baixo   | 🟡 Alto    |
| Notificações          | Médio   | Baixo   | 🟡 Alto    |
| Conversão             | Médio   | Alto    | 🟢 Médio   |
| Subscriptions         | Médio   | Alto    | 🟢 Médio   |
| Video Trimming        | Baixo   | Alto    | 🔵 Baixo   |
| Extensões Browser     | Baixo   | Alto    | 🔵 Baixo   |

---

## 🏁 MVP Recomendado (v1.5)

Para se equiparar aos concorrentes, o MVP deve incluir:

1. ✅ Download de vídeo com seleção de qualidade
2. ⏳ Download apenas áudio (MP3)
3. ⏳ Suporte a playlists do YouTube
4. ⏳ Clipboard listener
5. ⏳ Suporte a Instagram/TikTok/Twitter
6. ⏳ Fila de downloads
7. ⏳ Histórico básico

---

_Documento gerado em 28/12/2024_
