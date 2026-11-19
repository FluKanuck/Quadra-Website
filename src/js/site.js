// Quadra Utility Locating. Loaded with `defer` on every page. No dependencies.
(() => {
  'use strict';
  const doc = document;
  const root = doc.documentElement;

  /* ---------------------------------------------------------------
     1. Primary navigation
     The link list is a popover while collapsed. When the whole row
     fits, the header gets .is-wide and the list sits inline.
     No fixed breakpoint: the row is measured.
  --------------------------------------------------------------- */
  const header = doc.querySelector('.site-header');
  const inner = header?.querySelector('.header-inner');
  const menu = doc.getElementById('site-menu');
  const menuButton = header?.querySelector('.menu-button');
  const hasPopover = Object.hasOwn(HTMLElement.prototype, 'popover');

  if (header && inner && menu && menuButton) {
    let lastWidth = 0;
    const layoutNav = () => {
      const width = header.clientWidth;
      const isWide = header.classList.contains('is-wide');
      // While collapsed, only re-measure when the header has grown.
      if (!isWide && lastWidth && width <= lastWidth) { lastWidth = width; return; }
      lastWidth = width;
      const wasOpen = !isWide && hasPopover && menu.matches(':popover-open');
      header.classList.add('is-measuring', 'is-wide');
      menu.removeAttribute('popover');
      menu.hidden = false;
      const fits = inner.scrollWidth <= inner.clientWidth;
      header.classList.toggle('is-wide', fits);
      if (!fits) {
        if (hasPopover) {
          menu.setAttribute('popover', 'auto');
          if (wasOpen) menu.showPopover();
        } else {
          menu.hidden = menuButton.getAttribute('aria-expanded') !== 'true';
        }
      }
      requestAnimationFrame(() => header.classList.remove('is-measuring'));
    };

    if (!hasPopover) {
      // Older browsers: a plain disclosure instead of a popover.
      header.classList.add('no-popover');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.addEventListener('click', () => {
        const open = menuButton.getAttribute('aria-expanded') !== 'true';
        menuButton.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
      });
    }
    const ro = new ResizeObserver(layoutNav);
    ro.observe(header);
    ro.observe(menu);
    layoutNav();
  }

  /* ---------------------------------------------------------------
     2. Lead source and quote reference
     Same logic the Squarespace site used. The lead source (not
     personal data) is remembered for 30 days in this browser.
  --------------------------------------------------------------- */
  const KEY = 'quadraLeadSource';
  const MAX_AGE = 30 * 24 * 3600 * 1000;
  let saved = null;
  try {
    const p = new URLSearchParams(location.search);
    let host = '';
    try { host = doc.referrer ? new URL(doc.referrer).hostname.replace(/^www\./, '') : ''; } catch { /* ignore */ }
    let src = null;
    if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) {
      src = 'Google Ads';
    } else if (p.get('utm_source')) {
      src = [p.get('utm_source'), p.get('utm_medium'), p.get('utm_campaign')].filter(Boolean).join(' / ');
    } else if (host && !host.includes('quadralocating.com')) {
      if (/(^|\.)google\./.test(host)) src = 'Google search (organic)';
      else if (/(^|\.)bing\.com$/.test(host)) src = 'Bing search (organic)';
      else if (/yahoo|duckduckgo|ecosia/.test(host)) src = `${host} (organic)`;
      else src = `Referral: ${host}`;
    }
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
    if (saved && Date.now() - saved.t > MAX_AGE) saved = null;
    if (src) {
      saved = { s: src, l: location.pathname, t: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  const pad = (n) => String(n).padStart(2, '0');
  const newReference = () => {
    const d = new Date();
    return `Q-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  /* ---------------------------------------------------------------
     3. Forms
  --------------------------------------------------------------- */
  const forms = [...doc.querySelectorAll('form[data-form]')];
  for (const form of forms) {
    const set = (name, value) => { const el = form.elements.namedItem(name); if (el) el.value = value; };
    const reference = newReference();
    set('quote_reference', reference);
    set('lead_source', saved ? saved.s : 'Direct or unknown');
    set('landing_page', saved ? saved.l : location.pathname);

    // A checkbox group that needs at least one box ticked.
    const group = form.querySelector('fieldset[data-require-one]');
    const boxes = group ? [...group.querySelectorAll('input[type="checkbox"]')] : [];
    const checkGroup = () => {
      if (!boxes.length) return;
      const ok = boxes.some((b) => b.checked);
      boxes[0].setCustomValidity(ok ? '' : 'Select at least one service.');
    };
    boxes.forEach((b) => b.addEventListener('change', checkGroup));
    checkGroup();

    form.addEventListener('submit', (event) => {
      checkGroup();
      if (!form.checkValidity()) return; // the browser shows and focuses the first error
      try { sessionStorage.setItem('quadraQuoteRef', reference); } catch { /* ignore */ }
      const button = form.querySelector('button[type="submit"]');
      if (form.hasAttribute('data-demo')) {
        // No form backend is configured yet (src/site.json "formEndpoint").
        // Nothing is sent. Go to the thank-you page so the flow can be reviewed.
        event.preventDefault();
        location.assign(form.dataset.next);
        return;
      }
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    });
  }

  // Thank-you page: show the reference from the form just sent.
  const refLine = doc.getElementById('quote-ref');
  if (refLine) {
    let ref = null;
    try { ref = sessionStorage.getItem('quadraQuoteRef'); } catch { /* ignore */ }
    if (ref) { refLine.querySelector('strong').textContent = ref; refLine.hidden = false; }
  }

  /* ---------------------------------------------------------------
     4. Validation: keep ARIA in step with :user-invalid
     From the Modern Web Guidance "accessible-error-announcement" guide.
  --------------------------------------------------------------- */
  if (forms.length) {
    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };
    const announcer = doc.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.classList.add('visually-hidden');
    doc.body.append(announcer);
    let announceTimer;
    let announcedField;
    const spokenText = (node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };
    const announceError = (el) => {
      const error = doc.getElementById(el.dataset.error);
      if (!error) return;
      const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
      clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => { announcer.textContent = label + spokenText(error); }, 500);
    };
    const flagged = new WeakSet();
    const announced = new WeakSet();
    const syncAria = (el, announce = false) => {
      if (!el.matches?.('input, select, textarea') || el.type === 'hidden') return;
      const invalid = el.matches(':user-invalid');
      if (invalid) {
        if (announce && !announced.has(el)) { announceError(el); announced.add(el); }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || !el.hasAttribute('aria-invalid')) {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) { clearTimeout(announceTimer); announcer.textContent = ''; }
      }
    };
    doc.querySelectorAll('form[data-form] :is(input, select, textarea)').forEach((el) => syncAria(el));
    doc.addEventListener('blur', (e) => syncAria(e.target, true), true);
    doc.addEventListener('input', (e) => { if (e.target.hasAttribute?.('aria-invalid')) syncAria(e.target); });
    doc.addEventListener('change', (e) => syncAria(e.target, true), true);
    doc.addEventListener('invalid', (e) => { announced.add(e.target); syncAria(e.target); }, true);
    doc.addEventListener('reset', (e) => { setTimeout(() => [...e.target.elements].forEach((el) => syncAria(el))); }, true);
  }

  /* ---------------------------------------------------------------
     5. Google tag (GA4 + Google Ads)
     Loaded here, low priority, so it never blocks rendering.
     Pages with <html data-no-tags> (job applications) skip it.
  --------------------------------------------------------------- */
  const ga4 = root.dataset.ga4;
  const ads = root.dataset.ads;
  if ((ga4 || ads) && !root.hasAttribute('data-no-tags') && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    if (ga4) window.gtag('config', ga4);
    if (ads) window.gtag('config', ads);
    const tag = doc.createElement('script');
    tag.async = true;
    tag.fetchPriority = 'low';
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4 || ads)}`;
    doc.head.append(tag);
  }
})();
