/* Base compartilhada dos joguinhos. Sem dependências; sintaxe conservadora para navegador de TV. */
var JG = (function () {
  'use strict';
  var app, acts = {}, backFn = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(a, r) {
    r = r || Math.random; a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(a, r) { return a[Math.floor((r || Math.random)() * a.length)]; }
  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0; var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function store(k, v) {
    try {
      if (v === undefined) { var s = localStorage.getItem(k); return s ? JSON.parse(s) : null; }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    return v === undefined ? null : v;
  }

  /* Troca a tela. `handlers` mapeia data-act -> função(elemento). */
  function view(html, handlers, opts) {
    app = app || document.getElementById('app');
    acts = handlers || {};
    backFn = (opts && opts.back) || null;
    app.innerHTML = '<section class="screen' + (opts && opts.wide ? ' wide' : '') + '">' + html + '</section>';
    window.scrollTo(0, 0);
    if (document.body.className.indexOf('keys') >= 0) {
      var f = app.querySelector('.btn.primary') || app.querySelector('button');
      if (f) f.focus();
    }
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (el && acts[el.getAttribute('data-act')]) { acts[el.getAttribute('data-act')](el, e); }
    wake();
  });

  function names() { var n = store('jg_names'); return n && n[0] && n[1] ? n : null; }
  function needNames(done, force) {
    var n = names();
    if (n && !force) { done(n); return; }
    n = n || ['', ''];
    view('<p class="kick">Antes de começar</p><h2>Quem joga?</h2>' +
      '<input class="input" id="n0" maxlength="14" placeholder="Nome" autocomplete="off" value="' + esc(n[0]) + '">' +
      '<input class="input" id="n1" maxlength="14" placeholder="Nome" autocomplete="off" value="' + esc(n[1]) + '">' +
      '<button class="btn primary" data-act="ok">Pronto</button>' +
      '<p class="mut small">Os nomes ficam só neste aparelho.</p>', {
      ok: function () {
        var a = document.getElementById('n0').value.trim(), b = document.getElementById('n1').value.trim();
        if (!a || !b) return;
        store('jg_names', [a, b]); done([a, b]);
      }
    });
  }

  /* Tela "passa o aparelho": esconde o que vem a seguir até a pessoa certa confirmar. */
  function pass(to, other, then, note) {
    view('<p class="kick">Passa o aparelho</p><h2>Agora é com <span class="acc">' + esc(to) + '</span></h2>' +
      '<p class="mut">' + (note || esc(other) + ' olha para o outro lado.') + '</p>' +
      '<button class="btn primary" data-act="go">Sou ' + esc(to) + ', pode mostrar</button>', { go: then });
  }

  /* Navegação por setas (controle remoto, teclado) e por gamepad (DualShock etc.). */
  function focusables() {
    return [].slice.call(document.querySelectorAll('a[href],button:not([disabled]),input,select')).filter(function (e) {
      return e.offsetParent !== null;
    });
  }
  function move(dir) {
    document.body.classList.add('keys');
    var els = focusables(), cur = document.activeElement;
    if (els.indexOf(cur) < 0) { if (els[0]) els[0].focus(); return; }
    var r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, best = null, bs = 1e9;
    els.forEach(function (e) {
      if (e === cur) return;
      var q = e.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      var main = dir === 'l' ? -dx : dir === 'r' ? dx : dir === 'u' ? -dy : dy;
      var cross = (dir === 'l' || dir === 'r') ? Math.abs(dy) : Math.abs(dx);
      if (main <= 4) return;
      var s = main + cross * 2.5;
      if (s < bs) { bs = s; best = e; }
    });
    if (best) { best.focus(); if (best.scrollIntoView) best.scrollIntoView({ block: 'nearest' }); }
  }
  function goBack() { if (backFn) backFn(); else { var b = document.querySelector('.top a'); if (b) b.click(); } }
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, t = e.target, typing = t && t.tagName === 'INPUT' && t.type !== 'range';
    if (k === 13 && typing) { var p = app && app.querySelector('.btn.primary'); if (p) { t.blur(); p.click(); } return; }
    if (typing && (k === 37 || k === 39)) return;
    var d = k === 37 ? 'l' : k === 38 ? 'u' : k === 39 ? 'r' : k === 40 ? 'd' : null;
    if (d) { e.preventDefault(); move(d); }
    else if (k === 461 || k === 10009 || (k === 27)) { e.preventDefault(); goBack(); } /* voltar: LG, Samsung, Esc */
  });
  var held = {}, padOn = false;
  function edge(name, down) { var was = held[name]; held[name] = down; return down && !was; }
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], p = null, i;
    for (i = 0; i < pads.length; i++) if (pads[i]) { p = pads[i]; break; }
    if (p) {
      var b = function (n) { return !!(p.buttons[n] && p.buttons[n].pressed); }, ax = p.axes || [];
      if (edge('u', b(12) || ax[1] < -0.6)) move('u');
      if (edge('d', b(13) || ax[1] > 0.6)) move('d');
      if (edge('l', b(14) || ax[0] < -0.6)) move('l');
      if (edge('r', b(15) || ax[0] > 0.6)) move('r');
      if (edge('a', b(0))) { var a = document.activeElement; if (a && a !== document.body) a.click(); else move('d'); }
      if (edge('b', b(1))) goBack();
    }
    if (padOn) (window.requestAnimationFrame || setTimeout)(poll, 50);
  }
  window.addEventListener('gamepadconnected', function () { if (!padOn) { padOn = true; poll(); } });

  /* Mantém a tela acesa durante o jogo, quando o navegador permite. */
  var lock = null;
  function wake() {
    if (lock || !navigator.wakeLock) return;
    try { navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }, function () {}); } catch (e) {}
  }

  return { esc: esc, shuffle: shuffle, pick: pick, rng: rng, store: store, view: view, names: names, needNames: needNames, pass: pass };
})();
