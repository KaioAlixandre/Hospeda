# Hospeda Catálogo

SPA pública de reservas online (`hospeda-catalogo`). Visitantes escolhem datas, veem disponibilidade e enviam um pedido de reserva — sem login e sem CPF.

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
| `VITE_API_URL` | `http://localhost:3333` | URL da API Hospeda |

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

Exemplo de site estático com fallback SPA:

```
reservas.seudominio.com.br {
  root * /var/www/hospeda-catalogo
  encode gzip
  try_files {path} /index.html
  file_server
}
```

Veja também `scripts/deploy.example.sh` para um rsync de exemplo.
