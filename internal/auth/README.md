# Auth Package

O pacote `internal/auth` implementa a autenticação com o GitHub utilizando o **OAuth 2.0 Device Flow**, ideal para aplicações desktop e CLI.

## Como Funciona (Device Authorization Flow)

Diferente do fluxo web tradicional (que requer callback URLs e Client Secrets), o Device Flow funciona assim:

1.  **Request Code**: A aplicação solicita um código de dispositivo (`StartDeviceFlow`).
2.  **User Action**: O usuário visita a URL de verificação no navegador (exibida no frontend) e digita o código.
3.  **Polling**: A aplicação fica "perguntando" (polling) ao GitHub se o usuário já autorizou.
4.  **Token**: Quando autorizado, o GitHub responde com o `access_token`.

### Segurança

- **Client ID**: `Iv23liJjoBb3O4FatgRC` (Público, seguro para embedar no binário neste fluxo).
- **Client Secret**: **NÃO utilizado**. O Device Flow não requer segredo, tornando-o seguro para Open Source.
- **Scopes**: `read:project`, `public_repo`, `user:email`.

## Persistência

O token de acesso é salvo localmente em `AppData/auth/session.json`.

```json
{
  "access_token": "ghu_..."
}
```

O `AuthService` carrega este token automaticamente na inicialização. Se o arquivo não existir ou for inválido, o usuário é considerado deslogado.

## Polling Inteligente

O método `PollToken` respeita as diretrizes rigorosas da API do GitHub:

- **Intervalo Mínimo**: 5 segundos.
- **Slow Down**: Se receber erro `slow_down`, o intervalo de polling é aumentado.
- **Timeout**: O código expira em 15 minutos.
