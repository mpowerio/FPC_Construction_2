/* FPC Construction "Bench Cut": shared page behaviour.
   No dependencies, no scroll listeners (IntersectionObserver only). Loaded with defer.
   Source file is served as-is (no build step). */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORE = 'fpc-lang';
  var lang = root.lang === 'es' ? 'es' : 'en';
  function store(v) { try { localStorage.setItem(STORE, v); } catch (e) {} }
  function stored() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }

  // ---------- Language toggle: a link to the twin page; the choice is remembered ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.lang a[data-lang]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var to = a.getAttribute('data-lang');
    store(to);
    if (to === lang) { e.preventDefault(); return; }
    e.preventDefault();
    var href = a.getAttribute('href') + location.search + location.hash;
    if (reduce) { location.href = href; return; }
    document.querySelectorAll('.lang a[data-lang="' + to + '"]').forEach(function (x) { x.classList.add('is-target'); });
    root.classList.add('lang-going');
    setTimeout(function () { location.href = href; }, 180);
  });
  // Coming back via the back/forward cache: undo the in-flight toggle state.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    root.classList.remove('lang-going');
    document.querySelectorAll('.lang a.is-target').forEach(function (x) { x.classList.remove('is-target'); });
  });

  // ---------- "¿Prefiere español?" hint: browser prefers Spanish, nothing chosen yet ----------
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
  var twinEs = document.querySelector('link[hreflang="es-US"]');
  if (lang === 'en' && !stored() && /^es\b/i.test(langs[0] || '') && twinEs) {
    var hint = document.createElement('div');
    hint.className = 'lang-hint';
    hint.setAttribute('role', 'region');
    hint.setAttribute('aria-label', 'Idioma');
    hint.lang = 'es';
    var link = document.createElement('a');
    link.href = new URL(twinEs.href).pathname + location.search + location.hash;
    link.textContent = '¿Prefiere español? Ver esta página en español';
    link.addEventListener('click', function () { store('es'); });
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar / Close');
    close.innerHTML = '<svg aria-hidden="true"><use href="#i-x"/></svg>';
    close.addEventListener('click', function () { store('en'); hint.classList.remove('is-shown'); setTimeout(function () { hint.remove(); }, 450); });
    hint.appendChild(link); hint.appendChild(close);
    document.body.appendChild(hint);
    requestAnimationFrame(function () { requestAnimationFrame(function () { hint.classList.add('is-shown'); }); });
  }

  // ---------- Deferred photos: load 600px before they scroll into view ----------
  var deferred = document.querySelectorAll('picture[data-defer]');
  function loadPicture(pic) {
    pic.querySelectorAll('[data-srcset]').forEach(function (el) { el.setAttribute('srcset', el.getAttribute('data-srcset')); el.removeAttribute('data-srcset'); });
    var img = pic.querySelector('img[data-src]');
    if (img) { img.setAttribute('src', img.getAttribute('data-src')); img.removeAttribute('data-src'); }
  }
  if ('IntersectionObserver' in window) {
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { loadPicture(en.target.__pic); dio.unobserve(en.target); } });
    }, { rootMargin: '600px 0px' });
    // A <picture> with display:contents has no box; observe its frame instead.
    deferred.forEach(function (pic) { var box = pic.parentElement; box.__pic = pic; dio.observe(box); });
  } else {
    deferred.forEach(loadPicture);
  }

  // ---------- Quiet reveal (photo groups only) ----------
  var reveal = document.querySelectorAll('[data-reveal]');
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveal.forEach(function (el) { io.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ---------- Call bar (mobile) + island (desktop) once the hero actions leave view ----------
  var sentinel = document.querySelector('[data-bar-sentinel]');
  var bars = document.querySelectorAll('.action-bar, .island');
  if (bars.length) bars.forEach(function (b) { b.setAttribute('inert', ''); });
  if (sentinel && bars.length && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var past = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      bars.forEach(function (b) { b.classList.toggle('is-shown', past); b.toggleAttribute('inert', !past); });
    }).observe(sentinel);
  }

  // ---------- PayPal Pay Later message: load the SDK only when the payment answer opens ----------
  var pp = document.querySelector('details[data-paypal]');
  if (pp) {
    pp.addEventListener('toggle', function once() {
      if (!pp.open) return;
      pp.removeEventListener('toggle', once);
      // FPC CONSTRUCTION account, "FPC CRM" app. The client id is public by design.
      // components=messages only; if a checkout button is ever added, extend this one tag.
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=BAAR3Vl31fha6z66-3iPRDebA0XeLs0NZ5mWddS4yqkaHwtCmwyi3bCPIy306QQIcDbHzyYe89p0KN8F2c&components=messages';
      s.setAttribute('data-namespace', 'PayPalSDK');
      s.async = true;
      document.head.appendChild(s);
    });
  }

  // ---------- Fil voice agent (ElevenLabs, ~600 KB): injected after the first interaction ----------
  var filLoaded = false;
  function loadFil() {
    if (filLoaded) return;
    filLoaded = true;
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, loadFil, true); });
    var el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', 'agent_5801kehtxvkzenwvpc48t3sr5n56');
    // No override-language: the agent detects English/Spanish itself, and an override the
    // agent config does not allow would stop the widget from connecting.
    document.body.appendChild(el);
    var s = document.createElement('script');
    s.src = 'https://elevenlabs.io/convai-widget/index.js';
    s.async = true;
    document.body.appendChild(s);
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, loadFil, { capture: true, passive: true }); });

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
