/**
 * Idle “cloth” of characters on a regular 4-neighbor grid, displaced as a slow 3D-ish swell.
 * Scroll switches script: English → Mandarin → Hindi. Top-down fluid swell; phases use seconds so motion is visible.
 */
;(function () {
  var frame = document.getElementById('workspace-dot-grid')
  if (!frame) return

  var canvas = frame.querySelector('canvas')
  if (!canvas) return

  var track = document.getElementById('workspace-pin-track')
  var sticky = track ? track.querySelector('.flow-visual-sticky') : null
  var cards = track ? track.querySelectorAll('.feature-card') : []
  var card2 = cards[1]
  var card3 = cards[2]

  var narrow = window.matchMedia('(max-width: 760px)')
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  var headerEl = document.querySelector('.site-header')

  var targetVariant = 1
  var variantBlend = 1

  var raf = 0
  var ro

  /** Same family as #ascii-cube (full opacity) */
  var TEXT_FILL = 'rgba(202, 202, 202, 0.97)'

  var CHARS_EN =
    'textlocalization'
  var CHARS_ZH =
    '翻译本地化语言文本字幕视频内容团队工作流协作界面时间码审查队列管理员进度状态本地化全球语系汉字简体繁体'
  var CHARS_HI =
    'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक्षत्रज्ञड़ढ़अआइईउऊएऐओऔऋानिीुूेैोौंः'

  function hdrH() {
    return headerEl ? headerEl.offsetHeight : 52
  }

  function computeVariant() {
    if (!card2 || !sticky) return 1
    var st = sticky.getBoundingClientRect().top
    var c2 = card2.getBoundingClientRect().top
    var c3 = card3 ? card3.getBoundingClientRect().top : Infinity
    var eps = 2

    if (narrow.matches) {
      var band = Math.min(Math.max(hdrH() + 72, window.innerHeight * 0.22), window.innerHeight * 0.42)
      if (card3 && c3 <= band + eps) return 3
      if (c2 <= band + eps) return 2
      return 1
    }

    if (card3 && c3 <= st + eps) return 3
    if (c2 <= st + eps) return 2
    return 1
  }

  function syncVariant() {
    targetVariant = computeVariant()
  }

  /** Wave physics only — script comes from rounded scroll variant, not blended. */
  var VARIANTS = [
    { swell: 1, oceanAmp: 1 },
    { swell: 1.08, oceanAmp: 1.04 },
    { swell: 0.95, oceanAmp: 1.06 },
  ]

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function mixWaveParams(tIndex) {
    var i = Math.floor(tIndex) - 1
    var j = Math.min(i + 1, VARIANTS.length - 1)
    var f = tIndex - Math.floor(tIndex)
    if (i < 0) i = 0
    if (i === j) return VARIANTS[i]
    var A = VARIANTS[i]
    var B = VARIANTS[j]
    return {
      swell: lerp(A.swell, B.swell, f),
      oceanAmp: lerp(A.oceanAmp, B.oceanAmp, f),
    }
  }

  function charPoolForVariant(v) {
    if (v === 2) return CHARS_ZH
    if (v === 3) return CHARS_HI
    return CHARS_EN
  }

  function charAt(pool, i, j, cols) {
    var idx = Math.abs((i * 17 + j * 31 + cols * 7) % pool.length)
    return pool.charAt(idx)
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2)
    var w = frame.clientWidth
    var h = frame.clientHeight
    if (w < 1 || h < 1) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    var ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function queueNext() {
    raf = requestAnimationFrame(draw)
  }

  /** Uniform rectangular mesh: each cell is one glyph; neighbors at N/E/S/W. */
  function gridDimensions(w, h) {
    var target = Math.max(12, Math.min(20, Math.floor(Math.min(w, h) / 19)))
    var cols = Math.max(6, Math.floor(w / target))
    var rows = Math.max(5, Math.floor(h / target))
    if (cols * rows > 2200) {
      var s = Math.sqrt((cols * rows) / 2200)
      cols = Math.max(6, Math.floor(cols / s))
      rows = Math.max(5, Math.floor(rows / s))
    }
    return { cols: cols, rows: rows }
  }

  /**
   * Top-down ocean: traveling swells + cross-sea. Phases use `sec` (seconds) so d(phase)/dt is visible
   * (using ms·1e-6 made Δphase/frame ~0 and the field looked frozen).
   */
  function oceanHeight(u, v, tMs, P) {
    var s = P.swell
    var calm = reduceMotion.matches ? 0.88 : 1
    var a = P.oceanAmp * calm * 1.18
    var sec = tMs * 0.001
    /* Angular evolution (rad/s scale — slow fluid web) */
    var p1 = sec * 0.76
    var p2 = sec * 0.37
    var p3 = sec * 0.53
    var p4 = sec * 0.31
    var d1 = u * 1.12 + v * 0.48
    var d2 = -u * 0.42 + v * 1.08
    var swell1 = Math.sin(d1 * Math.PI * 4.4 * s - p1) * 0.4
    var swell2 = Math.sin(d2 * Math.PI * 3.9 * s + p2 * 0.92) * 0.34
    var cross =
      Math.sin((u + v * 0.9) * Math.PI * 5.2 * s - p3) * Math.cos((u - v) * Math.PI * 2.8 * s + p4) * 0.22
    var roll =
      Math.sin(u * Math.PI * 1.65 * s + p4 * 0.8) * Math.cos(v * Math.PI * 1.5 * s - p2 * 0.85) * 0.28
    var chop =
      Math.sin(u * Math.PI * 7 * s - p1 * 1.1) * Math.sin(v * Math.PI * 6.5 * s + p3 * 0.88) * 0.14
    return a * (swell1 + swell2 + cross + roll + chop)
  }

  function draw() {
    raf = 0

    var ctx = canvas.getContext('2d')
    var w = frame.clientWidth
    var h = frame.clientHeight

    if (!ctx || w < 1 || h < 1) {
      queueNext()
      return
    }

    resize()

    var now = performance.now()
    var vb = reduceMotion.matches ? 1 : 0.08
    variantBlend += (targetVariant - variantBlend) * vb
    var tVar = variantBlend
    var P = mixWaveParams(Math.max(1, Math.min(3, tVar)))

    var lang = Math.round(Math.max(1, Math.min(3, variantBlend)))
    var pool = charPoolForVariant(lang)

    var t = now
    var sec = now * 0.001
    var flowT = sec * 0.51
    var gr = gridDimensions(w, h)
    var cols = gr.cols
    var rows = gr.rows
    var cellW = w / cols
    var cellH = h / rows
    var vertScale = h * (reduceMotion.matches ? 0.1 : 0.125)

    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = TEXT_FILL

    var fontPx = Math.max(9, Math.min(cellW, cellH) * 0.52)
    ctx.font =
      '500 ' +
      fontPx +
      'px system-ui, "Segoe UI", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans Devanagari", sans-serif'

    var glyphs = []

    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var u = (i + 0.5) / cols
        var v = (j + 0.5) / rows

        var elev = oceanHeight(u, v, t, P)
        /* Faint current-like drift (top-down “water” sliding past the grid) */
        var driftX =
          Math.sin(u * Math.PI * 5 + flowT) * Math.cos(v * Math.PI * 3.2 + flowT * 0.7) * cellW * 0.045
        var driftY =
          Math.cos(u * Math.PI * 3.8 - flowT * 0.85) * Math.sin(v * Math.PI * 4.6 - flowT) * cellH * 0.038
        var sx = (i + 0.5) * cellW + driftX
        var sy = (j + 0.5) * cellH + driftY - elev * vertScale
        var depthScale = Math.max(0.86, Math.min(1.12, 1 + elev * 0.05))

        glyphs.push({
          ch: charAt(pool, i, j, cols),
          sx: sx,
          sy: sy,
          z: elev,
          sc: depthScale,
        })
      }
    }

    glyphs.sort(function (a, b) {
      return a.z - b.z
    })

    for (var d = 0; d < glyphs.length; d++) {
      var g = glyphs[d]
      ctx.save()
      ctx.translate(g.sx, g.sy)
      ctx.scale(g.sc, g.sc)
      ctx.fillText(g.ch, 0, 0)
      ctx.restore()
    }

    queueNext()
  }

  function kick() {
    if (!raf) queueNext()
  }

  window.addEventListener('scroll', syncVariant, { passive: true })
  window.addEventListener('resize', function () {
    resize()
    syncVariant()
    kick()
  })
  narrow.addEventListener('change', function () {
    targetVariant = computeVariant()
    variantBlend = targetVariant
    resize()
    kick()
  })

  resize()
  syncVariant()
  targetVariant = computeVariant()
  variantBlend = targetVariant

  requestAnimationFrame(function () {
    requestAnimationFrame(kick)
  })
  window.addEventListener('load', kick, { once: true })
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) kick()
  })

  reduceMotion.addEventListener('change', kick)

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(function () {
      syncVariant()
      kick()
    })
    ro.observe(frame)
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      resize()
      syncVariant()
      kick()
    })
  }
})()
