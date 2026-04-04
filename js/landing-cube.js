/**
 * ASCII cube — same behavior as demos/tlocal-cube-interactive.html (symbol mode @#$%&,
 * pointer trail with letter ripple on hover).
 */
;(function () {
  const pattern = `
    
    
                                         @@@@@@@                                        
                                     @@@@@@@@@@@@@                                      
                                  @@@@@@@@    @@@@@@@                                   
                               @@@@@@@      @@@@@@@@@@@@@                               
                            @@@@@@@      @@@@@@@@   @@@@@@@@                            
                         @@@@@@@@@@@@@@@@@@@@          @@@@@@@@                         
                     @@@@@@@@  @@@@@@@@@@@                 @@@@@@@                      
                  @@@@@@@      @@@@@@@@                       @@@@@@@                   
               @@@@@@@      @@@@@@@@                             @@@@@@@@               
            @@@@@@@@@    @@@@@@@                                    @@@@@@@@            
         @@@@@@@@@@@@@@@@@@@@                                           @@@@@@@         
     @@@@@@@      @@@@@@@@                                                @@@@@@@@      
  @@@@@@@      @@@@@@@@                                                  @@@@@@@@@@@@   
@@@@@@@     @@@@@@@                                                  @@@@@@@@    @@@@@@@
@@@@@@@@@@@@@@@@                                                  @@@@@@@@     @@@@@@@@@
@@@@@@@@@@@@@@                                                 @@@@@@@@     @@@@@@@@@@@@
@@@@@@@@@@@@@@@                                             @@@@@@@@@@@  @@@@@@@@@@@@@@@
@@@  @@@@@@@@@@@@@@                                     @@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@@@@@@@@@@@@@                               @@@@@@@@      @@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@  @@@@@@@@@@@@@                         @@@@@@@@      @@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@     @@@@@@@@@@@@@                   @@@@@@@@@    @@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@        @@@@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@           @@@@@@@@@@@@@@     @@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                  @@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@ @@@@@@                        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@  @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@ @@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  @@@@@@@@@                       @@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  
      @@@@@@@@                    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     
         @@@@@@@@                 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@        
            @@@@@@@@              @@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@            
               @@@@@@@@           @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@               
                  @@@@@@@@        @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@                  
                      @@@@@@@@    @@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@                     
                         @@@@@@@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@                        
                            @@@@@@@@@@   @@@@@@@@@@@@@@@@@@@                            
                               @@@@@@@@  @@@@@@@@@@@@@@@@                               
                                  @@@@@@@@@@@@@@@@@@@@                                  
                                      @@@@@@@@@@@@@                                     
                                         @@@@@@@                                        `

  const symbols = ['@', '#', '$', '%', '&']

  const container = document.getElementById('ascii-cube')
  if (!container) return

  const rawLines = pattern.split('\n')
  const isBlank = (s) => s.length === 0 || /^\s+$/.test(s)
  let x = 0
  while (x < rawLines.length && isBlank(rawLines[x])) x++
  let y = rawLines.length
  while (y > x && isBlank(rawLines[y - 1])) y--
  const lines = rawLines.slice(x, y)
  let tick = 0

  const LETTERS = ['t', 'l', 'o', 'c', 'a', 'l']
  const DROP_CHARS = ['·', '.', 'o', 'c', 'a']
  const RIPPLE_RADIUS_PX = 24
  const RADIUS_IDLE = 0.55
  const RADIUS_SPEED_REF = 520
  const RADIUS_SPEED_CAP = 1.15
  const RADIUS_SPEED_GAIN = 0.36
  const TRAIL_MAX_AGE_MS = 420
  const DROP_LIFE_MS = 380

  let trail = []
  let drops = []
  let pointerInside = false
  let charMetrics = { w: 7, h: 7 }
  let lastPointer = null
  let smoothedSpeedPx = 0

  function updateCharMetrics() {
    const cs = getComputedStyle(container)
    const probe = document.createElement('span')
    probe.textContent = '@'
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;' +
      `font:${cs.font};font-weight:${cs.fontWeight};line-height:${cs.lineHeight}`
    container.appendChild(probe)
    charMetrics = { w: probe.offsetWidth, h: probe.offsetHeight }
    probe.remove()
  }

  function pruneTrail() {
    const now = performance.now()
    while (trail.length && now - trail[0].t > TRAIL_MAX_AGE_MS) trail.shift()
    while (drops.length && now - drops[0].t > DROP_LIFE_MS) drops.shift()
  }

  function recordTrail(col, row, vxPx, vyPx, speedPx) {
    const now = performance.now()
    const last = trail[trail.length - 1]
    if (last && last.col === col && last.row === row) {
      last.t = now
      last.vx = vxPx
      last.vy = vyPx
      last.speed = speedPx
      return
    }
    trail.push({ col, row, t: now, vx: vxPx, vy: vyPx, speed: speedPx })
    if (trail.length > 100) trail.shift()
  }

  function distPxToSample(c, r, p) {
    const w = charMetrics.w
    const h = charMetrics.h
    const nx = (c + 0.5) * w - (p.col + 0.5) * w
    const ny = (r + 0.5) * h - (p.row + 0.5) * h
    const vlen = Math.hypot(p.vx || 0, p.vy || 0)
    const sp = p.speed || 0
    if (vlen > 22) {
      const ux = (p.vx || 0) / vlen
      const uy = (p.vy || 0) / vlen
      const para = nx * ux + ny * uy
      const perp = nx * -uy + ny * ux
      const wake = 1 + Math.min(sp / 400, 2.2) * 1.15
      const crossTight = 0.82 + Math.min(sp / 520, 1.3) * 0.4
      return Math.hypot(para / wake, perp * crossTight)
    }
    return Math.hypot(nx, ny)
  }

  function radiusForSample(p) {
    const sp = p.speed || 0
    const boost = Math.min(sp / RADIUS_SPEED_REF, RADIUS_SPEED_CAP)
    return RIPPLE_RADIUS_PX * (RADIUS_IDLE + boost * RADIUS_SPEED_GAIN)
  }

  function buildBase() {
    return lines.map((line, lineIndex) => {
      const sym = symbols[(tick + lineIndex) % symbols.length]
      return line.replace(/@/g, sym)
    })
  }

  function render() {
    pruneTrail()

    const base = buildBase()

    if (!pointerInside && trail.length === 0 && drops.length === 0) {
      container.textContent = base.join('\n')
      return
    }

    const useBangHover = false

    const now = performance.now()
    const out = base.map((line, r) => {
      const chars = [...line]
      for (let c = 0; c < chars.length; c++) {
        if (chars[c] === ' ') continue

        let best = null
        let minD = Infinity
        let bestRadius = 0
        let fromDrop = false

        for (const p of trail) {
          const rp = radiusForSample(p)
          const d = distPxToSample(c, r, p)
          if (d <= rp && d < minD) {
            minD = d
            best = p
            bestRadius = rp
          }
        }

        if (!best) {
          const cw = charMetrics.w
          const ch = charMetrics.h
          for (const d of drops) {
            const age = now - d.t
            const rad = RIPPLE_RADIUS_PX * 0.3 * (1 - (age / DROP_LIFE_MS) * 0.45)
            if (rad < 2.5) continue
            const dist = Math.hypot((c - d.col) * cw, (r - d.row) * ch)
            if (dist <= rad && dist < minD) {
              minD = dist
              best = d
              bestRadius = rad
              fromDrop = true
            }
          }
        }

        if (!best || minD > bestRadius) continue

        if (fromDrop) {
          if (useBangHover) {
            chars[c] = '!'
          } else {
            const age = now - best.t
            const ring = Math.round((minD / charMetrics.w) * 3)
            const wave = (tick + ring + Math.floor(age / 90) + (c + r) * 2) % DROP_CHARS.length
            chars[c] = DROP_CHARS[wave]
          }
          continue
        }

        if (useBangHover) {
          chars[c] = '!'
          continue
        }

        const dx = c - best.col
        const dy = r - best.row
        const ring = Math.round((minD / charMetrics.w) * 2.4)
        const age = now - best.t
        const organic = Math.sin((c + r + tick) * 0.9 + age * 0.004) * 0.8
        const wave =
          (tick +
            ring +
            (dx + dy + 64) * 3 +
            Math.floor(age / 140) +
            Math.floor(organic)) %
          LETTERS.length
        chars[c] = LETTERS[wave]
      }
      return chars.join('')
    })

    container.textContent = out.join('\n')
  }

  function animate() {
    render()
    tick = (tick + 1) % symbols.length
    setTimeout(animate, 120)
  }

  function onPointer(e) {
    const rect = container.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / charMetrics.w)
    const row = Math.floor((e.clientY - rect.top) / charMetrics.h)
    const now = performance.now()

    let vxPx = 0
    let vyPx = 0
    let instSpeed = 0
    if (lastPointer) {
      const dt = Math.max(5, now - lastPointer.t) / 1000
      vxPx = (e.clientX - lastPointer.x) / dt
      vyPx = (e.clientY - lastPointer.y) / dt
      instSpeed = Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) / dt
    }
    smoothedSpeedPx = smoothedSpeedPx * 0.78 + instSpeed * 0.22
    lastPointer = { x: e.clientX, y: e.clientY, t: now }

    recordTrail(col, row, vxPx, vyPx, smoothedSpeedPx)

    if (instSpeed > 380 && Math.random() < 0.11) {
      const ox = (Math.random() - 0.5) * 3.2
      const oy = (Math.random() - 0.5) * 2.4
      drops.push({
        col: Math.round(col + ox),
        row: Math.round(row + oy),
        t: now,
      })
      if (drops.length > 24) drops.shift()
    }
    if (instSpeed > 720 && Math.random() < 0.18) {
      drops.push({
        col: col + (Math.random() > 0.5 ? 1 : -1),
        row: row + (Math.random() > 0.5 ? 1 : -1),
        t: now,
      })
    }

    render()
  }

  container.addEventListener('mousemove', onPointer)
  container.addEventListener('mouseenter', (e) => {
    pointerInside = true
    onPointer(e)
  })
  container.addEventListener('mouseleave', () => {
    pointerInside = false
    lastPointer = null
    smoothedSpeedPx = 0
    render()
  })

  window.addEventListener('resize', () => {
    updateCharMetrics()
    render()
  })

  updateCharMetrics()
  animate()
  requestAnimationFrame(() => {
    updateCharMetrics()
    render()
  })
})()
