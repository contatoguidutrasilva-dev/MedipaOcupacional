(function () {
  'use strict';

  // Dados extraídos do site atual (medipabrasil.com.br/serv). p = preço em reais; null = sob consulta.
  var CATS = [
    { id: 'clinicos', nome: 'Exames Clínicos', itens: [
      ['Exame Admissional', 65], ['Exame Periódico', 65], ['Exame Demissional', 65],
      ['Mudança de Função e Retorno ao Trabalho', 65], ['ASO – Atestado de Saúde Ocupacional', 65],
      ['Acuidade Visual – Avaliação da Visão', 44], ['Audiometria – Avaliação da Saúde Auditiva', 30],
      ['Audiometria Tonal e Vocal', null]
    ]},
    { id: 'complementares', nome: 'Exames Complementares', itens: [
      ['Dosimetria de Ruído', 350], ['Eletrocardiograma (ECG)', 63], ['Eletroencefalograma (EEG)', 65],
      ['Espirometria', null], ['Exame Parasitológico (EPF)', 48], ['Raio-X da Coluna Cervical', 80],
      ['Raio-X do Tórax', 90], ['Ácido Úrico', 60], ['GAMA GT', 10], ['Glicemia', 10],
      ['Hemograma Completo', 12.5], ['TGO (AST)', 7], ['TGP (ALT)', 12], ['Triglicérides', 10], ['Ureia', 16]
    ]},
    { id: 'agentes', nome: 'Agentes Agressivos', itens: [
      ['Exame Toxicológico para Motoristas', 165], ['Exames para Motoristas – Categorias C, D e E', 850],
      ['Exames para Soldadores TIG/MIG/MAG/Eletrodo', 950], ['Avaliação de Calor', 850],
      ['Avaliação Psicossocial', 66], ['Fumos Metálicos', 850]
    ]},
    { id: 'programas', nome: 'Programas', itens: [
      ['PCMSO – Programa de Controle Médico de Saúde Ocupacional', 650],
      ['PGR – Programa de Gerenciamento de Riscos', 550], ['PGR – NR 22 – Mineração', 3500],
      ['LTCAT – Laudo Técnico das Condições Ambientais do Trabalho', 1500],
      ['PPP – Perfil Profissiográfico Previdenciário', 1518],
      ['A.E.T. Análise Ergonômica do Trabalho – NR 17', 3500]
    ]},
    { id: 'treinamentos', nome: 'Treinamentos', itens: [
      ['NR 5 – CIPA', 3500], ['NR 10 – Serviços com Eletricidade', 1500],
      ['NR 33 – Segurança em Espaços Confinados', 1500], ['NR 35 – Trabalho em Altura', 1500],
      ['Formulários CIPA 2025', 4500]
    ]},
    { id: 'assessoria', nome: 'Assessoria e Perícias', itens: [
      ['Assessoria e Consultoria Anual em SST', 38000], ['Acompanhamento de Perícias', 1530]
    ]}
  ];

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var brl = function (n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // Menu e barra de navegação
  var nav = $('#nav'), menu = $('#menu'), burger = $('#burger');
  function onScroll() { nav.classList.toggle('is-solid', window.scrollY > 40); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  function closeMenu() { menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  // Catálogo de serviços
  var ICONS = { clinicos: 'i-clip', complementares: 'i-flask', agentes: 'i-search', programas: 'i-file', treinamentos: 'i-hat', assessoria: 'i-scale' };
  var EXTS = ['jpg', 'png', 'webp'];
  var cfg = window.MEDIPA_CONFIG;
  var slugify = function (t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  // Catálogo plano usado pelo carrinho. O servidor deve ter a sua própria fonte de preços (ver BACKEND.md).
  window.MEDIPA_CATALOG = [];
  CATS.forEach(function (c) { c.itens.forEach(function (it) {
    if (it[1] !== null && it[1] < cfg.QUOTE_ONLY_ABOVE) window.MEDIPA_CATALOG.push({ id: slugify(it[0]), name: it[0], price: it[1], cat: c.id, catName: c.nome });
  }); });
  var tabs = $('#tabs'), grid = $('#catalog'), empty = $('#empty'), busca = $('#busca');
  var current = 'clinicos', termo = '';

  var slug = function (t) {
    return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };
  // Se a foto não existir, tenta outras extensões e por fim mantém o espaço reservado.
  window.medipaImg = function (img) {
    var n = +img.getAttribute('data-try') || 0;
    if (n < EXTS.length - 1) {
      img.setAttribute('data-try', n + 1);
      img.src = 'img/servicos/' + img.getAttribute('data-slug') + '.' + EXTS[n + 1];
    } else { img.remove(); }
  };

  function renderTabs() {
    var all = [{ id: 'todos', nome: 'Todos' }].concat(CATS);
    tabs.innerHTML = all.map(function (c) {
      return '<button class="tab" role="tab" aria-selected="' + (c.id === current) + '" data-id="' + c.id + '">' + esc(c.nome) + '</button>';
    }).join('');
  }

  function renderGrid() {
    var q = slug(termo).replace(/-/g, ' ');
    var html = '', count = 0, i = 0;
    CATS.forEach(function (cat) {
      if (current !== 'todos' && current !== cat.id) return;
      cat.itens.forEach(function (it) {
        if (q && slug(it[0]).replace(/-/g, ' ').indexOf(q) === -1) return;
        var sl = slug(it[0]), nome = it[0];
        var preco = it[1] === null ? '<span class="consult">Sob consulta</span>' : brl(it[1]);
        var msg = 'Olá, Medipa! Gostaria de um orçamento para: ' + nome + '.';
        var quote = it[1] === null || it[1] >= cfg.QUOTE_ONLY_ABOVE;
        var wa = 'https://wa.me/' + cfg.WHATSAPP + '?text=' + encodeURIComponent(msg);
        var action = quote
          ? '<a class="btn btn--card" target="_blank" rel="noopener" href="' + wa + '"><svg class="ic"><use href="#i-wa"/></svg> Orçamento</a>'
          : '<button class="btn btn--card" type="button" data-add="' + sl + '" data-name="' + esc(nome) + '"><svg class="ic"><use href="#i-cart"/></svg> <span>Adicionar</span></button>' +
            '<a class="pcard__ask" target="_blank" rel="noopener" href="' + wa + '">Tirar dúvidas</a>';
        html += '<article class="pcard" style="--i:' + (i++ % 10) + '">' +
          '<div class="pcard__img"><div class="ph"><svg class="ic"><use href="#' + ICONS[cat.id] + '"/></svg></div>' +
          '<img src="img/servicos/' + sl + '.jpg" data-slug="' + sl + '" alt="' + esc(nome) + '" loading="lazy" onerror="medipaImg(this)"></div>' +
          '<div class="pcard__body"><h3>' + esc(nome) + '</h3><p class="pcard__price">' + preco + '</p>' + action + '</div></article>';
        count++;
      });
    });
    grid.innerHTML = html;
    empty.hidden = count > 0;
  }

  function select(id, scroll) {
    current = id; renderTabs(); renderGrid();
    if (scroll) document.getElementById('servicos').scrollIntoView({ behavior: 'smooth' });
  }
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (b) select(b.getAttribute('data-id'), false);
  });
  busca.addEventListener('input', function () {
    termo = busca.value;
    if (termo && current !== 'todos') { current = 'todos'; renderTabs(); }
    renderGrid();
  });
  $$('[data-filter]').forEach(function (a) {
    a.addEventListener('click', function () { busca.value = ''; termo = ''; select(a.getAttribute('data-filter'), false); });
  });
  renderTabs(); renderGrid();

  // Animações de entrada
  var items = $$('.reveal');
  items.forEach(function (el, i) {
    var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty('--d', Math.min(sib, 5) * 0.08 + 's');
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Formulário → WhatsApp
  var form = $('#form'), err = $('#formErr');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, nome = f.nome.value.trim();
    f.nome.classList.toggle('bad', !nome);
    err.hidden = !!nome;
    if (!nome) { f.nome.focus(); return; }
    var t = 'Olá, Medipa! Meu nome é ' + nome +
      (f.empresa.value.trim() ? ' (empresa: ' + f.empresa.value.trim() + ')' : '') +
      '. Tenho interesse em: ' + f.servico.value + '.' +
      (f.msg.value.trim() ? '\n\n' + f.msg.value.trim() : '');
    if (window.MedipaTrack) window.MedipaTrack('lead', { form: 'contato', service: f.servico.value });
    window.open('https://wa.me/553136173970?text=' + encodeURIComponent(t), '_blank', 'noopener');
  });

  // Mapa e Street View da entrada: só carregam quando a seção está perto de aparecer
  var loc = window.MEDIPA_CONFIG && window.MEDIPA_CONFIG.LOCATION, svF = $('#svFrame'), mapF = $('#mapFrame');
  if (loc && svF && mapF) {
    var ll = loc.lat + ',' + loc.lng;
    var dir = $('#dirBtn'); if (dir) dir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + ll;
    var loadMaps = function () {
      svF.src = 'https://maps.google.com/maps?q=&layer=c&cbll=' + ll + '&cbp=12,' + loc.yaw + ',0,' + loc.zoom + ',' + loc.pitch + '&source=embed&output=svembed';
      mapF.src = 'https://www.google.com/maps?q=' + ll + '&z=17&output=embed';
    };
    if ('IntersectionObserver' in window) {
      var mo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { loadMaps(); mo.disconnect(); } }, { rootMargin: '600px 0px' });
      mo.observe($('#localizacao'));
    } else loadMaps();
  }

  // Horário de atendimento (vem de config.js; sem dados, mostra aviso em vez de inventar)
  var hoursEl = $('#hours');
  if (hoursEl) {
    var H = (window.MEDIPA_CONFIG && window.MEDIPA_CONFIG.HOURS) || [];
    hoursEl.innerHTML = H.length
      ? H.map(function (r) { return '<div class="hours__r"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('')
      : '<p class="hours__none">Para confirmar os horários de atendimento, fale com a nossa equipe pelo WhatsApp ou pelo telefone (31) 3617-3970.</p>';
  }

  // Ano do rodapé
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
