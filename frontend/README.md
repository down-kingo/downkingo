# Frontend Architecture

O frontend do DownKingo é construído com **React**, **TypeScript** e **Vite**, projetado para ser servido pelo Wails como interface nativa.

## Tech Stack

- **Framework**: React 18+
- **Build Tool**: Vite (Rápido HMR e Build otimizado)
- **Styling**: Tailwind CSS (Utilitários) + CSS Modules (quando necessário)
- **Icons**: Lucide React
- **Motion**: Framer Motion (Transições e animações de UI)
- **I18n**: react-i18next (Internacionalização PT-BR/EN-US)

## Estrutura do Projeto

```
src/
├── components/     # Componentes de UI reutilizáveis e Views
│   ├── converter/  # Lógica de conversão
│   ├── roadmap/    # Cards e lista do roadmap
│   └── ...
├── hooks/          # Custom Hooks (Lógica separada da View)
│   ├── useDownloadListeners.ts # Escuta eventos do backend
│   └── useKeyboardShortcuts.ts # Gerencia atalhos globais
├── wailsjs/        # [AUTO-GENERATED] Bindings Go -> JS
└── App.tsx         # Root layout e roteamento básico
```

## Integração com Wails

A comunicação com o backend (Go) acontece de duas formas:

### 1. Chamadas de Método (Frontend -> Backend)

Utilizamos os bindings gerados automaticamente em `wailsjs/go/main/App`.
Exemplo:

```ts
import { GetSettings } from "../../wailsjs/go/main/App";
const settings = await GetSettings();
```

### 2. Eventos (Backend -> Frontend)

O backend emite eventos para atualizações em tempo real (progresso, logs, clipboard).
Hooks como `useDownloadListeners` abstraem a subscrição (`EventsOn`) e limpeza (`EventsOff`).

## Desenvolvimento

Para rodar o frontend isolado (no navegador, com mock do Wails):

```bash
npm run dev
```

> **Nota**: Funcionalidades que dependem do `window.runtime` do Wails não funcionarão no navegador padrão, a menos que mockadas.

## Builds

O build de produção é gerenciado pelo comando `wails build`, que internamente roda `npm run build` e embuti os assets `dist/` no binário Go.
