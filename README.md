# Medipa Saúde Ocupacional: site institucional

Site estático (HTML, CSS e JavaScript puros, sem build) com catálogo de serviços, carrinho, checkout, mapa e Street View da entrada.

## Estrutura

```
index.html          página principal
legal.html          termos de venda e privacidade (rascunho)
css/                estilos (style.css, checkout.css)
js/                 config.js (configurações), main.js, cart.js, checkout.js, api.js, track.js
img/                hero.jpg e servicos/ (fotos dos cards)
docs/               BACKEND.md (contrato do backend) e CREDITOS-IMAGENS.md
```

## Como publicar

### GitHub Pages (grátis)
1. Crie um repositório no GitHub e envie **o conteúdo desta pasta** (o `index.html` precisa ficar na raiz do repositório).
2. No repositório: **Settings → Pages → Build and deployment**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**.
3. Em poucos minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. Domínio próprio: em **Settings → Pages → Custom domain**, informe o domínio e aponte o DNS conforme o GitHub orientar.

### Alternativas
Netlify ou Vercel: conecte o repositório e publique sem nenhuma configuração (não há build).

## Antes de colocar no ar (importante)

- **A loja está em modo demonstração.** Em `js/config.js`, `MOCK: true` faz Pix, cartão e boleto serem simulados no navegador, sem cobrança real. Publicado assim, o site mostra o aviso "Modo demonstração" no checkout. Só coloque `MOCK: false` quando o backend existir (ver `docs/BACKEND.md`). Enquanto isso, o botão "Adicionar" do catálogo pode ser trocado por "Orçamento" (WhatsApp).
- **Confirmar o endereço.** O texto do site diz Rua Montes Claros, 81, mas o mapa e o Street View apontam para o Ed. Paradela Center (R. Itajubá, 120). Ajuste `ADDRESS` e `LOCATION` em `js/config.js` e o texto do endereço em `index.html`.
- **Horário de atendimento:** preencher `HOURS` em `js/config.js`.
- **Rastreio:** preencher `GA_ID` e `META_PIXEL_ID` em `js/config.js` (o aviso de cookies só aparece quando há IDs).
- **Textos jurídicos:** substituir o rascunho de `legal.html` por termos e política de privacidade reais.
- **Imagens:** as fotos atuais são de banco gratuito (Pexels). Troque por fotos reais da Medipa quando existirem (mesmo nome de arquivo). Créditos em `docs/CREDITOS-IMAGENS.md`.
- **Logotipo:** o logo é um wordmark provisório em CSS. Substituir pelo arquivo oficial em SVG.
- **Preços:** conferir com o cliente. Os valores vieram do site antigo.

## Testar localmente

Abra o `index.html` no navegador. O mapa e o Street View precisam de internet.
