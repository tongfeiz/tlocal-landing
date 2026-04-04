(function () {
  'use strict';

  var track = document.getElementById('flow-pin-track');
  var scroller = document.getElementById('flow-list-scroll');
  var sticky = track ? track.querySelector('.flow-pin-sticky') : null;
  if (!track || !scroller || !sticky) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 760px)');
  var headerEl = document.querySelector('.site-header');
  var lastScrollerH = 0;
  var ticking = false;

  function lis() {
    return scroller.querySelectorAll('.flow-steps li');
  }

  function headerH() {
    return headerEl ? headerEl.offsetHeight : 0;
  }

  function pinActive() {
    return !reduced.matches && !narrow.matches;
  }

  function sizeListViewport() {
    var els = lis();
    if (els.length < 3) return;
    var h = 0;
    for (var i = 0; i < 3; i++) h += els[i].offsetHeight;
    var val = Math.ceil(h);
    if (val !== lastScrollerH) {
      lastScrollerH = val;
      scroller.style.height = val + 'px';
    }
  }

  function maxScroll() {
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function updateOpacity() {
    var els = lis();
    if (!els.length) return;
    if (!pinActive()) {
      for (var k = 0; k < els.length; k++) els[k].style.opacity = '';
      return;
    }

    var center = scroller.scrollTop + scroller.clientHeight / 2;

    for (var j = 0; j < els.length; j++) {
      var li = els[j];
      var mid = li.offsetTop + li.offsetHeight / 2;
      var dist = Math.abs(mid - center);
      var oneRow = scroller.clientHeight / 3;
      var t = Math.min(dist / oneRow, 1);
      li.style.opacity = String(Math.max(0.18, 1 - t * 0.82));
    }
  }

  function layout() {
    if (!pinActive()) {
      track.style.minHeight = '';
      sticky.style.top = '';
      scroller.scrollTop = 0;
      scroller.style.height = '';
      lastScrollerH = 0;
      updateOpacity();
      return;
    }

    sizeListViewport();

    var stickyH = sticky.offsetHeight;
    var viewH = window.innerHeight;
    var hdr = headerH();

    var stickyTop = Math.max(hdr, Math.round((viewH - stickyH) / 2));
    sticky.style.top = stickyTop + 'px';

    var ms = maxScroll();
    track.style.minHeight = (stickyH + ms) + 'px';
  }

  function onScroll() {
    if (!pinActive()) return;

    var ms = maxScroll();
    if (ms <= 0) {
      scroller.scrollTop = 0;
      updateOpacity();
      return;
    }

    var stickyTop = parseInt(sticky.style.top, 10) || 0;
    var rect = track.getBoundingClientRect();
    var trackDocTop = window.scrollY + rect.top;
    var pinStart = trackDocTop - stickyTop;
    var scrollY = window.scrollY;
    var t;

    if (scrollY <= pinStart) t = 0;
    else if (scrollY >= pinStart + ms) t = 1;
    else t = (scrollY - pinStart) / ms;

    scroller.scrollTop = Math.round(t * ms);
    updateOpacity();
  }

  function fullSync() {
    layout();
    onScroll();
  }

  function reset() {
    lastScrollerH = 0;
    layout();
    onScroll();
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
    }
  }, { passive: true });

  window.addEventListener('resize', fullSync);
  reduced.addEventListener('change', reset);
  narrow.addEventListener('change', reset);

  reset();

  requestAnimationFrame(fullSync);
})();
