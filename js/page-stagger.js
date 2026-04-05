(function () {
  'use strict';

  /* Bypass UA respecting prefers-reduced-motion for document scrolling (Chrome/Safari). */
  if (document.documentElement && document.documentElement.style) {
    document.documentElement.style.setProperty('scroll-behavior', 'smooth', 'important');
  }

  function tag(el) {
    return el && el.tagName ? String(el.tagName).toLowerCase() : '';
  }

  function pushVisualColParts(items, visualCol, extraSel) {
    if (!visualCol) return;
    var eyebrow = visualCol.querySelector('.section-eyebrow');
    var title = visualCol.querySelector('.section-title');
    var lede = visualCol.querySelector('.section-lede');
    if (eyebrow) items.push(eyebrow);
    if (title) items.push(title);
    if (lede) items.push(lede);
    if (extraSel) {
      var extra = visualCol.querySelector(extraSel);
      if (extra) items.push(extra);
    }
  }

  function collectItems(el) {
    var items = [];
    var t = tag(el);

    if (t === 'div' && el.classList.contains('landing-hero-block')) {
      var col = el.querySelector('.landing-intro .hero-text-column');
      if (col) {
        var ch = col.children;
        for (var j = 0; j < ch.length; j++) items.push(ch[j]);
      }
      var demo = el.querySelector('.demo-frame');
      if (demo) items.push(demo);
      return items;
    }

    if (t === 'section' && el.classList.contains('workspace-section')) {
      pushVisualColParts(items, el.querySelector('.flow-visual-col'), '.workspace-dot-grid-frame');
      var cards = el.querySelectorAll('.feature-card');
      for (var c = 0; c < cards.length; c++) items.push(cards[c]);
      return items;
    }

    if (t === 'section' && el.classList.contains('flow-section')) {
      pushVisualColParts(items, el.querySelector('.flow-visual-col'), '.flow-placeholder-frame');
      var steps = el.querySelectorAll('.flow-steps li');
      for (var s = 0; s < steps.length; s++) items.push(steps[s]);
      return items;
    }

    if (t === 'section' && el.classList.contains('partners-section')) {
      var intro = el.querySelector('.partners-intro');
      if (intro) {
        var eb = intro.querySelector('.section-eyebrow');
        var ti = intro.querySelector('.section-title');
        if (eb) items.push(eb);
        if (ti) items.push(ti);
      }
      var logos = el.querySelectorAll('.partners-logos li');
      for (var L = 0; L < logos.length; L++) items.push(logos[L]);
      var reviews = el.querySelectorAll('.review-card');
      for (var r = 0; r < reviews.length; r++) items.push(reviews[r]);
      return items;
    }

    if (t === 'section' && el.classList.contains('cta-section')) {
      var kids = el.children;
      for (var k = 0; k < kids.length; k++) items.push(kids[k]);
      return items;
    }

    if (t === 'section' && el.classList.contains('cube-section')) {
      var wrap = el.querySelector('.cube-wrap');
      items.push(wrap || el);
      return items;
    }

    if (t === 'article' && (el.classList.contains('simple-page') || el.classList.contains('simple-page__article'))) {
      var ey = el.querySelector('.section-eyebrow');
      var h = el.querySelector('h1.simple-page__title') || el.querySelector('.simple-page__title') || el.querySelector('h1');
      if (ey) items.push(ey);
      if (h) items.push(h);
      var body = el.querySelector('.simple-page__body');
      if (body) {
        var bc = body.children;
        for (var b = 0; b < bc.length; b++) items.push(bc[b]);
      }
      return items;
    }

    if (t === 'footer' && el.classList.contains('site-footer')) {
      var grid = el.querySelector('.site-footer-grid');
      if (grid) {
        var cols = grid.querySelectorAll('.site-footer-col');
        for (var x = 0; x < cols.length; x++) items.push(cols[x]);
      }
      var copy = el.querySelector('.site-footer-copy');
      if (copy) items.push(copy);
      return items;
    }

    return items;
  }

  function markItems(scope, items) {
    scope.classList.add('stagger-scope');
    for (var i = 0; i < items.length; i++) {
      var node = items[i];
      if (!node) continue;
      node.classList.add('stagger-item');
      node.style.setProperty('--stagger-i', String(i));
    }
  }

  /** Masonry breaks DOM order; stagger reviews top → bottom (smallest Y first). */
  function partnersReviewStaggerBase(scope) {
    var n = 0;
    var intro = scope.querySelector('.partners-intro');
    if (intro) {
      if (intro.querySelector('.section-eyebrow')) n++;
      if (intro.querySelector('.section-title')) n++;
    }
    var logos = scope.querySelectorAll('.partners-logos li');
    n += logos.length;
    return n;
  }

  function applyPartnersReviewStaggerOrder(scope) {
    if (!scope || !scope.classList.contains('partners-section')) return;
    var cards = scope.querySelectorAll('.review-card');
    if (!cards.length) return;
    var arr = Array.prototype.slice.call(cards);
    arr.sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      var d = ra.top - rb.top;
      if (Math.abs(d) > 1) return d;
      return ra.left - rb.left;
    });
    var base = partnersReviewStaggerBase(scope);
    for (var i = 0; i < arr.length; i++) {
      arr[i].style.setProperty('--stagger-i', String(base + i));
    }
  }

  function schedulePartnersReviewStagger(scope) {
    function run() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          applyPartnersReviewStaggerOrder(scope);
        });
      });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  }

  function reveal(scope) {
    if (scope.classList.contains('is-stagger-visible')) return;
    scope.classList.add('is-stagger-visible');
  }

  var SELECTORS = [
    '.landing-hero-block',
    'section.workspace-section',
    'section.flow-section',
    'section.partners-section',
    'section.cta-section',
    'section.cube-section',
    'article.simple-page',
    'footer.site-footer'
  ];

  function run() {
    var all = [];
    for (var s = 0; s < SELECTORS.length; s++) {
      var found = document.querySelectorAll(SELECTORS[s]);
      for (var f = 0; f < found.length; f++) all.push(found[f]);
    }

    var observed = [];
    for (var si = 0; si < all.length; si++) {
      var scope = all[si];
      var list = collectItems(scope);
      if (!list.length) continue;
      markItems(scope, list);
      if (scope.classList.contains('partners-section')) {
        schedulePartnersReviewStagger(scope);
      }
      observed.push(scope);
    }

    if (!observed.length) return;

    var io = new IntersectionObserver(
      function (entries) {
        for (var e = 0; e < entries.length; e++) {
          if (!entries[e].isIntersecting) continue;
          var sc = entries[e].target;
          io.unobserve(sc);
          if (sc.classList.contains('partners-section')) {
            applyPartnersReviewStaggerOrder(sc);
          }
          reveal(sc);
        }
      },
      {
        root: null,
        /* Slight positive bottom margin so sections still intersect when only in the lower viewport band */
        rootMargin: '0px 0px 12% 0px',
        threshold: 0
      }
    );

    for (var p = 0; p < observed.length; p++) io.observe(observed[p]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
