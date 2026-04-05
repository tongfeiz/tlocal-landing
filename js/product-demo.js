(function () {
  const opts =
    typeof window !== 'undefined' && window.TLOCAL_DEMO_OPTS
      ? window.TLOCAL_DEMO_OPTS
      : { showScrubber: true, loop: false }

  /** confidence: model score 0–1 → 1–10 score; tier: high ≥7, mid ≥4, low <4 */
  const TICKETS = [
    { id: 't1', text: 'Please silence phones', inSec: 45, outSec: 120, type: 'subtitle', confidence: 0.92 },
    { id: 't2', text: 'WELCOME TO THE SHOW', inSec: 72, outSec: 180, type: 'subtitle', confidence: 0.88 },
    { id: 't3', text: 'NOW SHOWING', inSec: 200, outSec: 360, type: 'poster', confidence: 0.62 },
    { id: 't4', text: 'EXIT', inSec: 5024, outSec: 5160, type: 'sign', confidence: 0.55 },
    { id: 't5', text: 'Do not enter', inSec: 7500, outSec: 7680, type: 'label', confidence: 0.35 },
    { id: 't6', text: 'Emergency exit →', inSec: 8800, outSec: 8920, type: 'label', confidence: 0.78 },
    { id: 't7', text: '15 MINUTES LATER', inSec: 9000, outSec: 9180, type: 'graphic', confidence: 0.41 },
    { id: 't8', text: 'CLOSED', inSec: 12000, outSec: 12120, type: 'sign', confidence: 0.84 },
  ]

  const LANGS = [
    { code: 'es', label: 'Spanish' },
    { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' },
    { code: 'hi', label: 'Hindi' },
    { code: 'fr', label: 'French' },
  ]

  const TRANSLATIONS = {
    es: [
      'Silencien sus teléfonos',
      'Bienvenidos al espectáculo',
      'EN CARTELERA',
      'Salida',
      'No pasar',
      'Salida de emergencia →',
      '15 MINUTOS DESPUÉS',
      'CERRADO',
    ],
    zh: ['请关闭手机或调至静音', '欢迎观看演出', '现正放映', '出口', '请勿进入', '紧急出口 →', '15 分钟后', '已关闭'],
    ja: [
      '携帯電話はマナーモードに',
      'ショーへようこそ',
      '上映中',
      '出口',
      '立入禁止',
      '非常口 →',
      '15分後',
      '閉店',
    ],
    hi: [
      'कृपया फ़ोन बंद रखें',
      'शो में आपका स्वागत है',
      'अब प्रदर्शित',
      'बाहर निकलें',
      'प्रवेश निषेध',
      'आपातकालीन निकास →',
      '15 मिनट बाद',
      'बंद',
    ],
    fr: [
      'Veuillez éteindre les téléphones',
      'Bienvenue au spectacle',
      'À l’affiche',
      'Sortie',
      'Entrée interdite',
      'Sortie de secours →',
      '15 MINUTES PLUS TARD',
      'FERMÉ',
    ],
  }

  /** One JPEG data URL per ticket, captured from the placeholder video (or canvas). */
  const VIDEO_FRAMES = new Array(8).fill(
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  )

  let demoVideoBlobUrl = null
  let canvasAnimId = null

  const SCENE_LABELS = [
    '1 · Empty home',
    '2 · Workspace (queue empty)',
    '3 · Analysis overlay',
    '4 · Tickets (review)',
    '5 · Half approved',
    '6 · Full approved',
    '7 · Loc · Admin',
    '8 · Spanish',
    '9 · Chinese',
    '10 · Japanese',
    '11 · Hindi',
    '12 · French',
    '13 · All teams',
    '14 · Final',
  ]

  const ANALYSIS_MESSAGES = [
    'Decoding frames…',
    'Running OCR on key regions…',
    'Tracking text across time…',
    'Building translator tickets…',
  ]

  const REVIEW_SEQ_SCALE = 1.4
  const TICKET_REVIEW_DURATION_BOOST = 2
  const APPROVE_STAGGER_MS = Math.round(72 * REVIEW_SEQ_SCALE * TICKET_REVIEW_DURATION_BOOST)
  /** After ticket UI is visible, pause before first approve tick (stagger). */
  const TICKETS_REVEAL_PAUSE_MS = Math.round(480 * REVIEW_SEQ_SCALE * TICKET_REVIEW_DURATION_BOOST)
  const POST_APPROVE_PAUSE_MS = Math.round(650 * REVIEW_SEQ_SCALE * TICKET_REVIEW_DURATION_BOOST)
  const ANALYSIS_DURATION_MS = 1900
  /** Auto demo: pause after each locale workspace before the next (descending). */
  const LOC_GAP_AFTER_LANG_MS = [640, 580, 520, 460, 400]
  /** Loc admin beat before Spanish (longer hold). */
  const ADMIN_LOC_HOLD_MS = 1520
  const TEAM_FINAL_STAGGER_MS = 28
  /** Grid grow + bars fill; pause before card outlines. */
  const TEAM_FINAL_ANIM_HOLD_MS = 4 * TEAM_FINAL_STAGGER_MS + 800
  /** Slower ease-out from locale corner zoom → full frame (visual only; can exceed hold). */
  const FINAL_SCENE_ZOOM_OUT_MS = 3400
  const FINAL_SCENE_ZOOM_OUT_EASE = 'cubic-bezier(0.18, 0.7, 0.25, 1)'
  /** Extra linger on the last frame after card outlines (end of demo). */
  const FINAL_SCENE_TAIL_MS = 2400

  /** Auto demo: ES two-phase row; each next language uses a shorter per-row pause. */
  const LOC_DEMO_SPECS = [
    { code: 'es', label: 'Spanish localization', kind: 'two', p1: 74, p2: 46 },
    { code: 'zh', label: 'Chinese localization', kind: 'one', row: 56 },
    { code: 'ja', label: 'Japanese localization', kind: 'one', row: 42 },
    { code: 'hi', label: 'Hindi localization', kind: 'one', row: 32 },
    { code: 'fr', label: 'French localization', kind: 'one', row: 22 },
  ]

  function analysisBarDisplayRatio(linearT) {
    const u = Math.min(1, Math.max(0, linearT))
    return (1 - Math.exp(-4.25 * u)) * 0.965
  }

  /* ASCII tlocal cube (from tlocal cube interactive.html) — TLOCAL wireframe, no pointer/hover. */
  const TLOCAL_ASCII_PATTERN = `


                              @@@@@@                                  
                           @@@@@@@@@@@@                               
                       @@@@@@@    @@@@@@@@                            
                     @@@@@@    @@@@@@@@@@@@@@                         
                 @@@@@@@@@  @@@@@@         @@@@@@                     
              @@@@@@  @@@@@@@@@               @@@@@@                  
           @@@@@      @@@@@                      @@@@@@               
       @@@@@@     @@@@@@                            @@@@@@            
    @@@@@@@@@@@@@@@@@                                  @@@@@@         
 @@@@@@    @@@@@@@                                        @@@@@@@     
  @@@@@@     @@@@@@                                          @@@@@@@@@@@  
@@@@@@    @@@@@                                           @@@@@      @@@@@
@@@@@@@@@@@@                                          @@@@@@@    @@@@@@@@@
@@@@@@@@@@@@                                       @@@@@@@@    @@@@@@@@@@@
@@  @@@@@@@@@@@                                 @@@@@@  @@@@@@@@@@@@@@@@@@
@@   @@@@@@@@@@@@@@                          @@@@@@     @@@@@@@@@@@@@@@@@@
@@   @@@   @@@@@@@@@@                     @@@@@@     @@@@@@@@@@@@@@@@@@@@@
@@   @@@      @@@@@@@@@@@             @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@         @@@@@@@@@@@       @@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@             @@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@               @@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@ @@@@                   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@  @@@@                    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@   @@@                     @@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@   @@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@                     @@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@                     @@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@  @@@@                     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@   @@@                     @@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@   @@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@   @@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@                     @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  @@@@@@@                    @@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  
 @@@@@@@                 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     
     @@@@@@              @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@        
        @@@@@@           @@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@           
           @@@@@@        @@@  @@@@@@@@@@@@@@@@@@@@@@@@@               
              @@@@@@@    @@@  @@@@@@@@@@@@@@@@@@@@@@                  
                 @@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@                     
                     @@@@@@@  @@@@@@@@@@@@@@@                         
                        @@@@@@@@@@@@@@@@@@@                           
                           @@@@@@@@@@@@                               
                              @@@@@@                                  `

  const TLOCAL_UPPER = ['T', 'L', 'O', 'C', 'A', 'L']
  const rawAsciiLines = TLOCAL_ASCII_PATTERN.split('\n')
  const isAsciiBlank = (s) => s.length === 0 || /^\s+$/.test(s)
  let _a = 0
  while (_a < rawAsciiLines.length && isAsciiBlank(rawAsciiLines[_a])) _a++
  let _b = rawAsciiLines.length
  while (_b > _a && isAsciiBlank(rawAsciiLines[_b - 1])) _b--
  const analysisAsciiLines = rawAsciiLines.slice(_a, _b)

  let analysisAsciiTick = 0
  let analysisAsciiTimer = null

  function renderAnalysisAscii() {
    const pre = document.getElementById('analysis-ascii-cube')
    if (!pre) return
    const out = analysisAsciiLines.map((line, lineIndex) => {
      const letter = TLOCAL_UPPER[(analysisAsciiTick + lineIndex) % TLOCAL_UPPER.length]
      return line.replace(/@/g, letter)
    })
    pre.textContent = out.join('\n')
  }

  /** Scale ASCII art to the placeholder width; viewport box matches scaled drawing (nothing clipped). */
  function fitAnalysisAsciiCube() {
    const wrap = document.getElementById('ph-ascii-wrap')
    const vp = document.getElementById('ph-ascii-viewport')
    const pre = document.getElementById('analysis-ascii-cube')
    if (!wrap || !vp || !pre || wrap.classList.contains('hidden')) return

    pre.style.setProperty('--ascii-scale', '1')
    vp.style.width = '100%'
    vp.style.height = 'auto'

    const naturalW = pre.offsetWidth
    const naturalH = pre.offsetHeight
    if (!naturalW || !naturalH) return

    const maxW = Math.max(48, wrap.clientWidth)
    const s = Math.min(1, maxW / naturalW)

    pre.style.setProperty('--ascii-scale', String(s))
    vp.style.width = `${naturalW * s}px`
    vp.style.height = `${naturalH * s}px`
  }

  function startAnalysisAsciiAnimation() {
    if (analysisAsciiTimer != null) return
    if (window.matchMedia('(max-width: 760px)').matches) return
    const wrap = document.getElementById('ph-ascii-wrap')
    if (wrap) {
      wrap.classList.remove('hidden')
      wrap.setAttribute('aria-hidden', 'false')
    }
    analysisAsciiTick = 0
    renderAnalysisAscii()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fitAnalysisAsciiCube())
    })
    analysisAsciiTimer = window.setInterval(() => {
      analysisAsciiTick = (analysisAsciiTick + 1) % TLOCAL_UPPER.length
      renderAnalysisAscii()
    }, 120)
  }

  function stopAnalysisAsciiAnimation() {
    if (analysisAsciiTimer != null) {
      clearInterval(analysisAsciiTimer)
      analysisAsciiTimer = null
    }
    const wrap = document.getElementById('ph-ascii-wrap')
    if (wrap) {
      wrap.classList.add('hidden')
      wrap.setAttribute('aria-hidden', 'true')
    }
  }

  window.addEventListener(
    'resize',
    () => {
      requestAnimationFrame(() => fitAnalysisAsciiCube())
    },
    { passive: true }
  )

  /**
   * Scene manifest (for editing pacing / content). Approximate segment durations —
   * see runDemo() for exact pause() and animation calls.
   *
   * 1  Start / empty home — hold before “upload”
   * 2  Upload beat — user picks file (implied)
   * 3  Workspace — project name + video column + empty queue (scrubber only; auto-run skips to analysis)
   * 4  Analysis — overlay, progress (~1.5s animation)
   * 5  Review ready — 8 tickets, mini list, table reveal
   * 6  Approve sweep — 8 rows, staggered checkmarks (1.4× pacing)
   * 7  Continue CTA — button enables
   * 8  Localization admin — team cards, View as tabs
   * 9  Spanish workspace — fill translation + mock + confirm per row
   * 10 Chinese workspace — fast pass
   * 11–12 Japanese → Hindi → French — row cadence shortens each language
   * 13 All teams — admin snapshot
   * 14 Final — bars 0/8 → 8/8 in approval green, staggered; card outlines
   * 15 End — Replay in sidebar (temp scrubber)
   *
   * Zoom: disabled; re-enable later once pacing is locked.
   */

  function formatTc(sec) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    const f = Math.floor((sec % 1) * 24)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
  }

  const el = (id) => document.getElementById(id)

  const ZOOM_EASE = 'cubic-bezier(0.33, 1, 0.53, 1)'
  const ZOOM_TO_UPLOAD_MS = 1150
  /** Hold on empty home at 1× before zoom-to-upload begins */
  const EMPTY_HOME_HOLD_MS = 1000
  const ZOOM_SCALE_FOCUS = 1.5
  /** Chinese → French: mild zoom, focal point pinned to top-right border */
  const ZOOM_SCALE_LOCALE = 1.22
  const ZOOM_LOCALE_CORNER_OX = 99.6
  const ZOOM_LOCALE_CORNER_OY = 2
  /** Ticket review (half / full approved): tighter zoom, focal point on right edge */
  const ZOOM_SCALE_TICKET_REVIEW = 1.28
  const ZOOM_ORIGIN_X_RIGHT_EDGE = 99.2

  function setDemoZoomImmediate(scale, oxPct, oyPct) {
    const stage = el('demo-zoom-stage')
    if (!stage) return
    stage.classList.add('demo-zoom-no-transition')
    stage.style.setProperty('--zoom-scale', String(scale))
    stage.style.setProperty('--zoom-ox', `${oxPct}%`)
    stage.style.setProperty('--zoom-oy', `${oyPct}%`)
    void stage.offsetHeight
    stage.classList.remove('demo-zoom-no-transition')
  }

  /** Visual only — does not block demo timing. */
  function startZoomResetDuring(durationMs, ease = ZOOM_EASE) {
    const stage = el('demo-zoom-stage')
    if (!stage) return
    stage.style.transition = `transform ${durationMs}ms ${ease}`
    stage.style.setProperty('--zoom-scale', '1')
    stage.style.setProperty('--zoom-ox', '50%')
    stage.style.setProperty('--zoom-oy', '50%')
  }

  /**
   * Final zoom-out after French: scale down only, keeping transform-origin at the locale corner
   * so the move reads as backing out of the same framing (avoids drifting origin to center mid-animation).
   */
  function startFinalSceneZoomOutFromLocaleCorner(durationMs, ease) {
    const stage = el('demo-zoom-stage')
    if (!stage) return
    stage.style.setProperty('--zoom-ox', `${ZOOM_LOCALE_CORNER_OX}%`)
    stage.style.setProperty('--zoom-oy', `${ZOOM_LOCALE_CORNER_OY}%`)
    void stage.offsetHeight
    stage.style.transition = `transform ${durationMs}ms ${ease}`
    stage.style.setProperty('--zoom-scale', '1')
    window.setTimeout(() => {
      setDemoZoomImmediate(1, 50, 50)
    }, durationMs + 50)
  }

  /** Zoom toward upload button (call after EMPTY_HOME_HOLD_MS). */
  function startZoomToUploadDuring(durationMs = ZOOM_TO_UPLOAD_MS) {
    const stage = el('demo-zoom-stage')
    const btn = el('btn-upload')
    if (!stage || !btn) return
    requestAnimationFrame(() => {
      const sr = stage.getBoundingClientRect()
      const er = btn.getBoundingClientRect()
      if (sr.width < 1 || sr.height < 1) return
      const ox = ((er.left + er.width / 2 - sr.left) / sr.width) * 100
      const oy = ((er.top + er.height / 2 - sr.top) / sr.height) * 100
      stage.style.transition = `transform ${durationMs}ms ${ZOOM_EASE}`
      stage.style.setProperty('--zoom-ox', `${ox}%`)
      stage.style.setProperty('--zoom-oy', `${oy}%`)
      stage.style.setProperty('--zoom-scale', String(ZOOM_SCALE_FOCUS))
    })
  }

  /** Zoom toward right edge + approve column; spans all approval staggers. */
  function startZoomToTicketPanelDuring(durationMs) {
    const stage = el('demo-zoom-stage')
    const tp = el('ticket-panel')
    if (!stage || !tp) return
    requestAnimationFrame(() => {
      const sr = stage.getBoundingClientRect()
      const er = tp.getBoundingClientRect()
      if (sr.width < 1 || sr.height < 1) return
      const oy = ((er.top + er.height / 2 - sr.top) / sr.height) * 100
      stage.style.transition = `transform ${durationMs}ms ${ZOOM_EASE}`
      stage.style.setProperty('--zoom-ox', `${ZOOM_ORIGIN_X_RIGHT_EDGE}%`)
      stage.style.setProperty('--zoom-oy', `${oy}%`)
      stage.style.setProperty('--zoom-scale', String(ZOOM_SCALE_TICKET_REVIEW))
    })
  }

  /**
   * Wall-clock span: Chinese workspace → gaps → … → French workspace (excludes gap after French).
   * Matches runDemo’s for-loop so one CSS transition stays in sync with the demo.
   */
  function computeLocaleZoomPanDurationMs() {
    let ms = 0
    const n = TICKETS.length
    for (let li = 1; li < LOC_DEMO_SPECS.length; li++) {
      const spec = LOC_DEMO_SPECS[li]
      if (spec.kind === 'two') {
        ms += n * (spec.p1 + spec.p2)
      } else {
        ms += n * spec.row
      }
      if (li < LOC_DEMO_SPECS.length - 1 && li < LOC_GAP_AFTER_LANG_MS.length) {
        ms += LOC_GAP_AFTER_LANG_MS[li]
      }
    }
    return Math.max(800, ms)
  }

  /** Single smooth pan from center → top-right corner (border); call once at start of Chinese (Spanish = no zoom). */
  function startLocaleZoomSmoothPan() {
    const stage = el('demo-zoom-stage')
    if (!stage) return
    const ms = computeLocaleZoomPanDurationMs()
    stage.style.transition = `transform ${ms}ms cubic-bezier(0.45, 0.02, 0.25, 1)`
    stage.style.setProperty('--zoom-ox', `${ZOOM_LOCALE_CORNER_OX}%`)
    stage.style.setProperty('--zoom-oy', `${ZOOM_LOCALE_CORNER_OY}%`)
    stage.style.setProperty('--zoom-scale', String(ZOOM_SCALE_LOCALE))
  }

  function syncDemoZoomForScrubberStep(step) {
    const stage = el('demo-zoom-stage')
    if (!stage) return
    if ([0, 1, 2, 3, 6, 7, 12, 13].includes(step)) {
      setDemoZoomImmediate(1, 50, 50)
      return
    }
    if (step === 4 || step === 5) {
      const tp = el('ticket-panel')
      if (tp) {
        const sr = stage.getBoundingClientRect()
        const er = tp.getBoundingClientRect()
        if (sr.width > 0 && sr.height > 0) {
          const oy = ((er.top + er.height / 2 - sr.top) / sr.height) * 100
          setDemoZoomImmediate(ZOOM_SCALE_TICKET_REVIEW, ZOOM_ORIGIN_X_RIGHT_EDGE, oy)
        }
      }
      return
    }
    if (step >= 8 && step <= 11) {
      const u = (step - 8) / 3
      const ox = 50 + (ZOOM_LOCALE_CORNER_OX - 50) * u
      const oy = 50 + (ZOOM_LOCALE_CORNER_OY - 50) * u
      setDemoZoomImmediate(ZOOM_SCALE_LOCALE, ox, oy)
    }
  }

  function setScene(name) {
    document.querySelectorAll('.scene').forEach((s) => s.classList.remove('active'))
    const map = {
      empty: 'scene-empty',
      workspace: 'scene-workspace',
      localization: 'scene-localization',
    }
    const node = el(map[name])
    if (node) node.classList.add('active')
  }

  function setCaption() {
    /* Footer removed; keep hook for future narration */
  }

  function drawPlaceholderFrame(ctx, w, h, phase) {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#12121a')
    g.addColorStop(1, '#06060c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const lines = [
      'PLEASE SILENCE PHONES',
      'WELCOME TO THE SHOW',
      'NOW SHOWING',
      'EXIT',
      'DO NOT ENTER',
      'EMERGENCY EXIT →',
      '15 MINUTES LATER',
      'CLOSED',
    ]
    const fi = Math.min(lines.length - 1, Math.floor(phase * lines.length))
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.font = '600 22px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(lines[fi], w / 2, h / 2 - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText('TLocal · placeholder reel', w / 2, h / 2 + 22)
  }

  function captureFramesFromOffscreenCanvas() {
    const w = 640
    const h = 360
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    for (let i = 0; i < 8; i++) {
      const phase = (i + 0.5) / 8
      drawPlaceholderFrame(ctx, w, h, phase)
      VIDEO_FRAMES[i] = c.toDataURL('image/jpeg', 0.88)
    }
  }

  function captureVideoFrameAt(video, timeSec) {
    return new Promise((resolve) => {
      const w = video.videoWidth || 640
      const h = video.videoHeight || 360
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        video.removeEventListener('seeked', onSeeked)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        try {
          ctx.drawImage(video, 0, 0, w, h)
          resolve(c.toDataURL('image/jpeg', 0.86))
        } catch {
          captureFramesFromOffscreenCanvas()
          resolve(VIDEO_FRAMES[0])
        }
      }
      const onSeeked = () => finish()
      video.addEventListener('seeked', onSeeked)
      const dur = video.duration && !Number.isNaN(video.duration) ? video.duration : 1
      video.currentTime = Math.min(Math.max(0, timeSec), Math.max(0.1, dur - 0.06))
      setTimeout(finish, 500)
    })
  }

  async function recordPlaceholderWebM() {
    const w = 640
    const h = 360
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const durationMs = 6000
    const fps = 24
    const stream = canvas.captureStream(fps)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : ''
    if (!mime || typeof MediaRecorder === 'undefined') throw new Error('No MediaRecorder')

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 900000 })
    const chunks = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    const urlPromise = new Promise((resolve, reject) => {
      rec.onerror = () => reject(new Error('record error'))
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        resolve(URL.createObjectURL(blob))
      }
    })
    drawPlaceholderFrame(ctx, w, h, 0)
    rec.start()
    const t0 = performance.now()
    const frameMs = 1000 / fps
    const iv = setInterval(() => {
      const elapsed = performance.now() - t0
      const phase = Math.min(1, elapsed / durationMs)
      drawPlaceholderFrame(ctx, w, h, phase)
      if (elapsed >= durationMs) {
        clearInterval(iv)
        rec.stop()
      }
    }, frameMs)
    return urlPromise
  }

  function startCanvasFallbackLoop() {
    stopCanvasFallbackLoop()
    const cvs = el('demo-canvas-fallback')
    const vid = el('demo-video')
    if (!cvs) return
    vid.classList.add('hidden')
    cvs.classList.add('visible')
    const ctx = cvs.getContext('2d')
    let phase = 0
    function tick() {
      phase = (phase + 0.0012) % 1
      drawPlaceholderFrame(ctx, cvs.width, cvs.height, phase)
      canvasAnimId = requestAnimationFrame(tick)
    }
    canvasAnimId = requestAnimationFrame(tick)
  }

  function stopCanvasFallbackLoop() {
    if (canvasAnimId != null) {
      cancelAnimationFrame(canvasAnimId)
      canvasAnimId = null
    }
    const cvs = el('demo-canvas-fallback')
    if (cvs) cvs.classList.remove('visible')
  }

  async function initPlaceholderMedia() {
    const vid = el('demo-video')
    captureFramesFromOffscreenCanvas()

    try {
      const url = await recordPlaceholderWebM()
      vid.src = url
      demoVideoBlobUrl = url
      vid.classList.remove('hidden')
      stopCanvasFallbackLoop()
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 4000)
        vid.onloadeddata = () => {
          clearTimeout(t)
          resolve()
        }
        vid.onerror = () => {
          clearTimeout(t)
          reject(new Error('video error'))
        }
      })
      const dur = vid.duration && vid.duration > 0 ? vid.duration : 6
      for (let i = 0; i < 8; i++) {
        VIDEO_FRAMES[i] = await captureVideoFrameAt(vid, ((i + 0.5) / 8) * dur)
      }
    } catch {
      if (demoVideoBlobUrl) {
        URL.revokeObjectURL(demoVideoBlobUrl)
        demoVideoBlobUrl = null
      }
      vid.removeAttribute('src')
      vid.classList.add('hidden')
      startCanvasFallbackLoop()
      captureFramesFromOffscreenCanvas()
    }
  }

  function setDemoVideoVisible(on) {
    const vid = el('demo-video')
    const cvs = el('demo-canvas-fallback')
    if (!on) {
      stopCanvasFallbackLoop()
      if (vid) {
        vid.pause()
        vid.classList.add('hidden')
      }
      if (cvs) cvs.classList.remove('visible')
      return
    }
    if (vid?.src) {
      stopCanvasFallbackLoop()
      vid.classList.remove('hidden')
      try {
        void vid.play()
      } catch {
        /* ignore */
      }
    } else {
      startCanvasFallbackLoop()
    }
  }

  function pause(ms, g) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(alive(g)), ms)
    })
  }

  function updateQueueCount(shown, total) {
    const q = el('queue-count')
    if (q) q.textContent = `${shown} shown · ${total} total`
  }

  /** Same 1–10 score as app: confidenceToScore10 */
  function aiScore10(confidence01) {
    const c = Math.max(0, Math.min(1, Number(confidence01) || 0))
    return Math.round(c * 100) / 10
  }

  /** Green ≥7, yellow ≥4, red &lt;4 on 1–10 scale */
  function confidenceTier01(confidence01) {
    const s = aiScore10(confidence01)
    if (s >= 7) return 'high'
    if (s >= 4) return 'mid'
    return 'low'
  }

  function timelineDurationSec() {
    const maxOut = TICKETS.length ? Math.max(...TICKETS.map((t) => t.outSec)) : 1
    return Math.max(maxOut * 1.02, 1)
  }

  let timelineApproveGen = 0

  /** After all tickets approved: stagger mid/low segments to green (demo flourish). */
  function runTimelineApprovedCelebration() {
    const gen = ++timelineApproveGen
    const segHost = el('demo-timeline-segments')
    if (!segHost) return
    const segs = [...segHost.querySelectorAll('.demo-timeline-seg')]
    const staggerMs = 220
    let animIndex = 0
    segs.forEach((btn) => {
      if (btn.classList.contains('tier-high')) return
      const delay = animIndex * staggerMs
      animIndex += 1
      setTimeout(() => {
        if (gen !== timelineApproveGen || !btn.isConnected) return
        btn.classList.remove('tier-mid', 'tier-low')
        btn.classList.add('tier-high')
      }, delay)
    })
  }

  function renderTimeline(currentSec) {
    timelineApproveGen++
    const dur = timelineDurationSec()
    const segHost = el('demo-timeline-segments')
    const ph = el('demo-timeline-playhead')
    const tc = el('demo-timeline-tc')
    if (!segHost) return
    segHost.innerHTML = ''
    TICKETS.forEach((t) => {
      const tier = confidenceTier01(t.confidence)
      const left = (t.inSec / dur) * 100
      const width = Math.max(((t.outSec - t.inSec) / dur) * 100, 0.48)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `demo-timeline-seg tier-${tier}`
      btn.style.left = `${left}%`
      btn.style.width = `${width}%`
      const score = aiScore10(t.confidence)
      btn.title = `${t.text} · AI ${score.toFixed(1)}/10`
      segHost.appendChild(btn)
    })
    const t = typeof currentSec === 'number' && Number.isFinite(currentSec) ? currentSec : 0
    if (ph) ph.style.left = `${Math.min(100, Math.max(0, (t / dur) * 100))}%`
    if (tc) tc.textContent = formatTc(t)
  }

  function buildTicketRows() {
    const tbody = el('ticket-rows')
    tbody.innerHTML = ''
    TICKETS.forEach((t, i) => {
      const tr = document.createElement('tr')
      tr.dataset.id = t.id
      tr.innerHTML = `
        <td class="mono">${String(i + 1).padStart(3, '0')}</td>
        <td class="mono">${formatTc(t.inSec)}</td>
        <td class="mono">${formatTc(t.outSec)}</td>
        <td>${t.text}</td>
        <td><span class="pill">${t.type}</span></td>
        <td><div class="approve-cell"><span class="chk" data-approve></span></div></td>
      `
      tbody.appendChild(tr)
    })
    updateQueueCount(TICKETS.length, TICKETS.length)
  }

  function buildMiniList() {
    const ul = el('mini-list')
    ul.innerHTML = ''
    TICKETS.forEach((t, i) => {
      const li = document.createElement('li')
      li.dataset.id = t.id
      li.innerHTML = `<button type="button"><span class="mono" style="color:var(--text-muted)">#${String(i + 1).padStart(3, '0')}</span><span class="mono">${formatTc(t.inSec)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.text}</span></button>`
      ul.appendChild(li)
    })
  }

  function animateTeamGridToComplete() {
    const grid = el('team-grid')
    if (!grid) return
    const cards = [...grid.querySelectorAll('.team-card')]
    const total = TICKETS.length
    cards.forEach((card, idx) => {
      setTimeout(() => {
        const strong = card.querySelector('.stat strong')
        const bar = card.querySelector('.bar i')
        if (strong) strong.textContent = `${total}/${total}`
        if (bar) bar.style.width = '100%'
      }, idx * TEAM_FINAL_STAGGER_MS)
    })
  }

  function buildTeamGrid(progress) {
    const grid = el('team-grid')
    grid.classList.remove('is-final-grow')
    grid.innerHTML = ''
    LANGS.forEach((L) => {
      const done = progress[L.code] ?? 0
      const pct = TICKETS.length === 0 ? 0 : Math.round((done / TICKETS.length) * 100)
      const card = document.createElement('div')
      card.className = 'team-card'
      card.innerHTML = `
        <p class="team-label">Team</p>
        <p class="team-name">${L.label}</p>
        <p class="stat"><strong>${done}/${TICKETS.length}</strong> confirmed</p>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <button type="button" data-lang="${L.code}">Open ${L.label} workspace</button>
      `
      grid.appendChild(card)
    })
  }

  function buildPerspectiveTabs(active) {
    const tabs = el('perspective-tabs')
    tabs.innerHTML = ''
    const mk = (code, label) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.dataset.perspective = code
      if (code === active) b.classList.add('active')
      return b
    }
    tabs.appendChild(mk('admin', 'Admin'))
    LANGS.forEach((L) => tabs.appendChild(mk(L.code, L.label)))
  }

  function frameUrl(i) {
    return VIDEO_FRAMES[i] ?? VIDEO_FRAMES[0]
  }

  function buildTeamRows(langCode) {
    const tbody = el('team-rows')
    tbody.innerHTML = ''
    TICKETS.forEach((t, i) => {
      const tr = document.createElement('tr')
      tr.dataset.id = t.id
      const src = frameUrl(i)
      tr.innerHTML = `
        <td class="mono">${i + 1}</td>
        <td><div class="frame-thumb"><img src="${src}" alt="" /></div></td>
        <td>${t.text}</td>
        <td><input class="tx-input" readonly value="" placeholder="…" /></td>
        <td><div class="mock-slot" data-mock><span class="mock-placeholder">empty</span></div></td>
        <td><span class="chk" data-team-ok></span></td>
      `
      tbody.appendChild(tr)
    })
  }

  function fillTeamMock(tr, i, langCode) {
    const mock = tr.querySelector('[data-mock]')
    const src = frameUrl(i)
    mock.classList.add('filled')
    ;['es', 'zh', 'hi', 'ja', 'fr'].forEach((c) => mock.classList.remove(`mock-lang-${c}`))
    mock.classList.add(`mock-lang-${langCode}`)
    mock.innerHTML = `<img src="${src}" alt="" />`
  }

  let runGen = 0
  function alive(g) {
    return g === runGen
  }

  function highlightScrubber(step) {
    document.querySelectorAll('#scene-scrubber button[data-scene]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.scene) === step)
    })
  }

  /**
   * Jump to a static snapshot (0–13). Cancels the automated run via runGen.
   */
  function applySceneStep(step) {
    runGen++
    const progress = { es: 0, zh: 0, ja: 0, hi: 0, fr: 0 }

    document.querySelectorAll('#team-grid .team-card').forEach((c) => {
      c.style.outline = ''
    })
    highlightScrubber(step)

    const resetWorkspaceChrome = () => {
      el('ph-title').textContent = 'Tickets will appear here'
      el('ph-sub').textContent = 'Run analysis to extract on-screen text for the full film.'
      el('analysis-overlay').classList.remove('visible')
      stopAnalysisAsciiAnimation()
      el('progress-fill').style.width = '0%'
      el('mini-tickets').classList.add('hidden')
      el('demo-timeline').classList.add('hidden')
      el('table-placeholder').classList.remove('hidden')
      el('table-wrap').classList.add('hidden')
      el('table-wrap').classList.remove('reveal-in')
      el('btn-continue').classList.add('continue-off')
      updateQueueCount(0, 0)
    }

    try {
    if (step === 0) {
      setDemoVideoVisible(false)
      el('header-title').textContent = 'untitled_project'
      el('video-label').textContent = 'No file loaded'
      resetWorkspaceChrome()
      setScene('empty')
      return
    }

    el('header-title').textContent = 'sample_film.mov'
    el('video-label').textContent = 'sample_film.mov · preview'
    setDemoVideoVisible(true)

    if (step === 1) {
      setScene('workspace')
      resetWorkspaceChrome()
      return
    }

    if (step === 2) {
      setScene('workspace')
      el('ph-title').textContent = 'Scanning the full timeline…'
      el('ph-sub').textContent = 'Processing runs across the entire movie duration (demo).'
      el('mini-tickets').classList.add('hidden')
      el('table-placeholder').classList.remove('hidden')
      el('table-wrap').classList.add('hidden')
      el('analysis-overlay').classList.add('visible')
      startAnalysisAsciiAnimation()
      el('progress-fill').style.width = '45%'
      el('analysis-status').textContent = ANALYSIS_MESSAGES[1]
      updateQueueCount(0, 0)
      el('demo-timeline').classList.add('hidden')
      return
    }

    if (step >= 3 && step <= 5) {
      setScene('workspace')
      el('analysis-overlay').classList.remove('visible')
      stopAnalysisAsciiAnimation()
      el('ph-title').textContent = 'Tickets will appear here'
      el('ph-sub').textContent = 'Review and approve translator tickets.'

      buildTicketRows()
      buildMiniList()
      el('mini-tickets').classList.remove('hidden')
      el('demo-timeline').classList.remove('hidden')
      renderTimeline(0)
      el('table-placeholder').classList.add('hidden')
      el('table-wrap').classList.remove('hidden')
      el('table-wrap').classList.add('reveal-in')
      el('ticket-rows').querySelectorAll('tr').forEach((tr, idx) => {
        tr.querySelectorAll('[data-approve]').forEach((c) => {
          c.classList.remove('on')
          c.textContent = ''
        })
        tr.classList.toggle('row-sel', idx === 0)
      })
      el('mini-list').querySelectorAll('li').forEach((li, idx) => {
        li.classList.toggle('sel', idx === 0)
      })

      if (step === 3) {
        el('btn-continue').classList.add('continue-off')
        return
      }

      if (step === 4) {
        el('ticket-rows').querySelectorAll('tr').forEach((tr, idx) => {
          const chk = tr.querySelector('[data-approve]')
          if (idx < 4) {
            chk.classList.add('on')
            chk.textContent = '✓'
          }
        })
        el('btn-continue').classList.add('continue-off')
        return
      }

      el('ticket-rows').querySelectorAll('tr').forEach((tr) => {
        const chk = tr.querySelector('[data-approve]')
        chk.classList.add('on')
        chk.textContent = '✓'
      })
      el('btn-continue').classList.remove('continue-off')
      requestAnimationFrame(() => {
        setTimeout(() => runTimelineApprovedCelebration(), 100)
      })
      return
    }

    setScene('localization')
    el('loc-admin').classList.remove('hidden')
    el('loc-team').classList.add('hidden')

    if (step === 6) {
      buildPerspectiveTabs('admin')
      buildTeamGrid(progress)
      return
    }

    const fillSpanish = () => {
      buildPerspectiveTabs('es')
      el('loc-admin').classList.add('hidden')
      el('loc-team').classList.remove('hidden')
      el('team-heading').textContent = 'Spanish localization'
      buildTeamRows('es')
      el('team-rows').querySelectorAll('tr').forEach((row, i) => {
        row.querySelector('.tx-input').value = TRANSLATIONS.es[i]
        row.querySelector('.tx-input').classList.add('filled')
        fillTeamMock(row, i, 'es')
        const ok = row.querySelector('[data-team-ok]')
        ok.classList.add('on')
        ok.textContent = '✓'
      })
      progress.es = TICKETS.length
    }

    const fillChinese = () => {
      buildPerspectiveTabs('zh')
      el('team-heading').textContent = 'Chinese localization'
      buildTeamRows('zh')
      el('team-rows').querySelectorAll('tr').forEach((row, i) => {
        row.querySelector('.tx-input').value = TRANSLATIONS.zh[i]
        row.querySelector('.tx-input').classList.add('filled')
        fillTeamMock(row, i, 'zh')
        const ok = row.querySelector('[data-team-ok]')
        ok.classList.add('on')
        ok.textContent = '✓'
      })
      progress.zh = TICKETS.length
    }

    const fillHindi = () => {
      buildPerspectiveTabs('hi')
      el('team-heading').textContent = 'Hindi localization'
      buildTeamRows('hi')
      el('team-rows').querySelectorAll('tr').forEach((row, i) => {
        row.querySelector('.tx-input').value = TRANSLATIONS.hi[i]
        row.querySelector('.tx-input').classList.add('filled')
        fillTeamMock(row, i, 'hi')
        const ok = row.querySelector('[data-team-ok]')
        ok.classList.add('on')
        ok.textContent = '✓'
      })
      progress.hi = TICKETS.length
    }

    const fillJapanese = () => {
      buildPerspectiveTabs('ja')
      el('team-heading').textContent = 'Japanese localization'
      buildTeamRows('ja')
      el('team-rows').querySelectorAll('tr').forEach((row, i) => {
        row.querySelector('.tx-input').value = TRANSLATIONS.ja[i]
        row.querySelector('.tx-input').classList.add('filled')
        fillTeamMock(row, i, 'ja')
        const ok = row.querySelector('[data-team-ok]')
        ok.classList.add('on')
        ok.textContent = '✓'
      })
      progress.ja = TICKETS.length
    }

    const fillFrench = () => {
      buildPerspectiveTabs('fr')
      el('team-heading').textContent = 'French localization'
      buildTeamRows('fr')
      el('team-rows').querySelectorAll('tr').forEach((row, i) => {
        row.querySelector('.tx-input').value = TRANSLATIONS.fr[i]
        row.querySelector('.tx-input').classList.add('filled')
        fillTeamMock(row, i, 'fr')
        const ok = row.querySelector('[data-team-ok]')
        ok.classList.add('on')
        ok.textContent = '✓'
      })
      progress.fr = TICKETS.length
    }

    if (step === 7) {
      fillSpanish()
      return
    }

    if (step === 8) {
      progress.es = TICKETS.length
      fillChinese()
      return
    }

    if (step === 9) {
      progress.es = TICKETS.length
      progress.zh = TICKETS.length
      fillJapanese()
      return
    }

    if (step === 10) {
      progress.es = TICKETS.length
      progress.zh = TICKETS.length
      progress.ja = TICKETS.length
      fillHindi()
      return
    }

    if (step === 11) {
      progress.es = TICKETS.length
      progress.zh = TICKETS.length
      progress.ja = TICKETS.length
      progress.hi = TICKETS.length
      fillFrench()
      return
    }

    if (step === 12) {
      progress.es = TICKETS.length
      progress.zh = TICKETS.length
      progress.ja = TICKETS.length
      progress.hi = TICKETS.length
      progress.fr = TICKETS.length
      el('loc-team').classList.add('hidden')
      el('loc-admin').classList.remove('hidden')
      buildPerspectiveTabs('admin')
      buildTeamGrid(progress)
      return
    }

    if (step === 13) {
      const empty = { es: 0, zh: 0, ja: 0, hi: 0, fr: 0 }
      el('loc-team').classList.add('hidden')
      el('loc-admin').classList.remove('hidden')
      buildPerspectiveTabs('admin')
      buildTeamGrid(empty)
      el('team-grid').classList.add('is-final-grow')
      requestAnimationFrame(() => {
        setTimeout(() => animateTeamGridToComplete(), 60)
        setTimeout(() => {
          el('team-grid').querySelectorAll('.team-card').forEach((card) => {
            card.style.outline = '1px solid var(--border-strong)'
          })
        }, TEAM_FINAL_ANIM_HOLD_MS + 80)
      })
    }
    } finally {
      setTimeout(() => syncDemoZoomForScrubberStep(step), 0)
    }
  }

  function buildSceneScrubber() {
    const host = el('scene-scrubber')
    if (!host) return
    host.querySelectorAll('button[data-scene]').forEach((b) => b.remove())
    SCENE_LABELS.forEach((label, idx) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.scene = String(idx)
      b.textContent = label
      b.addEventListener('click', () => applySceneStep(idx))
      host.appendChild(b)
    })
  }

  async function runLocWorkspaceDemoStep(g, progress, spec, langIndex) {
    if (langIndex === 0) {
      setDemoZoomImmediate(1, 50, 50)
    } else if (langIndex === 1) {
      startLocaleZoomSmoothPan()
    }

    buildPerspectiveTabs(spec.code)
    el('loc-admin').classList.add('hidden')
    el('loc-team').classList.remove('hidden')
    el('team-heading').textContent = spec.label
    buildTeamRows(spec.code)
    const tlist = TRANSLATIONS[spec.code]
    const rows = el('team-rows').querySelectorAll('tr')
    for (let i = 0; i < rows.length; i++) {
      if (!alive(g)) return false
      const tr = rows[i]
      tr.querySelector('.tx-input').value = tlist[i]
      tr.querySelector('.tx-input').classList.add('filled')
      fillTeamMock(tr, i, spec.code)
      if (spec.kind === 'two') {
        if (!(await pause(spec.p1, g))) return false
        tr.querySelector('[data-team-ok]').classList.add('on')
        tr.querySelector('[data-team-ok]').textContent = '✓'
        if (!(await pause(spec.p2, g))) return false
      } else {
        tr.querySelector('[data-team-ok]').classList.add('on')
        tr.querySelector('[data-team-ok]').textContent = '✓'
        if (!(await pause(spec.row, g))) return false
      }
    }
    progress[spec.code] = TICKETS.length
    return true
  }

  async function runDemo() {
    const g = ++runGen
    const progress = { es: 0, zh: 0, ja: 0, hi: 0, fr: 0 }

    setDemoVideoVisible(false)
    el('header-title').textContent = 'untitled_project'
    el('video-label').textContent = 'No file loaded'
    el('analysis-overlay').classList.remove('visible')
    stopAnalysisAsciiAnimation()
    el('progress-fill').style.width = '0%'
    el('mini-tickets').classList.add('hidden')
    el('demo-timeline').classList.add('hidden')
    el('table-placeholder').classList.remove('hidden')
    el('table-wrap').classList.remove('reveal-in')
    el('table-wrap').classList.add('hidden')
    el('btn-continue').classList.add('continue-off')
    el('ph-title').textContent = 'Tickets will appear here'
    el('ph-sub').textContent = 'Run analysis to extract on-screen text for the full film.'
    updateQueueCount(0, 0)

    document.querySelectorAll('#team-grid .team-card').forEach((c) => {
      c.style.outline = ''
    })
    el('team-grid').classList.remove('is-final-grow')

    setDemoZoomImmediate(1, 50, 50)

    setScene('empty')
    setCaption()
    if (!(await pause(EMPTY_HOME_HOLD_MS, g))) return
    startZoomToUploadDuring(ZOOM_TO_UPLOAD_MS)

    if (!(await pause(500, g))) return

    setCaption()
    if (!(await pause(700, g))) return

    el('header-title').textContent = 'sample_film.mov'
    el('video-label').textContent = 'sample_film.mov · stream preview (simulated)'
    setScene('workspace')
    setDemoVideoVisible(true)
    setCaption()

    el('ph-title').textContent = 'Scanning the full timeline…'
    el('ph-sub').textContent = 'Processing runs across the entire movie duration (demo).'
    el('analysis-overlay').classList.add('visible')
    startAnalysisAsciiAnimation()
    startZoomResetDuring(ANALYSIS_DURATION_MS)

    const durationMs = ANALYSIS_DURATION_MS
    const start = Date.now()
    await new Promise((resolve) => {
      const tick = () => {
        if (!alive(g)) return resolve()
        const t = Math.min(1, (Date.now() - start) / durationMs)
        el('progress-fill').style.width = `${analysisBarDisplayRatio(t) * 100}%`
        const mi = Math.min(ANALYSIS_MESSAGES.length - 1, Math.floor(t * ANALYSIS_MESSAGES.length))
        el('analysis-status').textContent = ANALYSIS_MESSAGES[mi]
        el('analysis-eta').textContent = '~' + Math.max(0, Math.ceil((durationMs - (Date.now() - start)) / 1000)) + 's'
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      tick()
    })
    if (!alive(g)) return

    el('progress-fill').style.width = '100%'
    el('analysis-status').textContent = ANALYSIS_MESSAGES[ANALYSIS_MESSAGES.length - 1]
    el('analysis-overlay').classList.remove('visible')
    stopAnalysisAsciiAnimation()
    setCaption()

    buildTicketRows()
    buildMiniList()
    el('mini-tickets').classList.remove('hidden')
    el('demo-timeline').classList.remove('hidden')
    renderTimeline(0)
    el('table-placeholder').classList.add('hidden')
    const tw = el('table-wrap')
    tw.classList.remove('hidden')
    tw.classList.add('reveal-in')

    el('mini-list').querySelectorAll('li').forEach((li, idx) => {
      li.classList.toggle('sel', idx === 0)
    })
    el('ticket-rows').querySelectorAll('tr').forEach((tr, idx) => {
      tr.classList.toggle('row-sel', idx === 0)
    })

    if (!(await pause(TICKETS_REVEAL_PAUSE_MS, g))) return

    setCaption()

    const rows = el('ticket-rows').querySelectorAll('tr')
    const approveZoomMs = rows.length * APPROVE_STAGGER_MS
    startZoomToTicketPanelDuring(approveZoomMs)

    for (let i = 0; i < rows.length; i++) {
      if (!alive(g)) return
      const chk = rows[i].querySelector('[data-approve]')
      chk.classList.add('on')
      chk.textContent = '✓'
      if (!(await pause(APPROVE_STAGGER_MS, g))) return
    }

    el('btn-continue').classList.remove('continue-off')
    requestAnimationFrame(() => {
      setTimeout(() => runTimelineApprovedCelebration(), 100)
    })
    setCaption()

    if (!(await pause(POST_APPROVE_PAUSE_MS, g))) return

    setScene('localization')
    el('loc-admin').classList.remove('hidden')
    el('loc-team').classList.add('hidden')
    buildPerspectiveTabs('admin')
    buildTeamGrid(progress)
    setCaption()

    startZoomResetDuring(ADMIN_LOC_HOLD_MS)

    if (!(await pause(ADMIN_LOC_HOLD_MS, g))) return

    setCaption()
    for (let li = 0; li < LOC_DEMO_SPECS.length; li++) {
      const ok = await runLocWorkspaceDemoStep(g, progress, LOC_DEMO_SPECS[li], li)
      if (!ok) return
      if (li < LOC_GAP_AFTER_LANG_MS.length) {
        if (!(await pause(LOC_GAP_AFTER_LANG_MS[li], g))) return
      }
      setCaption()
    }

    startFinalSceneZoomOutFromLocaleCorner(FINAL_SCENE_ZOOM_OUT_MS, FINAL_SCENE_ZOOM_OUT_EASE)

    buildPerspectiveTabs('admin')
    el('loc-team').classList.add('hidden')
    el('loc-admin').classList.remove('hidden')
    buildTeamGrid({ es: 0, zh: 0, ja: 0, hi: 0, fr: 0 })
    el('team-grid').classList.add('is-final-grow')
    requestAnimationFrame(() => {
      setTimeout(() => animateTeamGridToComplete(), 60)
    })
    if (!(await pause(TEAM_FINAL_ANIM_HOLD_MS, g))) return

    el('team-grid').querySelectorAll('.team-card').forEach((card) => {
      card.style.outline = '1px solid var(--border-strong)'
    })
    if (!(await pause(FINAL_SCENE_TAIL_MS, g))) return

    setCaption()

    if (opts.loop && alive(g)) {
      window.setTimeout(() => runDemo(), 900)
    }
  }

  const replayBtn = el('btn-replay')
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      runDemo()
    })
  }

  buildTeamGrid({ es: 0, zh: 0, ja: 0, hi: 0, fr: 0 })
  if (opts.showScrubber) {
    buildSceneScrubber()
  }
  initPlaceholderMedia().catch(() => {})
  runDemo()
})()
