/**
 * Lerp (eased) document scrolling — wheel, same-page hash links, and optional keyboard.
 *
 * WHERE TO TUNE (all at the top of this IIFE):
 *   · LERP_FACTOR      — catch-up speed per frame (~60fps); higher = snappier
 *   · WHEEL_MULTIPLIER — wheel / trackpad sensitivity
 *   · PAGE_STEP_VIEWPORT — PageDown/Space step as fraction of viewport height
 *   · ENABLE_KEYBOARD_LERP — PageUp/PageDown/Space/Home/End (not arrow keys)
 *
 * Skips: iframes only. Document lerp ignores prefers-reduced-motion (wheel, keys, hash) so macOS
 * “Reduce motion” does not fall back to native/instant page scroll.
 * Loads after page-stagger.js so scroll-behavior can be forced to auto (site.css has smooth on html).
 */
;(function () {
  'use strict'

  // ===========================================================================
  // ADJUST THESE
  // ===========================================================================
  /** 0.08–0.22 typical; higher = tighter follow (feels “snappier”) */
  var LERP_FACTOR = 0.12

  /** Wheel delta scale (1 = browser default) */
  var WHEEL_MULTIPLIER = 1

  /** PageDown / PageUp / Space (+ Shift+Space) distance = viewport height × this */
  var PAGE_STEP_VIEWPORT = 0.85

  /**
   * Smooth PageUp, PageDown, Space, Home, End. Set false to use native behavior
   * for those keys (wheel + hash lerp still apply).
   */
  var ENABLE_KEYBOARD_LERP = true

  // ===========================================================================

  if (typeof window === 'undefined' || !window.requestAnimationFrame) return
  if (window.parent !== window) return

  var docEl = document.documentElement

  /** site.css sets html { scroll-behavior: smooth } — without this, scrollTo() lerps wrong forever */
  function lockScrollBehaviorAuto() {
    if (docEl && docEl.style) {
      docEl.style.setProperty('scroll-behavior', 'auto', 'important')
    }
    if (document.body && document.body.style) {
      document.body.style.setProperty('scroll-behavior', 'auto', 'important')
    }
  }

  lockScrollBehaviorAuto()
  window.addEventListener('load', lockScrollBehaviorAuto)

  function getScrollY() {
    return window.scrollY != null ? window.scrollY : window.pageYOffset || docEl.scrollTop || 0
  }

  /** Must bypass CSS scroll-behavior: smooth or each frame eases again */
  function scrollDocTo(top) {
    try {
      window.scrollTo({ left: 0, top: top, behavior: 'instant' })
    } catch (err) {
      try {
        window.scrollTo(0, top)
      } catch (err2) {
        var se = document.scrollingElement || docEl
        se.scrollTop = top
      }
    }
  }

  function maxYAll() {
    var se = document.scrollingElement || docEl
    return Math.max(0, se.scrollHeight - window.innerHeight)
  }

  var targetY = getScrollY()
  var animating = false
  var rafId = 0

  function clampTarget() {
    var m = maxYAll()
    if (targetY < 0) targetY = 0
    else if (targetY > m) targetY = m
  }

  function scrollTargetForEl(el) {
    if (!el) return null
    var margin = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0
    return el.getBoundingClientRect().top + getScrollY() - margin
  }

  function step() {
    var y = getScrollY()
    var diff = targetY - y
    if (Math.abs(diff) < 0.45) {
      scrollDocTo(targetY)
      animating = false
      rafId = 0
      return
    }
    scrollDocTo(y + diff * LERP_FACTOR)
    rafId = window.requestAnimationFrame(step)
  }

  function kick() {
    clampTarget()
    if (!animating) {
      animating = true
      rafId = window.requestAnimationFrame(step)
    }
  }

  function onWheel(e) {
    targetY += e.deltaY * WHEEL_MULTIPLIER
    clampTarget()
    e.preventDefault()
    kick()
  }

  document.addEventListener(
    'wheel',
    onWheel,
    { passive: false, capture: true },
  )

  window.addEventListener(
    'scroll',
    function () {
      if (!animating) targetY = getScrollY()
    },
    { passive: true },
  )

  function inEditable(el) {
    if (!el || el === document.body) return false
    var t = el.tagName
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return true
    if (el.isContentEditable) return true
    return inEditable(el.parentElement)
  }

  function keyTargetBlocksScroll(e) {
    if (inEditable(e.target)) return true
    var t = e.target && e.target.tagName
    if (t === 'BUTTON' || t === 'A') return true
    return false
  }

  if (ENABLE_KEYBOARD_LERP) {
    document.addEventListener(
      'keydown',
      function (e) {
        if (keyTargetBlocksScroll(e)) return
        var k = e.key
        var stepPx = window.innerHeight * PAGE_STEP_VIEWPORT
        if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
          targetY += stepPx
          clampTarget()
          e.preventDefault()
          kick()
        } else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) {
          targetY -= stepPx
          clampTarget()
          e.preventDefault()
          kick()
        } else if (k === 'Home') {
          targetY = 0
          clampTarget()
          e.preventDefault()
          kick()
        } else if (k === 'End') {
          targetY = maxYAll()
          clampTarget()
          e.preventDefault()
          kick()
        }
      },
      false,
    )
  }

  /**
   * Same-document hash links: resolve target scroll using scroll-margin on the section.
   */
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]')
      if (!a) return
      var raw = a.getAttribute('href')
      if (!raw || raw === '#') return

      var hash = null
      if (raw.charAt(0) === '#') {
        hash = raw
      } else {
        try {
          var u = new URL(raw, window.location.href)
          if (u.pathname !== window.location.pathname || u.search !== window.location.search) return
          hash = u.hash
        } catch (err) {
          return
        }
      }
      if (!hash || hash === '#') return

      var el = document.querySelector(hash)
      if (!el) return

      var next = scrollTargetForEl(el)
      if (next == null) return

      e.preventDefault()
      targetY = next
      clampTarget()
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', hash)
      } else {
        window.location.hash = hash
      }
      kick()
    },
    true,
  )

  /** instant: used on first paint so layout matches URL before paint in some cases */
  function applyHashFromLocation(instant) {
    var h = window.location.hash
    if (!h || h === '#') {
      targetY = window.scrollY || 0
      return
    }
    var el = document.querySelector(h)
    if (!el) return
    var y = scrollTargetForEl(el)
    if (y == null) return
    targetY = y
    clampTarget()
    if (instant) {
      scrollDocTo(targetY)
    } else {
      kick()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyHashFromLocation(true)
    })
  } else {
    applyHashFromLocation(true)
  }

  window.addEventListener('popstate', function () {
    applyHashFromLocation(false)
  })

  window.addEventListener('hashchange', function () {
    applyHashFromLocation(false)
  })
})()
