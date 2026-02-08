# ADR-004: Zustand para gerenciamento de estado

## Status
Aceito

## Contexto
O frontend React precisa de estado global para downloads (fila, progresso, historico), configuracoes e roadmap. Opcoes:
- Redux Toolkit
- Zustand
- Jotai
- React Context

## Decisao
Escolhemos **Zustand** porque:

1. **Minimalista**: ~1KB, sem boilerplate (actions, reducers, dispatch)
2. **Sem Provider**: nao precisa de wrapper no root, acesso direto via hook
3. **TypeScript nativo**: tipagem inferida, sem action types
4. **Persist middleware**: localStorage built-in para settingsStore
5. **Seletores granulares**: re-render seletivo sem memo manual

## Consequencias
- Stores sao funcoes simples, faceis de testar
- Sem devtools sofisticadas como Redux (aceitavel para app desktop)
- Padrão: um store por dominio (`downloadStore`, `settingsStore`, `roadmapStore`)
- Logica complexa fica nos hooks (`useDownloadActions`), stores sao apenas estado
