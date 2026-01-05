# Releases

Este documento descreve o processo de release do DownKingo.

## Versionamento

Seguimos o [Semantic Versioning](https://semver.org/lang/pt-BR/):

- **MAJOR** (1.x.x): Mudanças incompatíveis com versões anteriores
- **MINOR** (x.1.x): Novas features mantendo compatibilidade
- **PATCH** (x.x.1): Correções de bugs

## Como Criar uma Release

### 1. Preparação

```bash
# Atualize o CHANGELOG.md com as mudanças
# Verifique se todos os testes passam
wails build -clean
```

### 2. Criar Tag

```bash
# Commit final
git add .
git commit -m "chore: prepare v1.x.x release"

# Criar tag
git tag v1.x.x
git push origin main --tags
```

### 3. Build Automático

O GitHub Actions é disparado automaticamente quando uma tag `v*` é criada:

1. **Windows**: Build com NSIS → `DownKingo-windows-amd64-installer.exe`
2. **macOS**: Build + DMG → `DownKingo.dmg`
3. **Linux**: Build + AppImage → `DownKingo-linux-amd64.AppImage`

### 4. Publicação

Os artefatos são automaticamente anexados à Release no GitHub.

## Cadência de Releases

| Tipo       | Frequência          | Descrição                     |
| ---------- | ------------------- | ----------------------------- |
| **Stable** | Mensal              | Features completas e testadas |
| **Patch**  | Conforme necessário | Correções urgentes de bugs    |

## Checklist de Release

- [ ] CHANGELOG.md atualizado
- [ ] Versão correta no código
- [ ] Testes passando
- [ ] Build local funcionando
- [ ] Tag criada e pushada
- [ ] Release notes no GitHub
