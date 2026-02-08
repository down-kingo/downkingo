# ADR-002: modernc/sqlite (pure Go) em vez de mattn/go-sqlite3

## Status
Aceito

## Contexto
O app precisa de persistencia local para fila de downloads, historico e cache. SQLite e a escolha natural para desktop. Duas opcoes:
- `mattn/go-sqlite3`: wrapper CGO, mais maduro
- `modernc.org/sqlite`: pure Go, sem CGO

## Decisao
Escolhemos **modernc/sqlite** porque:

1. **Sem CGO**: simplifica cross-compilation (Windows, macOS, Linux) drasticamente
2. **Sem dependencia de toolchain C**: nao precisa de gcc/mingw instalado para build
3. **CI mais simples**: nao precisa configurar ambiente C em GitHub Actions
4. **Desempenho adequado**: para volumes de um app desktop (centenas de registros, nao milhoes), a diferenca de performance e negligivel

## Consequencias
- Build mais lento (transpilacao C -> Go), mas so afeta o primeiro build
- Binario final ~2MB maior
- API `database/sql` padrao, migracao para mattn e trivial se necessario
- WAL mode e pragmas funcionam normalmente
