# 🌐 Internacionalização (i18n) do DownKingo

Este projeto utiliza um fluxo estruturado de tradução para manter a interface traduzida e consistente.

## 🛠️ Stack Tecnológica

- **Core**: `i18next` + `react-i18next`
- **Extração**: `i18next-parser` (Varre o código e cria os JSONs)
- **Qualidade**: `eslint-plugin-i18next` (Impede texto hardcoded no código)

---

## 📂 Estrutura de Arquivos

As traduções ficam em `src/i18n/locales/{idioma}/{namespace}.json`.
Nós usamos **namespaces** para organizar melhor as strings:

- `common.json`: Botões gerais, mensagens de erro, status (usado em todo o app).
- `settings.json`: Textos específicos da tela de configurações.
- `converter.json`: Strings da ferramenta de conversão.
- `roadmap.json`, `images.json`, etc.

**Idioma Base (Source of Truth):** 🇧🇷 `pt-BR` (Português Brasileiro).

---

## 🚀 Workflow de Tradução

### 1. Desenvolvendo (Adicionando Textos)

No seu componente React, nunca escreva texto fixo. Use a função `t()`:

```tsx
// ❌ ERRADO (O Linter vai reclamar!)
<span>Bem-vindo ao DownKingo</span>;

// ✅ CORRETO
import { useTranslation } from "react-i18next";

export function MeuComponente() {
  const { t } = useTranslation("common"); // 'common' é o namespace
  return <span>{t("welcome_message")}</span>;
}
```

### 2. Extraindo Chaves (Automático)

Depois de adicionar os `t('chave')` no código, você **não precisa** criar o JSON na mão. Rode:

```bash
bun run i18n:extract
```

🔹 **O que isso faz?**

- Varre todo o código-fonte `.tsx/.ts`.
- Encontra todas as chaves novas.
- Cria/Atualiza os arquivos JSON em `src/i18n/locales` para **todos** os idiomas.
- Se a chave for nova, ela entra vazia (`""`) nos outros idiomas, pronta para ser traduzida.

### 3. Validando (CI/CD)

No nosso pipeline de CI (Github Actions), rodamos:

```bash
bun run i18n:check
```

Isso garante que ninguém subiu código novo sem rodar a extração. Se houver chaves no código que não estão nos JSONs, o build falha.

---

## ⚠️ Regras do Linter

Temos uma regra estrita no ESLint (`i18next/no-literal-string`).
Se você tentar digitar um texto solto no JSX, o VS Code vai sublinhar de vermelho.

**Para ignorar (casos raros):**
Se for um texto que não deve ser traduzido (ex: símbolos, códigos), use:

```tsx
{
  /* i18next-disable-line */
}
<span>12345</span>;
```

Ou adicione a prop na lista de ignorados no `.eslintrc.cjs` se for um atributo técnico (como `testId` ou `animate`).
