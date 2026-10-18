/* FPC estimate form: validation, CRM payload, and every state visible.
   No silent failures: inline errors + error summary, a failure banner that keeps every
   typed answer, and a success panel with a reference number. Loaded with defer.

   CRM contract (fpc-construction-crm src/lib/leads/public-lead.ts, origin/main 0518fdb):
   accepted keys are first_name, last_name, email, phone, project_type, notes,
   language_preference, service_area, company_website (honeypot). Unknown keys are dropped
   WITHOUT an error, so address and best time are folded into `notes` until the CRM stores
   them. A lead counts as captured only on a 2xx whose JSON has success === true and a
   non-empty booking_id string (same rule as capturedLeadBody() on the server).

   Answers survive the EN/ES toggle: a per-tab draft (sessionStorage) is saved when the page
   is left and restored on the twin page, then cleared once a request is captured. While a
   request is sending, every field is locked and a language switch waits for the result. */
(function () {
  'use strict';
  var TIMEOUT_MS = 15000;
  var form = document.getElementById('estimate-form');
  if (!form) return;
  var MSG = {};
  try { MSG = JSON.parse(document.getElementById('form-msgs').textContent); } catch (e) {}
  var t = function (k) { return MSG[k] || k; };
  var lang = document.documentElement.lang === 'es' ? 'es' : 'en';
  var region = document.getElementById('region');
  var summary = document.getElementById('summary');
  var failure = document.getElementById('failure');
  var submit = document.getElementById('submit');
  var submitLabel = document.getElementById('submit-label');
  var attempted = false;
  var busy = false;
  var errorKey = {};
  var failedShown = false;   // the failure banner is up (carried over by the draft)
  var sentDone = false;      // a request was captured: nothing more to save
  var langTouched = false;   // the visitor picked a preferred language themselves
  var pendingLeave = null;   // language switch held until the send settles
  var DRAFT = 'fpc-estimate-draft';
  var DONE = 'fpc-estimate-done';
  var FIELDS = ['first_name', 'last_name', 'phone', 'email', 'address', 'details'];
  var CHOICES = ['best_time', 'project_type', 'language_preference'];

  // Endpoint: data attribute set by the build; window.FPC_LEAD_URL can override (tests).
  function endpoint() {
    if (typeof window.FPC_LEAD_URL === 'string') return window.FPC_LEAD_URL;
    return form.getAttribute('data-endpoint') || '';
  }

  // Preselect the job type from ?type= (links from the home page trade list)
  var qType = new URLSearchParams(location.search).get('type');
  if (qType) {
    form.querySelectorAll('input[name="project_type"]').forEach(function (r) { if (r.value === qType) r.checked = true; });
  }

  function digits(s) { return (s || '').replace(/\D/g, ''); }
  function phoneOk(s) { var d = digits(s); return d.length === 10 || (d.length === 11 && d.charAt(0) === '1'); }
  function emailOk(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }

  var rules = {
    first_name: function (v) { return v.trim() ? '' : 'err.first'; },
    last_name: function (v) { return v.trim() ? '' : 'err.last'; },
    phone: function (v) { if (!v.trim()) return 'err.phone.req'; return phoneOk(v) ? '' : 'err.phone.bad'; },
    email: function (v) { if (!v.trim()) return ''; return emailOk(v.trim()) ? '' : 'err.email'; }
  };

  function setError(id, key) {
    var input = document.getElementById(id);
    var slot = document.getElementById(id + '-err');
    errorKey[id] = key || '';
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
    slot.classList.toggle('has', !!key);
    slot.querySelector('.err__msg').textContent = key ? t(key) : '';
  }
  function check(id) { var k = rules[id](document.getElementById(id).value); setError(id, k); return !k; }

  Object.keys(rules).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () { if (el.value || attempted) check(id); });
    el.addEventListener('input', function () { if (errorKey[id] || attempted) check(id); });
  });

  // US phone mask, same behaviour as the previous live form
  document.getElementById('phone').addEventListener('input', function (e) {
    var d = digits(e.target.value);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    d = d.slice(0, 10);
    var out = d;
    if (d.length > 6) out = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    else if (d.length > 3) out = '(' + d.slice(0, 3) + ') ' + d.slice(3);
    else if (d.length > 0) out = '(' + d;
    e.target.value = out;
  });

  // ----- Error summary + failure banner (built with DOM nodes; messages are our own copy) -----
  function banner(el, kind) {
    el.className = 'banner banner--' + kind;
    el.setAttribute('role', 'alert');
    el.innerHTML = '';
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-alert');
    icon.appendChild(use);
    var body = document.createElement('div');
    el.appendChild(icon); el.appendChild(body);
    return body;
  }
  function showSummary(ids, quiet) {
    if (!ids.length) { summary.hidden = true; summary.innerHTML = ''; summary.removeAttribute('role'); return; }
    var body = banner(summary, 'error');
    var h = document.createElement('h2'); h.textContent = t('sum.h'); body.appendChild(h);
    var ul = document.createElement('ul');
    ids.forEach(function (id) {
      var li = document.createElement('li'); var a = document.createElement('a');
      a.href = '#' + id; a.textContent = t(errorKey[id]); li.appendChild(a); ul.appendChild(li);
    });
    body.appendChild(ul);
    summary.hidden = false;
    if (!quiet) summary.focus();
  }
  summary.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a) return;
    e.preventDefault();
    var el = document.getElementById(a.getAttribute('href').slice(1)); if (el) el.focus();
  });
  function showFailure(quiet) {
    failedShown = true;
    var body = banner(failure, 'error');
    var h = document.createElement('h2'); h.textContent = t('fail.h'); body.appendChild(h);
    var p = document.createElement('p'); p.innerHTML = t('fail.p'); body.appendChild(p);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn--line'; b.setAttribute('data-retry', '');
    b.innerHTML = '<span></span><span class="btn__nub" aria-hidden="true"><svg><use href="#i-chev"/></svg></span>';
    b.firstChild.textContent = t('fail.retry');
    body.appendChild(b);
    failure.hidden = false;
    if (!quiet) failure.focus();
  }
  function hideFailure() { failedShown = false; failure.hidden = true; failure.innerHTML = ''; failure.removeAttribute('role'); }
  failure.addEventListener('click', function (e) {
    if (e.target.closest('[data-retry]')) { if (form.requestSubmit) form.requestSubmit(); else submit.click(); }
  });

  // ----- Payload: today's CRM contract; new fields fold into notes so nothing is dropped -----
  function val(name) {
    var el = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('[name="' + name + '"]:not([type="radio"])');
    return el ? el.value.trim() : '';
  }
  var BEST = { morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', any: 'Any time' };
  var LANG_NAME = { en: 'English', es: 'Spanish' };
  function buildPayload() {
    var language = val('language_preference') === 'es' ? 'es' : (val('language_preference') === 'en' ? 'en' : lang);
    var lines = [];
    var details = val('details'); if (details) lines.push(details);
    var addr = val('address'); if (addr) lines.push('Property address: ' + addr);
    var best = val('best_time'); if (best) lines.push('Best time to call: ' + (BEST[best] || best));
    // The CRM stores language_preference in bookings.language, but its new-lead email does
    // not show it, so it is repeated here for Filemon.
    lines.push('Preferred language: ' + LANG_NAME[language]);
    lines.push('Sent from: ' + location.pathname + ' (' + LANG_NAME[lang] + ' page)');
    return {
      first_name: val('first_name'),
      last_name: val('last_name'),
      phone: digits(val('phone')).replace(/^1(?=\d{10}$)/, ''),
      email: val('email'),
      project_type: val('project_type'),
      notes: lines.join('\n'),
      language_preference: language,
      service_area: 'Website Contact Form',
      company_website: document.getElementById('company_website').value
    };
  }

  // ----- Transport: one deadline covers the request AND reading its JSON body -----
  function send(payload) {
    return new Promise(function (resolve, reject) {
      var url = endpoint();
      if (!url) { reject(new Error('lead endpoint not configured')); return; }
      var done = false;
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (done) return; done = true;
        if (ctrl) ctrl.abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      function finish(fn, v) { if (done) return; done = true; clearTimeout(timer); fn(v); }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      }).then(function (body) { finish(resolve, body); }, function (err) { finish(reject, err); });
    });
  }
  function captured(receipt) {
    return !!receipt && typeof receipt === 'object' && receipt.success === true &&
      typeof receipt.booking_id === 'string' && receipt.booking_id.trim().length > 0;
  }

  // Sending locks every field (disabled fieldsets), so what was sent is what the visitor sees.
  function setBusy(on) {
    busy = on;
    submit.setAttribute('aria-busy', String(on));
    submit.disabled = on;
    submitLabel.textContent = on ? t('e.sending') : t('e.submit');
    form.querySelectorAll('fieldset').forEach(function (f) { f.disabled = on; });
  }

  // ----- What was sent, for the success panel (raw values; labels come from this page) -----
  function snapshot(payload) {
    return {
      first_name: payload.first_name, last_name: payload.last_name, phone: payload.phone, email: payload.email,
      address: val('address'), project_type: payload.project_type, best_time: val('best_time'),
      language: payload.language_preference, details: val('details')
    };
  }
  function chipText(name, value) {
    var hit = '';
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (r) { if (r.value === value) hit = r.nextElementSibling.textContent; });
    return hit || value || '';
  }
  function phoneText(d) { return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d; }
  function sentList(sent) {
    var rows = [
      ['name', 'ok.s.name', ((sent.first_name || '') + ' ' + (sent.last_name || '')).trim()],
      ['phone', 'ok.s.phone', phoneText(String(sent.phone || ''))],
      ['email', 'ok.s.email', sent.email],
      ['address', 'ok.s.addr', sent.address],
      ['type', 'ok.s.type', sent.project_type ? chipText('project_type', sent.project_type) : ''],
      ['best', 'ok.s.best', chipText('best_time', sent.best_time)],
      ['lang', 'ok.s.lang', chipText('language_preference', sent.language)],
      ['details', 'ok.s.details', sent.details]
    ];
    var frag = document.createDocumentFragment();
    var h = document.createElement('h3'); h.className = 'sent-h'; h.textContent = t('ok.sent'); frag.appendChild(h);
    var dl = document.createElement('dl'); dl.className = 'sent';
    rows.forEach(function (r) {
      if (!r[2]) return;
      var row = document.createElement('div'); row.setAttribute('data-k', r[0]);
      var dt = document.createElement('dt'); dt.textContent = t(r[1]);
      var dd = document.createElement('dd'); dd.textContent = String(r[2]);
      row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
    });
    frag.appendChild(dl);
    return frag;
  }

  function showSuccess(ref, sent, instant) {
    var reduce = instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    region.style.minHeight = Math.min(region.offsetHeight, 560) + 'px';
    form.classList.add('form-out');
    setTimeout(function () {
      var box = document.createElement('div');
      box.className = 'success';
      box.setAttribute('role', 'status');
      box.innerHTML = '<div class="success__mark" aria-hidden="true"><svg><use href="#i-check"/></svg></div>' +
        '<h2 class="h2" tabindex="-1" id="ok-h"></h2><p class="lead" id="ok-p"></p>' +
        '<p class="ref"><span id="ok-ref-l"></span>: <strong class="num" id="ok-ref"></strong></p>' +
        '<p class="muted" id="ok-sooner"></p>' +
        '<a class="btn btn--line" id="ok-home"><span></span><span class="btn__nub" aria-hidden="true"><svg><use href="#i-chev"/></svg></span></a>';
      box.querySelector('#ok-h').textContent = t('ok.h');
      box.querySelector('#ok-p').textContent = t('ok.p');
      box.querySelector('#ok-ref-l').textContent = t('ok.ref');
      box.querySelector('#ok-ref').textContent = ref;
      box.querySelector('.ref').after(sentList(sent));
      box.querySelector('#ok-sooner').innerHTML = t('ok.sooner');
      var home = box.querySelector('#ok-home');
      home.href = form.getAttribute('data-home') || '/';
      home.firstChild.textContent = t('ok.home');
      form.hidden = true;
      region.appendChild(box);
      box.querySelector('#ok-h').focus();
    }, reduce ? 0 : 200);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || sentDone) return;
    attempted = true;
    hideFailure();
    var bad = Object.keys(rules).filter(function (id) { return !check(id); });
    showSummary(bad);
    if (bad.length) return;

    var payload = buildPayload();
    var sent = snapshot(payload);
    setBusy(true);
    send(payload).then(function (receipt) {
      // A 200 alone is not proof of a captured lead (the honeypot ack is a 200 too).
      if (!captured(receipt)) throw new Error('no booking receipt');
      sentDone = true;
      busy = false; // the send is over; fields stay locked and the form is replaced below
      store.drop(DRAFT);
      var ref = 'FPC-' + receipt.booking_id.trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
      // A held language switch goes ahead now; the twin page shows this success once.
      if (pendingLeave && store.put(DONE, { ref: ref, sent: sent })) { location.href = pendingLeave; return; }
      pendingLeave = null;
      showSuccess(ref, sent);
    }).catch(function () {
      setBusy(false);
      showFailure();
      if (pendingLeave) { var href = pendingLeave; pendingLeave = null; saveDraft(); location.href = href; }
    });
  });

  // ----- Draft: survives the EN/ES toggle (and leaving the page), per tab, until captured -----
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    put: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    drop: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  form.querySelectorAll('input[name="language_preference"]').forEach(function (r) {
    r.addEventListener('change', function () { langTouched = true; });
  });
  function saveDraft() {
    // Nothing to keep once captured; while sending the outcome is unknown, so leave it alone.
    if (sentDone || busy) return;
    var d = { v: 1, f: {}, r: {}, attempted: attempted, failed: failedShown };
    var typed = false;
    FIELDS.forEach(function (id) { d.f[id] = document.getElementById(id).value; if (d.f[id]) typed = true; });
    CHOICES.forEach(function (n) {
      if (n === 'language_preference' && !langTouched) return; // untouched: the twin page's default applies
      var c = form.querySelector('input[name="' + n + '"]:checked');
      if (c) d.r[n] = c.value;
    });
    var picked = d.r.best_time !== 'any' || !!d.r.language_preference || (!!d.r.project_type && d.r.project_type !== qType);
    if (typed || picked || attempted || failedShown) store.put(DRAFT, d); else store.drop(DRAFT);
  }
  function restore() {
    var done = store.get(DONE);
    store.drop(DONE);
    if (done && typeof done.ref === 'string' && done.sent && typeof done.sent === 'object') {
      sentDone = true;
      store.drop(DRAFT);
      showSuccess(done.ref, done.sent, true);
      return;
    }
    var d = store.get(DRAFT);
    if (!d || d.v !== 1 || typeof d.f !== 'object' || typeof d.r !== 'object' || !d.f || !d.r) return;
    FIELDS.forEach(function (id) { if (typeof d.f[id] === 'string') document.getElementById(id).value = d.f[id]; });
    CHOICES.forEach(function (n) {
      if (typeof d.r[n] !== 'string') return;
      form.querySelectorAll('input[name="' + n + '"]').forEach(function (r) { if (r.value === d.r[n]) r.checked = true; });
      if (n === 'language_preference') langTouched = true;
    });
    if (d.attempted) {
      attempted = true;
      showSummary(Object.keys(rules).filter(function (id) { return !check(id); }), true);
    }
    if (d.failed) showFailure(true);
  }
  // The toggle asks first (assets/site/core.js): save now, or hold the switch while sending.
  document.addEventListener('fpc:lang-leave', function (e) {
    if (busy) { e.preventDefault(); pendingLeave = (e.detail && e.detail.href) || null; return; }
    saveDraft();
  });
  window.addEventListener('pagehide', saveDraft);
  restore();
})();
