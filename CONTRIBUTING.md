# Contribuindo para o DownKingo

Obrigado por considerar contribuir para o DownKingo! 🎉

## Como Contribuir

### Reportando Bugs

1. Verifique se o bug já não foi reportado em [Issues](https://github.com/Capman002/DownKingo/issues)
2. Se não encontrar, abra uma nova issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicável)
   - Sistema operacional e versão

### Sugerindo Features

Abra uma issue com a tag `enhancement` descrevendo:

- O problema que a feature resolve
- Como você imagina a solução
- Alternativas consideradas

### Pull Requests

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça suas alterações
4. Rode os testes localmente
5. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
6. Push para a branch (`git push origin feature/nova-feature`)
7. Abra um Pull Request

## Setup de Desenvolvimento

```bash
# Clone
git clone https://github.com/Capman002/DownKingo.git
cd DownKingo

# Dependências do Frontend
cd frontend && bun install && cd ..

# Modo desenvolvimento
wails dev
```

## Convenções de Código

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova feature
- `fix:` correção de bug
- `docs:` documentação
- `style:` formatação
- `refactor:` refatoração
- `test:` testes
- `chore:` manutenção

### Go

- Use `gofmt` para formatação
- Siga as convenções do [Effective Go](https://go.dev/doc/effective_go)

### TypeScript/React

- Use TypeScript strict mode
- Componentes funcionais com hooks
- Tailwind CSS para estilização

## Estrutura do Projeto

```
DownKingo/
├── app.go              # Entry point e métodos expostos
├── main.go             # Configuração do Wails
├── internal/           # Lógica de negócio
│   ├── launcher/       # Download de dependências
│   ├── youtube/        # Wrapper do yt-dlp
│   └── logger/         # Logging estruturado
└── frontend/           # React + TypeScript
    ├── src/pages/      # Páginas
    ├── src/components/ # Componentes
    └── src/stores/     # Estado (Zustand)
```

## Dúvidas?

Abra uma [Discussion](https://github.com/Capman002/DownKingo/discussions) ou entre em contato via Issues.
