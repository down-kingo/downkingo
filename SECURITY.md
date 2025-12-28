# Política de Segurança

## Versões Suportadas

| Versão | Suportada |
| ------ | --------- |
| 1.x.x  | ✅ Sim    |
| < 1.0  | ❌ Não    |

## Reportando Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, por favor **NÃO** abra uma issue pública.

### Como Reportar

1. Envie um email para: **emanuelsoares02@gmail.com**
2. Ou use o [GitHub Security Advisories](https://github.com/Capman002/kinematic/security/advisories/new)

### O que incluir no reporte

- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestões de correção (se houver)

### Tempo de Resposta

- **Confirmação inicial:** 48 horas
- **Avaliação:** 7 dias
- **Correção:** Depende da severidade (crítico: 24-72h, alto: 1 semana, médio/baixo: próxima release)

### Escopo

Este projeto utiliza as seguintes dependências externas que têm suas próprias políticas de segurança:

- **yt-dlp**: [Reportar aqui](https://github.com/yt-dlp/yt-dlp/security)
- **FFmpeg**: [Reportar aqui](https://ffmpeg.org/security.html)

Vulnerabilidades nessas ferramentas devem ser reportadas diretamente aos mantenedores.

## Boas Práticas

O Kinematic segue estas práticas de segurança:

- ✅ Verificação de checksums em downloads
- ✅ Context propagation para evitar processos órfãos
- ✅ Sem execução de código remoto arbitrário
- ✅ Binários empacotados de fontes oficiais
