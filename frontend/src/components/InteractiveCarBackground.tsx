import { useEffect, useRef, useState } from 'react'

// Original, generic top-down open-wheel silhouette -- deliberately not any
// real team's livery, sponsor marks, or number -- just enough car-shaped
// geometry to read as "F1 car" for a decorative background element.
const CarSilhouette = () => (
  <svg viewBox="0 0 240 500" className="w-full h-full drop-shadow-[0_0_40px_rgba(225,6,0,0.25)]">
    {/* rear wing */}
    <rect x="35" y="430" width="170" height="16" rx="4" fill="#1A1A1A" stroke="#E10600" strokeWidth="2" />
    <rect x="35" y="446" width="10" height="24" fill="#1A1A1A" />
    <rect x="195" y="446" width="10" height="24" fill="#1A1A1A" />
    {/* rear wheels */}
    <rect x="24" y="335" width="34" height="72" rx="10" fill="#0a0a0a" stroke="#333333" strokeWidth="2" />
    <rect x="182" y="335" width="34" height="72" rx="10" fill="#0a0a0a" stroke="#333333" strokeWidth="2" />
    {/* sidepods */}
    <path d="M75 190 L70 300 L95 320 L95 190 Z" fill="#1A1A1A" stroke="#333333" strokeWidth="2" />
    <path d="M165 190 L170 300 L145 320 L145 190 Z" fill="#1A1A1A" stroke="#333333" strokeWidth="2" />
    {/* main body */}
    <path
      d="M120 40 L134 70 L142 160 L138 330 L150 420 L120 460 L90 420 L102 330 L98 160 L106 70 Z"
      fill="#1A1A1A"
      stroke="#E10600"
      strokeWidth="3"
    />
    {/* cockpit / halo */}
    <ellipse cx="120" cy="230" rx="16" ry="38" fill="#0a0a0a" stroke="#E10600" strokeWidth="2" />
    {/* front wheels */}
    <rect x="18" y="120" width="32" height="66" rx="10" fill="#0a0a0a" stroke="#333333" strokeWidth="2" />
    <rect x="190" y="120" width="32" height="66" rx="10" fill="#0a0a0a" stroke="#333333" strokeWidth="2" />
    {/* front wing */}
    <rect x="16" y="34" width="208" height="14" rx="4" fill="#1A1A1A" stroke="#E10600" strokeWidth="2" />
    <rect x="16" y="20" width="10" height="20" fill="#1A1A1A" />
    <rect x="214" y="20" width="10" height="20" fill="#1A1A1A" />
    {/* nose tip */}
    <path d="M120 14 L128 40 L112 40 Z" fill="#E10600" />
  </svg>
)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Landing-page decoration: the car drifts and tilts toward wherever the
// mouse goes on the page (a subtle parallax/tilt effect). No animation
// library involved -- just a target position updated on mousemove and a
// requestAnimationFrame loop that eases the rendered position toward it
// (simple exponential smoothing), applied via a direct style write on the
// element ref so easing doesn't need a React re-render every frame. A
// toggle lets motion-sensitive users (or anyone who finds it distracting)
// turn it off -- disabled by default when the OS reports
// prefers-reduced-motion.
export const InteractiveCarBackground = () => {
  const [enabled, setEnabled] = useState(() => !prefersReducedMotion())
  const carRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled) {
      target.current = { x: 0, y: 0 }
    }
    const handleMove = (e: MouseEvent) => {
      if (!enabled) return
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      target.current = { x: (e.clientX - cx) * 0.12, y: (e.clientY - cy) * 0.08 }
    }
    window.addEventListener('mousemove', handleMove)

    let raf: number
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.08
      current.current.y += (target.current.y - current.current.y) * 0.08
      const rotate = Math.max(-10, Math.min(10, current.current.x / 12))
      if (carRef.current) {
        carRef.current.style.transform =
          `translate(-50%, -50%) translate(${current.current.x}px, ${current.current.y}px) rotate(${rotate}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div
        ref={carRef}
        className={`absolute top-1/2 left-1/2 w-[min(60vw,520px)] opacity-25 ${enabled ? '' : 'animate-[float-idle_5s_ease-in-out_infinite]'}`}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <CarSilhouette />
      </div>

      <button
        onClick={() => setEnabled((v) => !v)}
        className="pointer-events-auto absolute bottom-6 right-6 z-10 bg-black/50 border border-f1-border text-f1-muted hover:text-white text-xs font-bold uppercase tracking-wide px-3 py-2 rounded backdrop-blur-sm transition-colors"
      >
        Motion: {enabled ? 'On' : 'Off'}
      </button>
    </div>
  )
}
