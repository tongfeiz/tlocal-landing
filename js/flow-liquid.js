/**
 * Flow section placeholder: soft liquid-like gradients (layered radial “blobs” + wave motion).
 * Palette shifts with scroll progress through #flow-pin-track; respects prefers-reduced-motion.
 */
;(function () {
  var frame = document.getElementById('flow-liquid-frame')
  if (!frame) return

  var canvas = frame.querySelector('canvas')
  if (!canvas) return

  var track = document.getElementById('flow-pin-track')
  var sticky = track ? track.querySelector('.flow-visual-sticky') : null
  var steps = track ? track.querySelectorAll('.flow-steps li') : []

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  var raf = 0
  var ro
  var scrollP = 0

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x))
  }

  /**
   * 0–1: how far we are through the flow block (sticky-aligned steps when possible).
   */
  function computeScrollProgress() {
    if (!track) return 0
    var r = track.getBoundingClientRect()
    var vh = window.innerHeight
    var range = Math.max(1, r.height + vh * 0.45)
    var p = (vh * 0.38 - r.top) / range
    var base = clamp(p, 0, 1)

    if (sticky && steps.length) {
      var st = sticky.getBoundingClientRect().top
      var eps = 4
      var n = steps.length
      var idx = 0
      for (var i = 0; i < n; i++) {
        if (steps[i].getBoundingClientRect().top <= st + eps) idx = i
      }
      var stepFrac = n > 1 ? idx / (n - 1) : 0
      return clamp(lerp(base, stepFrac, 0.58), 0, 1)
    }

    return base
  }

  function syncScroll() {
    scrollP += (computeScrollProgress() - scrollP) * 0.26
  }

  /**
   * Scroll 0: cool aqua / mint / sky mesh. Scroll 1: warm peach / rose / apricot / orchid.
   * [h, s, l] — lerped strongly with p so the block visibly “heats up” as you read the steps.
   */
  var BLOB_PALETTE_A = [
    [204, 50, 89.5],
    [154, 44, 89],
    [188, 46, 88.5],
    [268, 38, 90],
    [218, 42, 89],
    [172, 45, 88.5],
  ]
  var BLOB_PALETTE_B = [
    [332, 54, 91],
    [24, 48, 90.5],
    [350, 52, 91.2],
    [292, 46, 90],
    [48, 46, 90],
    [310, 44, 90.5],
  ]

  function blobColors(p) {
    var t = clamp(p, 0, 1)
    var out = []
    for (var i = 0; i < BLOB_PALETTE_A.length; i++) {
      var a = BLOB_PALETTE_A[i]
      var b = BLOB_PALETTE_B[i]
      var hue = lerp(a[0], b[0], t)
      /* Mid-scroll hue bump so the transition feels more iridescent */
      hue += Math.sin(t * Math.PI) * 40
      hue = ((hue % 360) + 360) % 360
      out.push([hue, lerp(a[1], b[1], t), lerp(a[2], b[2], t)])
    }
    return out
  }

  /** Normalized anchors — matches reference regions; motion is added in draw(). */
  var BLOB_ANCHORS = [
    [0.2, 0.2],
    [0.78, 0.22],
    [0.5, 0.52],
    [0.68, 0.36],
    [0.24, 0.76],
    [0.76, 0.7],
  ]

  function hsla(h, s, l, a) {
    return 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')'
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

  function queueDraw() {
    if (!raf) raf = requestAnimationFrame(draw)
  }

  function draw() {
    raf = 0

    var ctx = canvas.getContext('2d')
    var w = frame.clientWidth
    var h = frame.clientHeight
    if (!ctx || w < 1 || h < 1) return

    var dprCheck = Math.min(window.devicePixelRatio || 1, 2)
    if (Math.round(w * dprCheck) !== canvas.width || Math.round(h * dprCheck) !== canvas.height) {
      resize()
      ctx = canvas.getContext('2d')
      if (!ctx) return
    }

    syncScroll()
    var p = scrollP
    var sec = performance.now() * 0.001
    var waveT = reduceMotion.matches ? 0 : sec

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    var dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    /* Base shifts cool lavender → warm shell as you scroll */
    var baseHue = lerp(268, 32, p)
    var baseSat = lerp(106, 28, p)
    var baseLight = lerp(96.4, 95.8, p)
    ctx.fillStyle = hsla(baseHue, baseSat, baseLight, 1)
    ctx.fillRect(0, 0, w, h)

    var colors = blobColors(p)
    var n = colors.length

    ctx.globalCompositeOperation = 'source-over'

    for (var i = 0; i < n; i++) {
      var c = colors[i]
      var phase = i * 1.12 + p * 2.4
      /* Faster, larger waves so motion reads clearly */
      var flow = waveT * (2.12 + i * 0.14)
      var ax = BLOB_ANCHORS[i][0]
      var ay = BLOB_ANCHORS[i][1]

      var cx =
        w *
        (ax +
          0.2 * Math.sin(flow * 1.05 + phase) * Math.cos(flow * 0.55 + p * 3.1) +
          0.1 * Math.sin(flow * 1.95 + i) +
          0.07 * Math.sin(flow * 2.4 + phase * 0.7))
      var cy =
        h *
        (ay +
          0.19 * Math.cos(flow * 0.88 + phase * 1.05) * Math.sin(flow * 0.62 - p * 2.2) +
          0.09 * Math.cos(flow * 1.55 + i * 0.7) +
          0.06 * Math.cos(flow * 2.1 + i))

      var radMul = i === 2 ? 0.58 : 0.46
      var rad = Math.max(w, h) * (radMul + 0.2 * Math.sin(flow * 1.35 + i + p * 4))

      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      var a0 = (i === 2 ? 0.58 : 0.48) + 0.12 * Math.sin(waveT * 1.4 + i * 0.9)
      var a1 = 0.18
      g.addColorStop(0, hsla(c[0], c[1], c[2], a0))
      g.addColorStop(0.42, hsla(c[0], c[1], c[2], a1))
      g.addColorStop(1, hsla(c[0], c[1], c[2], 0))

      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2)
      ctx.fill()
    }

    /* Soft edge cool-down — periwinkle / baby blue hint */
    var vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.44,
      Math.min(w, h) * 0.1,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.82
    )
    var vEdge = lerp(228, 252, p)
    vignette.addColorStop(0, 'rgba(255,255,255,0)')
    vignette.addColorStop(0.62, 'rgba(255,248,245,0)')
    vignette.addColorStop(1, 'hsla(' + vEdge + ',35%,92%,0.2)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    if (!reduceMotion.matches) queueDraw()
  }

  function kick() {
    syncScroll()
    queueDraw()
  }

  function kickResize() {
    resize()
    kick()
  }

  window.addEventListener('scroll', kick, { passive: true })
  window.addEventListener('resize', kickResize)
  reduceMotion.addEventListener('change', kickResize)

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(kickResize)
    ro.observe(frame)
  }

  resize()
  scrollP = computeScrollProgress()
  kick()

  window.addEventListener('load', kickResize, { once: true })
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !reduceMotion.matches) queueDraw()
  })
})()
