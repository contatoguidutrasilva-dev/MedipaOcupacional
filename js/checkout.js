// Interface de carrinho e checkout (dados → pagamento → confirmação).
(function () {
  'use strict';
  var C = window.MEDIPA_CONFIG, Cart = window.MedipaCart, API = window.MedipaAPI;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var brl = function (n) { return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var ic = function (n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; };
  var dateBR = function (iso) { return new Date(iso).toLocaleDateString('pt-BR'); };

  // ---------- Rastreio ----------
  var track = function (n, p) { if (window.MedipaTrack) window.MedipaTrack(n, p); };
  function gaItems(list) {
    return list.map(function (i) { return { item_id: i.id, item_name: i.name, item_category: i.cat, price: i.price, quantity: i.qty }; });
  }

  // ---------- Validações ----------
  var onlyDigits = function (s) { return String(s).replace(/\D/g, ''); };
  function validCPF(v) {
    v = onlyDigits(v); if (v.length !== 11 || /^(\d)\1+$/.test(v)) return false;
    for (var t = 9; t < 11; t++) {
      var sum = 0; for (var i = 0; i < t; i++) sum += +v[i] * (t + 1 - i);
      var d = ((sum * 10) % 11) % 10; if (d !== +v[t]) return false;
    }
    return true;
  }
  function validCNPJ(v) {
    v = onlyDigits(v); if (v.length !== 14 || /^(\d)\1+$/.test(v)) return false;
    for (var t = 12; t < 14; t++) {
      var w = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], sum = 0;
      for (var i = 0; i < t; i++) sum += +v[i] * w[i];
      var r = sum % 11, d = r < 2 ? 0 : 11 - r; if (d !== +v[t]) return false;
    }
    return true;
  }
  function luhn(v) {
    v = onlyDigits(v); if (v.length < 13) return false;
    var s = 0, alt = false;
    for (var i = v.length - 1; i >= 0; i--) { var n = +v[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; }
    return s % 10 === 0;
  }
  var validEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
  function validExpiry(v) {
    var m = /^(\d{2})\/(\d{2})$/.exec(v); if (!m) return false;
    var mm = +m[1], yy = 2000 + +m[2]; if (mm < 1 || mm > 12) return false;
    var now = new Date(); return yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1);
  }

  // ---------- Máscaras ----------
  var masks = {
    doc: function (v, type) {
      v = onlyDigits(v);
      if (type === 'cpf') return v.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return v.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },
    phone: function (v) {
      v = onlyDigits(v).slice(0, 11);
      return v.length > 10 ? v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    },
    card: function (v) { return onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); },
    exp: function (v) { v = onlyDigits(v).slice(0, 4); return v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v; },
    cvv: function (v) { return onlyDigits(v).slice(0, 4); }
  };

  // ---------- Estado ----------
  var S = { step: 1, type: 'cnpj', method: 'pix', installments: 1, data: {}, order: null, timer: null, poll: null, tracked: {}, lastItems: [], lastTotal: 0 };

  // ---------- DOM base ----------
  var root = document.createElement('div');
  root.innerHTML =
    '<dialog class="drawer" id="cartDrawer" aria-labelledby="cartTitle"><div class="drawer__in">' +
    '<header class="dhead"><h2 id="cartTitle">Seu carrinho</h2><button class="x" data-close aria-label="Fechar carrinho">' + ic('x') + '</button></header>' +
    '<div class="drawer__list" id="cartList"></div><footer class="drawer__foot" id="cartFoot"></footer></div></dialog>' +
    '<dialog class="co" id="co" aria-labelledby="coTitle"><div class="co__in">' +
    '<header class="dhead"><h2 id="coTitle">Finalizar compra</h2><button class="x" data-close aria-label="Fechar">' + ic('x') + '</button></header>' +
    '<div class="co__body" id="coBody"></div></div></dialog>' +
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  document.body.appendChild(root);
  var drawer = $('#cartDrawer'), co = $('#co'), toastEl = $('#toast');

  function open(d) { if (!d.open) d.showModal(); }
  function close(d) { if (d.open) d.close(); }
  [drawer, co].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) close(d); });
    d.addEventListener('close', function () { document.documentElement.classList.remove('lock'); stopTimers(); });
    d.addEventListener('cancel', function () { /* ESC fecha normalmente */ });
  });
  function lock() { document.documentElement.classList.add('lock'); }

  var toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
  }
  function stopTimers() { clearInterval(S.timer); clearInterval(S.poll); S.timer = S.poll = null; }

  // ---------- Carrinho ----------
  function renderBadge() {
    var n = Cart.count();
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  function renderCart() {
    var items = Cart.items(), list = $('#cartList'), foot = $('#cartFoot');
    if (!items.length) {
      list.innerHTML = '<div class="empty-cart">' + ic('cart') + '<p>Seu carrinho está vazio.</p><button class="btn btn--card" data-close>Ver serviços</button></div>';
      foot.innerHTML = ''; return;
    }
    list.innerHTML = items.map(function (i) {
      return '<div class="ci" data-id="' + esc(i.id) + '"><div class="ci__t"><b>' + esc(i.name) + '</b><small>' + brl(i.price) + ' cada</small></div>' +
        '<div class="qty"><button data-dec aria-label="Diminuir quantidade">−</button><span aria-live="polite">' + i.qty + '</span><button data-inc aria-label="Aumentar quantidade">+</button></div>' +
        '<strong class="ci__p">' + brl(i.total) + '</strong><button class="ci__rm" data-rm aria-label="Remover ' + esc(i.name) + '">' + ic('trash') + '</button></div>';
    }).join('');
    foot.innerHTML = '<div class="sum"><span>Total</span><b>' + brl(Cart.total()) + '</b></div>' +
      '<button class="btn btn--block" data-checkout>' + ic('lock') + ' Finalizar compra</button>' +
      '<button class="link link--c" data-clear>Esvaziar carrinho</button>';
  }
  drawer.addEventListener('click', function (e) {
    var row = e.target.closest('.ci'), id = row && row.getAttribute('data-id');
    if (e.target.closest('[data-inc]')) { var it = Cart.items().filter(function (x) { return x.id === id; })[0]; Cart.setQty(id, it.qty + 1); }
    else if (e.target.closest('[data-dec]')) { var it2 = Cart.items().filter(function (x) { return x.id === id; })[0]; Cart.setQty(id, it2.qty - 1); }
    else if (e.target.closest('[data-rm]')) Cart.remove(id);
    else if (e.target.closest('[data-clear]')) Cart.clear();
    else if (e.target.closest('[data-checkout]')) { close(drawer); startCheckout(); }
  });
  document.addEventListener('cart:change', function () { renderBadge(); renderCart(); });

  // Eventos globais da página
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      Cart.add(add.getAttribute('data-add'));
      var added = (window.MEDIPA_CATALOG || []).filter(function (p) { return p.id === add.getAttribute('data-add'); })[0];
      if (added) track('add_to_cart', { currency: 'BRL', value: added.price, items: gaItems([{ id: added.id, name: added.name, cat: added.cat, price: added.price, qty: 1 }]) });
      var name = add.getAttribute('data-name') || 'Item';
      toast(name + ' adicionado ao carrinho');
      add.classList.add('is-added'); setTimeout(function () { add.classList.remove('is-added'); }, 900);
    }
    if (e.target.closest('[data-open-cart]')) { renderCart(); open(drawer); lock(); }
  });

  // ---------- Checkout ----------
  function startCheckout() {
    if (!Cart.count()) return;
    S.step = 1; S.order = null; stopTimers();
    track('begin_checkout', { currency: 'BRL', value: Cart.total(), items: gaItems(Cart.items()) });
    renderCheckout(); open(co); lock();
  }

  function summaryHTML() {
    var items = Cart.items();
    return '<aside class="co__sum"><h3>Resumo do pedido</h3>' +
      items.map(function (i) { return '<div class="sl"><span>' + i.qty + '× ' + esc(i.name) + '</span><b>' + brl(i.total) + '</b></div>'; }).join('') +
      '<div class="sl sl--t"><span>Total</span><b>' + brl(Cart.total()) + '</b></div>' +
      '<p class="secnote">' + ic('lock') + ' Ambiente protegido. Seus dados são usados apenas para processar o pedido.</p></aside>';
  }
  function stepper() {
    var steps = ['Dados', 'Pagamento', 'Confirmação'];
    return '<ol class="steps">' + steps.map(function (t, i) {
      var n = i + 1, cls = n < S.step ? 'is-done' : n === S.step ? 'is-now' : '';
      return '<li class="' + cls + '"><span>' + (n < S.step ? ic('check') : n) + '</span>' + t + '</li>';
    }).join('') + '</ol>';
  }
  var demoBanner = function () { return C.MOCK ? '<div class="demo">' + ic('info') + ' <b>Modo demonstração:</b> nenhum pagamento real é feito e nenhum dado sai do seu navegador.</div>' : ''; };

  function field(name, label, opts) {
    opts = opts || {};
    var v = esc(S.data[name] || '');
    var input = opts.textarea
      ? '<textarea name="' + name + '" rows="3" placeholder="' + esc(opts.ph || '') + '">' + v + '</textarea>'
      : '<input name="' + name + '" type="' + (opts.type || 'text') + '" value="' + v + '" placeholder="' + esc(opts.ph || '') + '" autocomplete="' + (opts.ac || 'off') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.max ? ' maxlength="' + opts.max + '"' : '') + '>';
    return '<label class="f ' + (opts.cls || '') + '"><span>' + label + (opts.opt ? ' <em>(opcional)</em>' : '') + '</span>' + input + '<small class="err" data-err="' + name + '"></small></label>';
  }

  function renderCheckout() {
    var b = $('#coBody');
    if (S.step === 1) {
      var emp = S.type === 'cnpj';
      b.innerHTML = demoBanner() + stepper() + '<div class="co__grid"><form id="fData" class="co__form" novalidate>' +
        '<h3>Quem está comprando?</h3>' +
        '<div class="seg" role="radiogroup" aria-label="Tipo de comprador"><label><input type="radio" name="type" value="cnpj"' + (emp ? ' checked' : '') + '><span>' + ic('users') + ' Empresa (CNPJ)</span></label>' +
        '<label><input type="radio" name="type" value="cpf"' + (!emp ? ' checked' : '') + '><span>' + ic('heart') + ' Pessoa física (CPF)</span></label></div>' +
        '<div class="frow">' + field('document', emp ? 'CNPJ' : 'CPF', { inputmode: 'numeric', ph: emp ? '00.000.000/0000-00' : '000.000.000-00' }) +
        field('name', emp ? 'Razão social' : 'Nome completo', { ac: emp ? 'organization' : 'name' }) + '</div>' +
        (emp ? field('contact', 'Nome do responsável', { ac: 'name' }) : '') +
        '<div class="frow">' + field('email', 'E-mail', { type: 'email', ac: 'email', ph: 'voce@empresa.com.br' }) +
        field('phone', 'Telefone / WhatsApp', { type: 'tel', ac: 'tel', inputmode: 'tel', ph: '(00) 00000-0000' }) + '</div>' +
        field('notes', 'Observações', { textarea: true, opt: true, ph: 'Ex.: quantidade de colaboradores, datas de preferência para o agendamento' }) +
        '<button class="btn btn--block" type="submit">Continuar para o pagamento ' + ic('arrow') + '</button></form>' + summaryHTML() + '</div>';
      bindData();
    } else if (S.step === 2) {
      b.innerHTML = demoBanner() + stepper() + '<div class="co__grid"><form id="fPay" class="co__form" novalidate>' +
        '<h3>Como prefere pagar?</h3>' +
        '<div class="methods" role="radiogroup" aria-label="Forma de pagamento">' +
        method('pix', 'pix', 'Pix', 'Aprovação na hora') + method('card', 'card', 'Cartão de crédito', 'Até ' + C.MAX_INSTALLMENTS + 'x sem juros') + method('boleto', 'barcode', 'Boleto', 'Vence em ' + C.BOLETO_DAYS + ' dias') + '</div>' +
        '<div id="payPanel"></div>' +
        '<label class="chk"><input type="checkbox" name="terms"><span>Li e concordo com os <a href="' + C.TERMS_URL + '" target="_blank" rel="noopener">Termos de venda</a> e a <a href="' + C.PRIVACY_URL + '" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>' +
        '<small class="err" data-err="terms"></small><div class="banner err-b" id="payErr" role="alert" hidden></div>' +
        '<div class="actions"><button class="btn btn--ghost-d" type="button" data-back>Voltar</button>' +
        '<button class="btn" type="submit" id="payBtn">' + ic('lock') + ' <span>Confirmar pedido · ' + brl(Cart.total()) + '</span></button></div></form>' + summaryHTML() + '</div>';
      bindPay();
    } else {
      renderResult(b);
    }
    b.scrollTop = 0; $('#co .co__in').scrollTop = 0;
  }
  function method(id, icon, t, sub) {
    return '<label class="m"><input type="radio" name="method" value="' + id + '"' + (S.method === id ? ' checked' : '') + '><span class="m__c">' + ic(icon) + '<b>' + t + '</b><small>' + sub + '</small></span></label>';
  }

  function bindData() {
    var f = $('#fData');
    $$('input[name=type]', f).forEach(function (r) {
      r.addEventListener('change', function () { collect(f); S.type = r.value; S.data.document = ''; renderCheckout(); });
    });
    f.elements.document.addEventListener('input', function (e) { e.target.value = masks.doc(e.target.value, S.type); });
    f.elements.phone.addEventListener('input', function (e) { e.target.value = masks.phone(e.target.value); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); collect(f);
      var d = S.data, errs = {};
      if (S.type === 'cnpj' ? !validCNPJ(d.document) : !validCPF(d.document)) errs.document = S.type === 'cnpj' ? 'Informe um CNPJ válido.' : 'Informe um CPF válido.';
      if (!d.name || d.name.trim().length < 3) errs.name = 'Campo obrigatório.';
      if (S.type === 'cnpj' && (!d.contact || d.contact.trim().length < 3)) errs.contact = 'Informe o nome do responsável.';
      if (!validEmail(d.email || '')) errs.email = 'Informe um e-mail válido.';
      if (onlyDigits(d.phone || '').length < 10) errs.phone = 'Informe um telefone com DDD.';
      if (showErrors(f, errs)) return;
      S.step = 2; renderCheckout();
    });
    var first = f.querySelector('input[name=document]'); if (first) first.focus({ preventScroll: true });
  }
  function collect(f) {
    ['document', 'name', 'contact', 'email', 'phone', 'notes'].forEach(function (k) { if (f.elements[k]) S.data[k] = f.elements[k].value.trim(); });
  }
  function showErrors(form, errs) {
    $$('[data-err]', form).forEach(function (s) { s.textContent = errs[s.getAttribute('data-err')] || ''; });
    $$('input,textarea', form).forEach(function (i) { i.classList.toggle('bad', !!errs[i.name]); i.setAttribute('aria-invalid', errs[i.name] ? 'true' : 'false'); });
    var keys = Object.keys(errs);
    if (keys.length) { var el = form.elements[keys[0]]; if (el && el.focus) el.focus(); }
    return keys.length > 0;
  }

  function bindPay() {
    var f = $('#fPay');
    function panel() {
      var p = $('#payPanel'), m = S.method;
      if (m === 'pix') p.innerHTML = '<div class="note-b">' + ic('pix') + '<p>Ao confirmar, geramos um <b>QR Code Pix</b> e o código copia e cola. O pagamento é confirmado em instantes e o QR Code vale por ' + C.PIX_MINUTES + ' minutos.</p></div>';
      else if (m === 'boleto') p.innerHTML = '<div class="note-b">' + ic('barcode') + '<p>Ao confirmar, geramos o <b>boleto</b> com vencimento em ' + C.BOLETO_DAYS + ' dias. A confirmação do pagamento pode levar alguns dias úteis.</p></div>';
      else {
        var opts = ''; for (var n = 1; n <= C.MAX_INSTALLMENTS; n++) opts += '<option value="' + n + '"' + (S.installments === n ? ' selected' : '') + '>' + n + 'x de ' + brl(Cart.total() / n) + (n === 1 ? ' (à vista)' : ' sem juros') + '</option>';
        p.innerHTML = '<div class="cardbox"><div class="frow">' +
          '<label class="f"><span>Número do cartão</span><input name="cnum" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"><small class="err" data-err="cnum"></small></label>' +
          '<label class="f"><span>Nome impresso no cartão</span><input name="cname" autocomplete="cc-name" placeholder="Como está no cartão"><small class="err" data-err="cname"></small></label></div>' +
          '<div class="frow frow--3"><label class="f"><span>Validade</span><input name="cexp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA"><small class="err" data-err="cexp"></small></label>' +
          '<label class="f"><span>CVV</span><input name="ccvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123"><small class="err" data-err="ccvv"></small></label>' +
          '<label class="f"><span>Parcelas</span><select name="inst">' + opts + '</select></label></div>' +
          (C.MOCK ? '<p class="hint">Teste: use 4111 1111 1111 1111 (aprovado) ou 4000 0000 0000 0002 (recusado), com qualquer validade futura.</p>' : '') + '</div>';
        f.elements.cnum.addEventListener('input', function (e) { e.target.value = masks.card(e.target.value); });
        f.elements.cexp.addEventListener('input', function (e) { e.target.value = masks.exp(e.target.value); });
        f.elements.ccvv.addEventListener('input', function (e) { e.target.value = masks.cvv(e.target.value); });
        f.elements.inst.addEventListener('change', function (e) { S.installments = +e.target.value; });
      }
    }
    panel();
    $$('input[name=method]', f).forEach(function (r) { r.addEventListener('change', function () { S.method = r.value; panel(); $('#payErr').hidden = true; }); });
    $('[data-back]', f).addEventListener('click', function () { S.step = 1; renderCheckout(); });
    f.addEventListener('submit', function (e) { e.preventDefault(); submitPay(f); });
  }

  function submitPay(f) {
    var errs = {}, err = $('#payErr'); err.hidden = true;
    if (!f.elements.terms.checked) errs.terms = 'Aceite os termos para continuar.';
    if (S.method === 'card') {
      var n = f.elements.cnum.value;
      if (!luhn(n)) errs.cnum = 'Número de cartão inválido.';
      if (f.elements.cname.value.trim().length < 3) errs.cname = 'Informe o nome impresso.';
      if (!validExpiry(f.elements.cexp.value)) errs.cexp = 'Validade inválida.';
      if (onlyDigits(f.elements.ccvv.value).length < 3) errs.ccvv = 'CVV inválido.';
    }
    if (showErrors(f, errs)) return;

    track('add_payment_info', { currency: 'BRL', value: Cart.total(), payment_type: S.method });
    S.lastItems = Cart.items(); S.lastTotal = Cart.total();
    var btn = $('#payBtn'); btn.disabled = true; btn.classList.add('is-loading'); btn.querySelector('span').textContent = 'Processando…';
    var d = S.data;
    var tokenP = S.method === 'card'
      ? API.tokenizeCard({ number: f.elements.cnum.value, name: f.elements.cname.value, expiry: f.elements.cexp.value, cvv: f.elements.ccvv.value })
      : Promise.resolve(null);
    tokenP.then(function (tok) {
      return API.createOrder({
        customer: { type: S.type, document: onlyDigits(d.document), name: d.name, contact: d.contact || null, email: d.email, phone: onlyDigits(d.phone), notes: d.notes || null },
        items: Cart.items().map(function (i) { return { id: i.id, qty: i.qty }; }), // preços NÃO vão: o servidor recalcula
        method: S.method,
        installments: S.method === 'card' ? S.installments : 1,
        cardToken: tok,
        acceptedTerms: true
      });
    }).then(function (order) {
      if (order.status === 'refused') throw new Error(order.message || 'Pagamento recusado.');
      S.order = order; S.step = 3; Cart.clear(); renderCheckout();
    }).catch(function (e) {
      btn.disabled = false; btn.classList.remove('is-loading'); btn.querySelector('span').textContent = 'Confirmar pedido · ' + brl(Cart.total());
      err.textContent = e.message || 'Não foi possível concluir. Tente novamente.'; err.hidden = false;
    });
  }

  // ---------- Resultado ----------
  function fakeQR(seed) {
    var n = 29, h = 0, cells = '';
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    function rnd() { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }
    function finder(x, y) { return x < 8 && y < 8 || x >= n - 8 && y < 8 || x < 8 && y >= n - 8; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var on;
      if (finder(x, y)) {
        var fx = x < 8 ? x : x - (n - 8), fy = y < 8 ? y : y - (n - 8);
        on = fx === 7 || fy === 7 ? false : (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4));
      } else on = rnd() > 0.5;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="QR Code de demonstração"><rect width="' + n + '" height="' + n + '" fill="#fff"/><g fill="#062815">' + cells + '</g></svg>';
  }
  function copyBtn(text, label) {
    return '<button class="btn btn--card copy" type="button" data-copy="' + esc(text) + '">' + ic('copy') + ' ' + label + '</button>';
  }

  function renderResult(b) {
    var o = S.order, paid = o.status === 'paid';
    if (paid && !S.tracked[o.orderId]) {
      S.tracked[o.orderId] = true; // evita contar a mesma compra duas vezes
      track('purchase', { transaction_id: o.orderId, currency: 'BRL', value: o.total, payment_type: o.method, items: gaItems(S.lastItems || []) });
    }
    var head = '<div class="res__h ' + (paid ? 'is-ok' : '') + '"><span class="res__i">' + ic(paid ? 'check' : 'file') + '</span>' +
      '<h3>' + (paid ? 'Pagamento confirmado!' : o.method === 'pix' ? 'Falta pouco: pague com Pix' : 'Boleto gerado') + '</h3>' +
      '<p>Pedido <b>' + esc(o.orderId) + '</b> · ' + brl(o.total) + '</p></div>';
    var body = '';
    if (!paid && o.method === 'pix') {
      body = '<div class="pixbox"><div class="qr">' + (o.pix.qrCodeBase64 ? '<img alt="QR Code Pix" src="data:image/png;base64,' + esc(o.pix.qrCodeBase64) + '">' : fakeQR(o.pix.copyPaste)) + '</div>' +
        '<div class="pixbox__t"><p>Abra o app do seu banco, escolha <b>Pix</b> e leia o QR Code, ou use o código copia e cola:</p>' +
        '<code class="code">' + esc(o.pix.copyPaste) + '</code>' + copyBtn(o.pix.copyPaste, 'Copiar código Pix') +
        '<p class="timer">Expira em <b id="pixT">--:--</b></p></div></div>';
    } else if (!paid && o.method === 'boleto') {
      body = '<div class="pixbox pixbox--b"><div class="pixbox__t"><p>Vencimento: <b>' + dateBR(o.boleto.dueDate) + '</b>. Use a linha digitável no app do seu banco ou abra o boleto:</p>' +
        '<code class="code">' + esc(o.boleto.digitableLine) + '</code><div class="actions actions--l">' + copyBtn(o.boleto.digitableLine, 'Copiar linha digitável') +
        '<a class="btn btn--card btn--alt" href="' + esc(o.boleto.pdfUrl) + '" target="_blank" rel="noopener">' + ic('file') + ' Abrir boleto</a></div></div></div>';
    }
    var next = '<div class="next"><h4>Próximos passos</h4><ul>' +
      '<li>' + ic('mail') + ' Enviaremos a confirmação para <b>' + esc(S.data.email) + '</b>.</li>' +
      '<li>' + ic('phone') + ' A equipe Medipa entrará em contato para agendar ou confirmar o serviço.</li></ul></div>';
    var mock = '';
    if (C.MOCK && !paid) mock = '<button class="btn btn--ghost-d" type="button" id="simPay">Simular pagamento (demonstração)</button>';
    var wa = 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent('Olá, Medipa! Fiz o pedido ' + o.orderId + ' pelo site.');
    b.innerHTML = demoBanner() + stepper() + '<div class="res">' + head + body + next +
      '<div class="actions actions--c">' + mock + '<a class="btn" target="_blank" rel="noopener" href="' + wa + '">' + ic('wa') + ' Falar com a equipe</a>' +
      '<button class="btn btn--ghost-d" type="button" data-close>Fechar</button></div></div>';

    if (!paid) {
      if (o.method === 'pix') startPixTimer(o.pix.expiresAt);
      S.poll = setInterval(function () {
        API.getOrder(o.orderId).then(function (n) { if (n.status === 'paid') { S.order = n; stopTimers(); renderCheckout(); } }).catch(function () { /* tenta de novo */ });
      }, 5000);
      var sim = $('#simPay'); if (sim) sim.addEventListener('click', function () {
        sim.disabled = true; sim.textContent = 'Confirmando…';
        API.mockConfirmPayment(o.orderId).then(function (n) { S.order = n; stopTimers(); renderCheckout(); });
      });
    }
  }
  function startPixTimer(exp) {
    var el = $('#pixT');
    function tick() {
      var left = Math.max(0, Math.floor((new Date(exp) - Date.now()) / 1000));
      if (!$('#pixT')) return;
      $('#pixT').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (!left) { clearInterval(S.timer); $('#pixT').parentNode.innerHTML = 'Este QR Code expirou. Feche e faça um novo pedido.'; }
    }
    if (el) { tick(); S.timer = setInterval(tick, 1000); }
  }
  co.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    var t = c.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copiado!'); }, function () {
      var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiado!'); } catch (er) { toast('Não foi possível copiar.'); } ta.remove();
    });
  });

  renderBadge();
})();
