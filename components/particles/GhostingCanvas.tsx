"use client"

// ─── GhostingCanvas: Full-screen Canvas API particle dissolution ──────────────
// This component renders a fixed-position overlay canvas that handles
// the "Ghosting Sequence" — the signature Vibrant.design dissolution effect.
//
// When a card is ghosted, it decomposes into 20-30 particles with:
// - Random trajectories with gravity simulation
// - Stagger delay for organic feel
// - Delta-time physics for consistent speed across frame rates

import React, { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  rotation: number
  rotationSpeed: number
  color: string
  life: number      // 0..1 (1 = just born, 0 = dead)
  maxLife: number    // total lifetime in ms
  elapsed: number    // time elapsed
  gravity: number
}

interface GhostingEvent {
  particles: Particle[]
  startTime: number
}

export interface GhostingCanvasHandle {
  triggerGhosting: (originRect: DOMRect, color?: string) => void
}

const PARTICLE_COUNT = 25
const PARTICLE_LIFETIME_MIN = 600
const PARTICLE_LIFETIME_MAX = 1200
const GRAVITY = 0.08

const PARTICLE_COLORS = [
  "rgba(255, 68, 68, 0.8)",   // red
  "rgba(255, 208, 0, 0.7)",   // yellow
  "rgba(68, 136, 255, 0.6)",  // blue
  "rgba(240, 240, 245, 0.5)", // white
  "rgba(152, 152, 168, 0.4)", // muted
]

function createParticles(originRect: DOMRect, color?: string): Particle[] {
  const particles: Particle[] = []
  const cx = originRect.left + originRect.width / 2
  const cy = originRect.top + originRect.height / 2

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5
    const speed = 1.5 + Math.random() * 3
    const maxLife = PARTICLE_LIFETIME_MIN + Math.random() * (PARTICLE_LIFETIME_MAX - PARTICLE_LIFETIME_MIN)

    particles.push({
      x: cx + (Math.random() - 0.5) * originRect.width * 0.6,
      y: cy + (Math.random() - 0.5) * originRect.height * 0.4,
      vx: Math.cos(angle) * speed * (0.5 + Math.random()),
      vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 2, // upward bias
      size: 2 + Math.random() * 5,
      opacity: 0.7 + Math.random() * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      color: color ?? PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      life: 1,
      maxLife,
      elapsed: -i * 10, // Stagger delay: 10ms between each particle
      gravity: GRAVITY * (0.8 + Math.random() * 0.4),
    })
  }

  return particles
}

const GhostingCanvas = forwardRef<GhostingCanvasHandle>(function GhostingCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventsRef = useRef<GhostingEvent[]>([])
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const isRunningRef = useRef(false)

  const triggerGhosting = useCallback((originRect: DOMRect, color?: string) => {
    const particles = createParticles(originRect, color)
    eventsRef.current.push({
      particles,
      startTime: performance.now(),
    })

    if (!isRunningRef.current) {
      isRunningRef.current = true
      lastTimeRef.current = performance.now()
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [])

  useImperativeHandle(ref, () => ({ triggerGhosting }), [triggerGhosting])

  const animate = useCallback((now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Handle DPI
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== window.innerWidth * dpr || canvas.height !== window.innerHeight * dpr) {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }

    const dt = Math.min(now - lastTimeRef.current, 50) // Cap delta to prevent jumps
    lastTimeRef.current = now

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    let hasAlive = false

    for (const event of eventsRef.current) {
      for (const p of event.particles) {
        p.elapsed += dt

        // Skip if still in stagger delay
        if (p.elapsed < 0) {
          hasAlive = true
          continue
        }

        const progress = p.elapsed / p.maxLife
        if (progress >= 1) continue

        hasAlive = true

        // Physics update
        p.vy += p.gravity * (dt / 16) // Gravity
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.rotation += p.rotationSpeed * (dt / 16)

        // Friction
        p.vx *= 0.995
        p.vy *= 0.995

        // Life decay
        p.life = 1 - progress
        const fadeOut = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1
        const currentOpacity = p.opacity * fadeOut * p.life
        const currentSize = p.size * (0.3 + p.life * 0.7)

        // Draw particle
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = currentOpacity

        // Glow effect
        ctx.shadowColor = p.color
        ctx.shadowBlur = currentSize * 2

        ctx.fillStyle = p.color
        ctx.beginPath()

        // Mix of shapes: circles and rounded rects
        if (p.size > 4) {
          // Rounded rect for larger particles
          const s = currentSize
          ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.3)
        } else {
          // Circle for smaller particles
          ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2)
        }

        ctx.fill()
        ctx.restore()
      }
    }

    // Clean up dead events
    eventsRef.current = eventsRef.current.filter(event =>
      event.particles.some(p => p.elapsed < p.maxLife)
    )

    if (hasAlive) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      isRunningRef.current = false
      // Clear canvas one last time
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }

    window.addEventListener("resize", handleResize)
    handleResize()
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  )
})

GhostingCanvas.displayName = "GhostingCanvas"

export default GhostingCanvas
