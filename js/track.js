// Rastreio (Google Analytics 4 + Meta Pixel) com consentimento (LGPD).
// Nada é carregado sem ID em config.js e sem o "Aceitar" do visitante.
(function () {
  'use strict';
  var C = window.MEDIPA_CONFIG, KEY = 'medipa_consent', loaded = false;
  var enabled = !!(C.GA_ID || C.META_PIXEL_ID);

  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignora */ } }

  function loadGA() {
    if (!C.GA_ID) return;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', C.GA_ID);
  }
  function loadMeta() {
    if (!C.META_PIXEL_ID) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', C.META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  function load() { if (loaded) return; loaded = true; loadGA(); loadMeta(); }

  // Nome interno → evento do GA4 e evento padrão do Meta Pixel
  var MAP = {
    add_to_cart:      { ga: 'add_to_cart',      meta: 'AddToCart' },
    begin_checkout:   { ga: 'begin_checkout',   meta: 'InitiateCheckout' },
    add_payment_info: { ga: 'add_payment_info', meta: 'AddPaymentInfo' },
    purchase:         { ga: 'purchase',         meta: 'Purchase' },
    lead:             { ga: 'generate_lead',    meta: 'Lead' },
    whatsapp_click:   { ga: 'whatsapp_click',   meta: 'Contact', custom: true },
    phone_click:      { ga: 'phone_click',      meta: 'Contact', custom: true },
    directions_click: { ga: 'directions_click', meta: 'FindLocation' }
  };

  // track('purchase', { value, currency, transaction_id, items:[{item_id,item_name,price,quantity,item_category}] })
  function track(name, p) {
    p = p || {};
    if (C.MOCK && window.console) console.debug('[track]', name, p);
    if (!loaded) return;
    var m = MAP[name]; if (!m) return;
    if (window.gtag) window.gtag('event', m.ga, p);
    if (window.fbq) {
      var meta = { currency: p.currency, value: p.value };
      if (p.items) {
        meta.content_ids = p.items.map(function (i) { return i.item_id; });
        meta.content_type = 'product';
        meta.num_items = p.items.reduce(function (s, i) { return s + i.quantity; }, 0);
      }
      window.fbq('track', m.meta, meta);
    }
  }
  window.MedipaTrack = track;

  // Cliques de contato (delegação)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('wa.me/') > -1) track('whatsapp_click', { link_url: h.split('?')[0] });
    else if (h.indexOf('tel:') === 0) track('phone_click', {});
    else if (a.getAttribute('data-track') === 'directions') track('directions_click', {});
  });

  // Banner de consentimento
  if (!enabled) return;
  var c = getConsent();
  if (c === 'granted') { load(); return; }
  if (c === 'denied') return;
  var bar = document.createElement('div');
  bar.className = 'consent'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', 'Aviso de cookies');
  bar.innerHTML = '<p>Usamos cookies de medição (Google Analytics e Meta) para entender como o site é usado e melhorar o atendimento. Veja a <a href="' + C.PRIVACY_URL + '">Política de Privacidade</a>.</p>' +
    '<div class="consent__b"><button class="btn btn--ghost" type="button" data-c="denied">Recusar</button><button class="btn" type="button" data-c="granted">Aceitar</button></div>';
  document.body.appendChild(bar);
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    var v = b.getAttribute('data-c'); setConsent(v); bar.remove(); if (v === 'granted') load();
  });
})();
