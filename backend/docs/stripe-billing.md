# Assinaturas Stripe (Hospeda)

## 1. No Dashboard Stripe

1. Crie três **Products** recorrentes mensais (BRL):
   - Simples — R$ 53,00/mês
   - Pro — R$ 73,00/mês
   - Plus — R$ 93,00/mês
2. Copie o **Price ID** de cada um (`price_...`).
3. Em Developers → API keys, copie a **Secret key** (`sk_...`).
4. Em Developers → Webhooks, aponte para:
   `https://api.seudominio.com.br/billing/webhook`
   Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copie o **Webhook signing secret** (`whsec_...`).

## 2. Variáveis no `.env` da API

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SIMPLES=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PLUS=price_...
BILLING_RETURN_URL=https://reservas.seudominio.com.br
```

Sem essas variáveis, o app continua só com upgrade via WhatsApp/admin.

## 3. Banco

```bash
npx prisma migrate deploy
# ou, em local: npx prisma db push
```

## 4. Fluxo

- Hotel em Configurações → Plano → **Assinar** (Simples, Pro ou Plus) abre o Checkout Stripe.
- Webhook atualiza `plan`, `planStatus`, `planPaidUntil` e grava `PlanEvent` com `actor: webhook:stripe`.
- **Gerenciar assinatura** abre o Customer Portal (trocar cartão / cancelar).
- Admin manual (`PATCH /admin/hotels/:id/plan`) continua valendo para cortesia.
