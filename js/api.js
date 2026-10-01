// Camada de API da loja.
// MOCK = true  → tudo simulado aqui dentro (localStorage), sem rede.
// MOCK = false → chama o backend real. Contrato completo em BACKEND.md.
(function () {
  'use strict';
  var C = window.MEDIPA_CONFIG;
  var KEY = 'medipa_orders_mock';

  function request(method, path, body) {
    return fetch(C.API_BASE + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.message || 'Não foi possível concluir a operação.');
        return d;
      });
    });
  }

  // ---------- Simulação ----------
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var rnd = function (n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 10); return s; };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignora */ } }
  function addMs(ms) { return new Date(Date.now() + ms).toISOString(); }

  function mockCreate(p) {
    return sleep(1100).then(function () {
      var total = p.items.reduce(function (s, it) {
        var prod = (window.MEDIPA_CATALOG || []).filter(function (x) { return x.id === it.id; })[0];
        return s + (prod ? prod.price * it.qty : 0);
      }, 0);
      var order = { orderId: 'MED-' + rnd(6), method: p.method, total: total, status: 'pending', createdAt: new Date().toISOString(), customer: p.customer };
      if (p.method === 'pix') {
        order.pix = {
          copyPaste: '00020126580014BR.GOV.BCB.PIX0136DEMO-' + rnd(12) + '5204000053039865802BR5913MEDIPA DEMO6007IPATINGA62070503***6304' + rnd(4),
          qrCodeBase64: null, // em produção o backend devolve a imagem do QR Code
          expiresAt: addMs(C.PIX_MINUTES * 60000)
        };
      } else if (p.method === 'boleto') {
        order.boleto = {
          digitableLine: '23793.38128 60000.000003 00000.000400 1 ' + rnd(14),
          pdfUrl: '#',
          dueDate: addMs(C.BOLETO_DAYS * 86400000)
        };
      } else if (p.method === 'card') {
        // Demonstração: cartão terminado em 0002 é recusado.
        if (/0002$/.test(p.cardToken || '')) {
          order.status = 'refused';
          order.message = 'Pagamento recusado pela operadora. Tente outro cartão ou outra forma de pagamento.';
        } else {
          order.status = 'paid';
        }
      }
      if (order.status !== 'refused') { var all = load(); all[order.orderId] = order; save(all); }
      return order;
    });
  }
  function mockGet(id) {
    return sleep(300).then(function () {
      var o = load()[id]; if (!o) throw new Error('Pedido não encontrado.'); return o;
    });
  }

  window.MedipaAPI = {
    // Gera o token do cartão. Em produção use o SDK do provedor (Mercado Pago, Asaas, Stripe etc.);
    // os dados do cartão NUNCA devem trafegar pelo nosso servidor. Ver BACKEND.md.
    tokenizeCard: function (card) {
      if (C.MOCK) return sleep(400).then(function () { return 'tok_' + card.number.replace(/\D/g, '').slice(-4); });
      return Promise.reject(new Error('TODO(backend): integrar a tokenização do provedor em MedipaAPI.tokenizeCard'));
    },
    createOrder: function (payload) { return C.MOCK ? mockCreate(payload) : request('POST', '/orders', payload); },
    getOrder: function (id) { return C.MOCK ? mockGet(id) : request('GET', '/orders/' + encodeURIComponent(id)); },
    // Só existe no modo demonstração: simula a confirmação do Pix/boleto.
    mockConfirmPayment: function (id) {
      return sleep(600).then(function () {
        var all = load(); if (all[id]) { all[id].status = 'paid'; save(all); } return all[id];
      });
    }
  };
})();
