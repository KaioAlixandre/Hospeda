# StayDesck Catálogo

SPA pública de reservas online (`staydesck-catalogo`). Visitantes escolhem datas, veem disponibilidade e enviam um pedido de reserva — sem login e sem CPF.

## Desenvolvimento

```bash
cd front-end/catalogo
cp .env.example .env   # opcional
npm install
npm run dev
```

Variável de ambiente:

| Variável       | Padrão                 | Descrição        |
|----------------|------------------------|------------------|
| `VITE_API_URL` | `http://localhost:3333` | URL da API StayDesck |

Rotas:

- `/h/:slug` — capa do hotel
- `/h/:slug/quartos` — disponibilidade
- `/h/:slug/reservar/:roomTypeId` — formulário do hóspede
- `/h/:slug/pronto/:code` — confirmação do pedido

## Build

```bash
npm run build
```

Artefatos em `dist/`. Preview local: `npm run preview`.

## Deploy (Caddy)

Domínio de produção: **staydesk.com.br**.

DNS (no registrador do domínio):

| Tipo | Nome | Valor |
|------|------|--------|
| A    | `@`  | IP da VPS |
| A    | `www`| IP da VPS (ou CNAME → staydesk.com.br) |

Caddy (SPA + HTTPS):

```
staydesk.com.br, www.staydesk.com.br {
  root * /var/www/staydesck-catalogo
  encode gzip
  try_files {path} /index.html
  file_server
}
```

Build com a API de produção:

```bash
VITE_API_URL=https://api.seudominio.com.br npm run build
```

Na API, defina `CATALOG_PUBLIC_BASE_URL=https://staydesk.com.br` (links `/h/:slug` e QR Code).

Veja também `scripts/deploy.example.sh` para um rsync de exemplo.
