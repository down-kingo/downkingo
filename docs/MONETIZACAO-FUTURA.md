# Monetizacao futura: recomendacoes e afiliados

> Estado: especificacao aprovada para implementacao futura. Nada descrito neste
> documento deve ser ativado antes do fornecimento e da validacao dos links,
> imagens, videos e identificadores de afiliado.

> Excecao ja implementada em 13/07/2026: lembretes de doacao discretos no
> Transcritor e nas laterais do resultado de video. Eles nao usam afiliados nem
> conteudo remoto e respeitam a preferencia `showDonationBanners` existente.

## Objetivo

Criar uma fonte adicional de receita para o DownKingo, que continuara gratuito
e de codigo aberto, por meio de recomendacoes uteis e claramente identificadas.
O sistema nao deve parecer adware, interferir nas acoes principais nem coletar
o conteudo processado pelo usuario.

## Nomenclatura na interface

- Usar **Recomendacoes do app** como titulo da secao de produtos.
- Identificar links comerciais como **Link de afiliado** ou **Patrocinado**.
- Evitar usar apenas o titulo generico **Anuncios** na interface principal.
- Informar que o DownKingo pode receber comissao sem custo adicional para o
  usuario.

## Superficies planejadas

### Conversor: recomendacoes do Mercado Livre

Na barra lateral de resumo do Conversor, inserir a secao **Recomendacoes do
app** no espaco livre abaixo do botao **Iniciar**, conforme a referencia visual
fornecida em 13/07/2026.

Categorias iniciais:

- SSD;
- memoria RAM;
- fone de ouvido;
- headset.

Cada categoria abre um modal proprio. O modal sera apenas o ponto de entrada
para a oferta: textos, produtos, links, imagens e videos serao definidos
posteriormente. Ate esses dados serem fornecidos, nao devem existir URLs de
exemplo, redirecionamentos ou conteudo promocional ativo no aplicativo.

Requisitos de layout:

- manter o seletor de destino e o botao **Iniciar** como elementos prioritarios;
- a area deve acompanhar a rolagem da barra lateral em janelas baixas;
- o modal deve seguir tema, cor primaria, foco por teclado, tecla `Esc` e
  restauracao de foco do restante do app;
- o clique final deve abrir o navegador externo, nunca navegar o WebView;
- nao mostrar recomendacao junto a erro, progresso ou conclusao de conversao.

### Conversor: banner Proton

Adicionar um banner grande da Proton abaixo da area operacional do Conversor.
Ele e independente das recomendacoes do Mercado Livre e deve estar disponivel
em todos os idiomas suportados.

O banner deve:

- seguir o sistema visual do DownKingo e possuir variacoes clara/escura;
- ser identificado como patrocinado ou link de afiliado;
- abrir o link no navegador externo;
- usar imagem, video e URL oficiais que ainda serao fornecidos;
- ter fallback estatico e nao impedir o uso do Conversor se o recurso remoto
  falhar.

### Transcritor: apoio ao projeto

- Nao colocar recomendacoes nem banner da Proton na barra lateral do
  Transcritor.
- Manter, na parte inferior da area principal, um banner de doacao inspirado no
  banner da Home, reutilizando o componente e a linguagem visual existentes em
  vez de criar uma segunda implementacao divergente.
- O banner deve respeitar a mesma preferencia global que controla a exibicao de
  conteudo promocional.

### Downloader: lembretes laterais de doacao

Quando um link de video for carregado com sucesso, exibir dois lembretes de
doacao, um em cada lateral do card de opcoes. Eles devem usar fundo quase
transparente, laminacao suave e hierarquia visual secundaria. No layout com
sidebar, usar largura e espacamento menores. Cada banner ocupa 90% da altura
lateral disponivel e permanece fixo nessa area; somente o conteudo central
rola. Quando nao houver largura segura, ocultar os dois lembretes em vez de
comprimir o formulario.

Esses lembretes nao devem aparecer no estado vazio, durante a consulta do link
ou em mensagens de erro. O hover nao deve abrir automaticamente o video de
doacao usado pelo banner principal da Home.

## Idiomas e disponibilidade regional

### Mercado Livre

O catalogo e destinado inicialmente ao Mercado Livre Brasil.

- Preparar os textos editoriais em `pt-BR` e `en-US`.
- Adicionar as chaves necessarias aos demais idiomas suportados para preservar
  a integridade do i18n; enquanto nao houver traducao aprovada, usar o ingles
  como fallback.
- A exibicao fora de `pt-BR` permanece uma decisao pendente, pois os links levam
  ao marketplace brasileiro. A implementacao deve permitir ativar ou desativar
  a secao por locale sem nova compilacao.

### Proton

- Exibir em todos os idiomas suportados.
- Traduzir titulo, descricao, chamada para acao e aviso de afiliado.
- Conteudo audiovisual localizado sera opcional e dependera dos arquivos que
  forem fornecidos.

## Preferencia global de exibicao

Hoje a preferencia persistida e `showDonationBanners`. Na implementacao futura,
ela deve ser migrada para um conceito abrangente, por exemplo
`showPromotionalContent`, sem reativar conteudo que o usuario ja tenha ocultado.

Um unico controle nas configuracoes deve ocultar ou exibir em conjunto:

- banners de doacao da Home, navegacao e Transcritor;
- banner Proton do Conversor;
- secao e modais de recomendacoes afiliadas.

A copia da configuracao deve deixar claro que ela controla **recomendacoes e
apoio ao projeto**, e nao anuncios personalizados. O valor escolhido deve ser
persistente e aplicado imediatamente em todas as telas abertas.

## Dados e entrega de conteudo

A implementacao deve aceitar configuracao remota para que campanhas e produtos
possam mudar sem uma nova versao do app, seguindo o padrao de CDN e cache ja
usado pelo Roadmap. Somente dados estruturados conhecidos podem ser renderizados;
HTML e JavaScript remotos nao sao permitidos.

Campos previstos por campanha:

- identificador e tipo (`affiliate`, `sponsor` ou `donation`);
- parceiro e categoria;
- locales e regioes habilitados;
- titulo, descricao, chamada para acao e aviso comercial;
- URL HTTPS de destino;
- imagem ou video aprovados;
- inicio, termino, prioridade e estado de ativacao.

Validacoes obrigatorias:

- HTTPS e lista de hosts permitidos;
- limites de tamanho para texto e midia;
- cache local com expiracao e fallback seguro;
- falha silenciosa: sem campanha valida, a interface apenas omite a area;
- nenhuma URL de download, nome de arquivo, transcricao ou historico pode ser
  enviado para selecionar ou medir uma campanha.

## Pendencias antes da implementacao

- [ ] Fornecer links de afiliado do Mercado Livre por categoria.
- [ ] Definir os produtos ou paginas de busca de SSD, RAM, fone e headset.
- [ ] Fornecer textos, imagens e videos dos modais.
- [ ] Fornecer e validar o link de afiliado da Proton.
- [ ] Fornecer os materiais oficiais permitidos pela Proton.
- [ ] Decidir se o Mercado Livre aparecera em `en-US` e nos demais locales ou
      somente em `pt-BR`.
- [ ] Definir a copia final da preferencia global nas configuracoes.
- [ ] Revisar os termos vigentes dos dois programas antes da publicacao.
- [ ] Definir se havera apenas contagem agregada de cliques ou nenhuma
      telemetria promocional.

## Criterios de aceite futuros

- Nenhuma recomendacao aparece quando a preferencia global esta desativada.
- O Conversor continua totalmente funcional sem internet ou campanha valida.
- Mercado Livre e Proton nunca recebem dados sobre os arquivos do usuario.
- Links abrem exclusivamente no navegador padrao do sistema.
- A area comercial e distinguivel dos controles do Conversor.
- Todos os novos textos passam pela verificacao de i18n.
- Modais sao acessiveis por teclado e nao deixam foco preso depois de fechar.
- Testes cobrem preferencia global, locale, ausencia de campanha, URL invalida e
  abertura externa.
