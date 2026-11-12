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

  // ---------- Language switch: a link to the twin page; the choice is remembered ----------
  // Every a[data-lang] goes through here (header toggle and the "¿Prefiere español?" hint), so
  // no language link can leave the page without asking the page scripts first.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-lang]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var to = a.getAttribute('data-lang');
    store(to);
    if (to === lang) { e.preventDefault(); return; }
    e.preventDefault();
    var href = a.pathname + location.search + location.hash;
    // Page scripts get a say before the page is left: the estimate form saves its draft here,
    // and holds the switch (preventDefault) while a request is sending, then navigates itself.
    var leave = new CustomEvent('fpc:lang-leave', { cancelable: true, detail: { href: href, to: to } });
    if (!document.dispatchEvent(leave)) return;
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
    // data-lang: handled by the language switch above (remembers Spanish, waits for a send).
    link.setAttribute('data-lang', 'es');
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
      document.documentElement.classList.toggle('jj-bar-shown', past);
      refreshJJ();
    }).observe(sentinel);
  }

  // ---------- PayPal Pay Later message: load the SDK only when the payment answer opens ----------
  // Only pages that carry the message slot load the SDK (English pages today; see build.mjs).
  var pp = document.querySelector('details[data-paypal]');
  if (pp && pp.querySelector('[data-pp-message]')) {
    pp.addEventListener('toggle', function once() {
      if (!pp.open) return;
      pp.removeEventListener('toggle', once);
      // FPC CONSTRUCTION account, "FPC CRM" app. The client id is public by design.
      // components=messages only; if a checkout button is ever added, extend this one tag.
      // Locale follows the page, not the browser: es_US on /es/, en_US elsewhere. It goes on
      // the SDK URL and on the message itself (data-pp-locale), which PayPal reads separately.
      var ppLocale = lang === 'es' ? 'es_US' : 'en_US';
      pp.querySelectorAll('[data-pp-message]').forEach(function (m) { m.setAttribute('data-pp-locale', ppLocale); });
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=BAAR3Vl31fha6z66-3iPRDebA0XeLs0NZ5mWddS4yqkaHwtCmwyi3bCPIy306QQIcDbHzyYe89p0KN8F2c&components=messages&locale=' + ppLocale;
      s.setAttribute('data-namespace', 'PayPalSDK');
      s.async = true;
      document.head.appendChild(s);
    });
  }

  // ---------- JJ voice agent (ElevenLabs, ~600 KB): injected after the first interaction ----------
  var mobileJJ = window.matchMedia('(max-width: 899px)');
  var refreshJJ = function () {};

  // Adapt only the known, accessible launcher in the CDN's open shadow root.
  // A selector miss restores the vendor default, never an invisible front door.
  function adaptJJ(el, label) {
    var root = el.shadowRoot;
    if (!root) return;
    var launcher = null, queued = false, submitVisible = false;
    var style = document.createElement('style');
    style.textContent = '@media(max-width:899px){.fpc-jj-launcher{width:48px!important;height:48px!important;min-height:48px!important;max-width:48px!important;border-radius:50%!important;padding:0!important;position:relative}.fpc-jj-launcher>slot{margin:0!important;font-size:20px}.fpc-jj-launcher>div{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;overflow:hidden!important;clip-path:inset(50%);white-space:nowrap}}@media(prefers-reduced-motion:reduce){.fpc-jj-launcher{transition:none!important}}';
    root.appendChild(style);
    function clearSuppression() {
      el.classList.remove('jj-suppressed');
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
    function intersects(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function protectedIntersection(box) {
      var forms = document.querySelectorAll('main form');
      for (var f = 0; f < forms.length; f++) {
        if (!intersects(box, forms[f].getBoundingClientRect())) continue;
        var controls = forms[f].querySelectorAll('input:not([type="hidden"]), select, textarea, button');
        for (var i = 0; i < controls.length; i++) {
          if (controls[i].getClientRects().length && intersects(box, controls[i].getBoundingClientRect())) return true;
        }
        // Text ranges exclude the empty right-hand lane reserved in the starter.
        var walker = document.createTreeWalker(forms[f], NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          var text = walker.currentNode;
          if (!text.textContent.trim() || text.parentElement.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
          var range = document.createRange(); range.selectNodeContents(text);
          var rects = range.getClientRects();
          for (var r = 0; r < rects.length; r++) if (intersects(box, rects[r])) return true;
        }
      }
      return false;
    }
    function sync() {
      queued = false;
      if (!launcher || !root.contains(launcher)) { clearSuppression(); return; }
      var mobile = mobileJJ.matches;
      var title = mobile ? 'Chat with JJ' : label;
      if (launcher.getAttribute('title') !== title) launcher.setAttribute('title', title);
      if (mobile) { launcher.setAttribute('aria-label', 'Chat with JJ'); launcher.setAttribute('lang', 'en'); }
      else { launcher.removeAttribute('aria-label'); launcher.removeAttribute('lang'); }
      // Leave an intentionally opened panel and its call controls available.
      var panel = launcher.nextElementSibling;
      var expanded = panel && parseFloat(getComputedStyle(panel).opacity) > 0;
      var focused = document.activeElement && document.activeElement.matches('input, select, textarea');
      var box = launcher.getBoundingClientRect();
      // Predict the resting position while the host is fading, avoiding edge oscillation.
      var transform = getComputedStyle(el).transform;
      var dy = transform === 'none' ? 0 : new DOMMatrix(transform).m42;
      var resting = {left:box.left, right:box.right, top:box.top - dy, bottom:box.bottom - dy};
      var hide = mobile && !expanded && (focused || submitVisible || protectedIntersection(resting));
      el.classList.toggle('jj-suppressed', !!hide);
      el.toggleAttribute('inert', !!hide);
      if (hide) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
    function bind() {
      var buttons = root.querySelectorAll('button'); launcher = null;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].getAttribute('title') === label || buttons[i].classList.contains('fpc-jj-launcher')) { launcher = buttons[i]; break; }
      }
      el.classList.toggle('jj-adapted', !!launcher);
      if (!launcher) { clearSuppression(); return; }
      if (!launcher.classList.contains('fpc-jj-launcher')) launcher.classList.add('fpc-jj-launcher');
      queue();
    }
    new MutationObserver(bind).observe(root, {childList:true, subtree:true, attributes:true, attributeFilter:['title', 'class']});
    var submit = document.querySelector('#estimate-form #submit');
    if (submit && 'IntersectionObserver' in window) new IntersectionObserver(function (entries) {
      submitVisible = entries[0].isIntersecting; queue();
    }).observe(submit);
    document.addEventListener('focusin', queue, true);
    document.addEventListener('focusout', queue, true);
    window.addEventListener('scroll', queue, {passive:true});
    window.addEventListener('resize', queue, {passive:true});
    if (window.visualViewport) window.visualViewport.addEventListener('resize', queue, {passive:true});
    if ('ResizeObserver' in window) new ResizeObserver(queue).observe(document.querySelector('main') || document.body);
    if (document.fonts) document.fonts.ready.then(queue);
    refreshJJ = queue; bind();
  }
  var filLoaded = false;
  function loadFil() {
    if (filLoaded) return;
    filLoaded = true;
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.removeEventListener(ev, loadFil, true); });
    var el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', 'agent_5901m5pm1yqefbmafzk9qhw20hrc');
    // Language follows the page. The widget always sends agent.language at call start
    // (default "en"); the agent's published config lists "en" and "es" as supported language
    // overrides with an "es" preset, so "es" is an allowed value. override-language (rather
    // than language) also hides the vendor's language picker, whose labels are English-only
    // ("Spanish"); visitors switch language with the page toggle instead.
    el.setAttribute('override-language', lang);
    // Every visible control string, in the page language (the widget's documented *-text attributes).
    var FIL_TEXT = {
      en: { 'expand-text': 'Chat with JJ', 'action-text': 'Questions? Ask JJ', 'start-call-text': 'Start a call', 'end-call-text': 'End call', 'listening-text': 'Listening', 'speaking-text': 'Talk to interrupt' },
      es: { 'expand-text': 'Hablar con JJ', 'action-text': '¿Preguntas? Pregúntele a JJ', 'start-call-text': 'Iniciar llamada', 'end-call-text': 'Colgar', 'listening-text': 'Escuchando', 'speaking-text': 'Hable para interrumpir' }
    }[lang];
    Object.keys(FIL_TEXT).forEach(function (k) { el.setAttribute(k, FIL_TEXT[k]); });
    // Orb in FPC red and yellow instead of the vendor blue/green. Button and panel colors are
    // set in base.css through the widget's --el-* variables (white on ink, 15:1).
    el.setAttribute('avatar-orb-color-1', '#ED000C');
    el.setAttribute('avatar-orb-color-2', '#F4B80C');
    document.body.appendChild(el);
    var s = document.createElement('script');
    s.src = 'https://elevenlabs.io/convai-widget/index.js';
    s.async = true;
    s.addEventListener('load', function () {
      if (window.customElements) customElements.whenDefined('elevenlabs-convai').then(function () { adaptJJ(el, FIL_TEXT['expand-text']); });
    });
    document.body.appendChild(s);
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, loadFil, { capture: true, passive: true }); });
  // Phone visitors see JJ without needing a scroll or tap. Desktop keeps lazy loading.
  if (mobileJJ.matches) loadFil();

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
