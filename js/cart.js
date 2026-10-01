// Carrinho: guarda só {id, qty}. Nome e preço vêm do catálogo (window.MEDIPA_CATALOG).
(function () {
  'use strict';
  var KEY = 'medipa_cart';
  var state = [];

  try { state = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { state = []; }

  function find(id) { return (window.MEDIPA_CATALOG || []).filter(function (p) { return p.id === id; })[0]; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
  function clean() { state = state.filter(function (i) { return find(i.id) && i.qty > 0; }); }

  window.MedipaCart = {
    add: function (id) {
      if (!find(id)) return;
      var it = state.filter(function (i) { return i.id === id; })[0];
      if (it) it.qty = Math.min(it.qty + 1, 99); else state.push({ id: id, qty: 1 });
      persist();
    },
    setQty: function (id, qty) {
      state.forEach(function (i) { if (i.id === id) i.qty = Math.max(0, Math.min(99, qty)); });
      clean(); persist();
    },
    remove: function (id) { state = state.filter(function (i) { return i.id !== id; }); persist(); },
    clear: function () { state = []; persist(); },
    items: function () {
      clean();
      return state.map(function (i) { var p = find(i.id); return { id: i.id, qty: i.qty, name: p.name, price: p.price, cat: p.cat, total: p.price * i.qty }; });
    },
    count: function () { return this.items().reduce(function (s, i) { return s + i.qty; }, 0); },
    total: function () { return this.items().reduce(function (s, i) { return s + i.total; }, 0); }
  };
})();
