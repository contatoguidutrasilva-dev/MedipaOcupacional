# Medipa, contrato do backend de compra

O front-end da loja já está pronto e funciona em **modo demonstração** (`MOCK: true` em `js/config.js`).
Tudo o que o backend precisa fazer está neste documento. Para ligar: implementar os endpoints abaixo, trocar `MOCK` para `false`
e ajustar `API_BASE` em `js/config.js`. O front só chama a camada `js/api.js`, então nada mais precisa mudar.

## Arquivos do front envolvidos

| Arquivo | Papel |
|---|---|
| `js/config.js` | Liga/desliga o modo demonstração e define regras (parcelas, validade do Pix/boleto, valor máximo online). |
| `js/api.js` | Única camada que fala com o backend. Trocar o que estiver marcado como `TODO(backend)`. |
| `js/cart.js` | Carrinho (localStorage). Guarda só `{id, qty}`. |
| `js/checkout.js` | Interface do carrinho, dados, pagamento e confirmação. |
| `js/main.js` | Catálogo (`CATS`). Gera `window.MEDIPA_CATALOG`. |

## Regras que o backend deve seguir (importante)

1. **Preços sempre do servidor.** O front envia só `id` e `qty`. O servidor mantém o seu próprio catálogo (mesmos `id` de `js/main.js`, gerados pelo nome sem acento em minúsculas e com hífens, ex. `exame-admissional`) e recalcula o total. Nunca confiar em preço vindo do navegador.
2. **Cartão nunca passa pelo servidor.** O front deve gerar um **token** com o SDK do provedor (Mercado Pago, Asaas, Stripe, Pagar.me etc.) e enviar só `cardToken`. Implementar em `MedipaAPI.tokenizeCard` (hoje devolve um token falso). Em produção, trocar os campos de cartão pelos campos seguros do provedor, para o site não manipular PAN/CVV.
3. **Confirmação só por webhook.** O status `paid` vem do webhook do provedor, não do navegador. O front faz polling em `GET /orders/:id`.
4. **Itens acima de `QUOTE_ONLY_ABOVE` (R$ 10.000) ou sem preço** não entram no carrinho; vão para orçamento por WhatsApp. O servidor deve recusar esses itens também.
5. **HTTPS obrigatório**, CORS restrito ao domínio do site, rate limit em `POST /orders`, validação de CPF/CNPJ/e-mail também no servidor.
6. **LGPD:** guardar só o necessário, registrar aceite dos termos (`acceptedTerms` + data/IP), e publicar os textos reais em `legal.html` (hoje são rascunho).

## Endpoints

### `POST /api/orders`: cria o pedido e a cobrança

Requisição:

```json
{
  "customer": {
    "type": "cnpj",
    "document": "12345678000190",
    "name": "Empresa Exemplo LTDA",
    "contact": "Nome do responsável (só para CNPJ)",
    "email": "rh@empresa.com.br",
    "phone": "31999999999",
    "notes": "texto livre ou null"
  },
  "items": [{ "id": "exame-admissional", "qty": 3 }],
  "method": "pix",
  "installments": 1,
  "cardToken": null,
  "acceptedTerms": true
}
```

`method`: `pix` | `card` | `boleto`. `installments` de 1 a `MAX_INSTALLMENTS` (só cartão). `cardToken` só no cartão.

Resposta `201`:

```json
{
  "orderId": "MED-123456",
  "status": "pending",
  "method": "pix",
  "total": 195.0,
  "pix": {
    "copyPaste": "000201...",
    "qrCodeBase64": "iVBORw0KGgo...",
    "expiresAt": "2026-01-01T12:30:00Z"
  }
}
```

- **Boleto:** trocar `pix` por `"boleto": { "digitableLine": "...", "pdfUrl": "https://...", "dueDate": "2026-01-04T00:00:00Z" }`.
- **Cartão aprovado:** `"status": "paid"`, sem bloco extra.
- **Cartão recusado:** `"status": "refused"` com `"message": "texto para o cliente"` (o front mostra a mensagem e mantém o carrinho).
- **Erros de validação:** HTTP `4xx` com `{ "message": "texto para o cliente" }`.

`status`: `pending` | `paid` | `refused` | `expired` | `cancelled`.

### `GET /api/orders/:id`: consulta o pedido

Devolve o mesmo objeto do `POST` com o `status` atualizado. O front consulta a cada 5 s enquanto o Pix/boleto está `pending`.

### `POST /api/webhooks/payments`: chamado pelo provedor

Validar a assinatura do provedor, localizar o pedido, atualizar o `status` (idempotente) e disparar e-mail de confirmação ao cliente e aviso interno à equipe (`agendamento@medipabrasil.com.br`).

## Pontos em aberto com o cliente (Medipa)

- Provedor de pagamento (conta, chaves de API, taxas) e quem é o titular.
- Parcelamento: hoje 1x a 3x sem juros (`MAX_INSTALLMENTS`). Confirmar a regra real.
- Desconto no Pix? Hoje não existe.
- Vencimento do boleto (hoje 3 dias) e validade do Pix (hoje 30 min).
- Nota fiscal: quem emite, quando e como é enviada.
- Fluxo de agendamento após o pagamento (hoje a tela diz que a equipe entra em contato).
- Preços: os valores do site original ainda precisam ser confirmados, porque agora viram cobrança de verdade.
- Textos jurídicos (`legal.html`): termos de venda, cancelamento/reembolso e privacidade.

## Como testar o front em modo demonstração

- Cartão aprovado: `4111 1111 1111 1111`. Recusado: `4000 0000 0000 0002`. Validade futura qualquer, CVV com 3 dígitos.
- Pix e boleto mostram código de exemplo. O botão "Simular pagamento" confirma o pedido.
- Os pedidos de teste ficam em `localStorage` (`medipa_orders_mock`). Nenhuma requisição de rede é feita.

## Rastreio (Google Analytics 4 e Meta Pixel)

- Preencher `GA_ID` (ex. `G-XXXXXXXXXX`) e `META_PIXEL_ID` em `js/config.js`. Com os dois vazios, nada é carregado e o aviso de cookies não aparece.
- Os scripts só carregam depois do "Aceitar" do visitante (LGPD). A escolha fica em `localStorage` (`medipa_consent`).
- Eventos enviados: `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase` (só quando o pedido está `paid`, uma vez por pedido), `generate_lead` (formulário de contato), `whatsapp_click`, `phone_click`, `directions_click`.
- Para conferir antes de publicar: com `MOCK: true`, cada evento aparece no console do navegador como `[track]`.
- Quando houver backend, o ideal é confirmar a compra também pelo servidor (Conversions API da Meta e Measurement Protocol do GA4), porque bloqueadores de anúncio impedem parte dos eventos no navegador.
- Horário de atendimento: preencher `HOURS` em `js/config.js`, ex. `[['Segunda a sexta', '07h às 17h']]`. Enquanto estiver vazio, o site pede para consultar a equipe.
