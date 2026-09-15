import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '../router'
import { useStore } from '../store/useStore'
import type { TelemetryPoint, FusedInsight } from '../store/useStore'
import { TopNav } from '../components/TopNav'
import { TrackMap } from '../components/TrackMap'
import { headingFromTrail } from '../utils/heading'
import { SpeedRpmChart, BrakeTireChart } from '../components/TelemetryCharts'
import { RecommendationSidebar } from '../components/RecommendationSidebar'

const MIN_ANALYZE_INDEX = 19 // TCN needs a full 20-point window (dl_model.py seq_length)
const PLAYBACK_INTERVAL_MS = 100 // 10Hz, matches the live demo's own pacing

// Historical data has no captured radio audio/transcripts (FastF1 doesn't
// expose team radio) -- the live demo path has the exact same nature
// (mock_generator.py's own list below is canned, not real captured audio),
// so auto-firing from this list against real telemetry is exactly as honest
// as the existing live session already is.
const CANNED_TRANSCRIPTS = [
  "I don't feel my rear floor entirely.",
  "The rear just doesn't feel planted through the fast stuff.",
  "Car's bouncing like crazy down the straight.",
  "I'm losing grip on the rears.",
  "Max: Tires are dropping off, no grip in sector 2.",
  "Front left is graining a bit, let's keep an eye on it.",
  "Brake pedal is getting long.",
  "Engine temp is a bit high, harvest on the straights.",
  "Box this lap, box this lap.",
  "Copy that, push now, push now.",
  "The car feels great, maintaining pace.",
]

type Mode = 'historical' | 'live'
interface LocationState {
  mode: Mode;
  eventSlug?: string;
  driver?: string;
  eventName?: string;
}

type Tab = 'track' | 'graphs'

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)

export const SimulationPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as LocationState) || { mode: 'live' as Mode }
  const mode = state.mode

  const [tab, setTab] = useState<Tab>('track')

  const { liveTelemetry, fusedInsights, isSessionOver, telemetryStatus, insightsStatus } = useStore()

  // ---- Historical mode: local auto-play state ----
  const [fullLap, setFullLap] = useState<TelemetryPoint[] | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [historicalInsights, setHistoricalInsights] = useState<FusedInsight[]>([])
  const [historicalComplete, setHistoricalComplete] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const replayIndexRef = useRef(0)
  const transcriptCursorRef = useRef(0)
  const firingRef = useRef(false)

  useEffect(() => {
    if (mode === 'historical' && (!state.eventSlug || !state.driver)) {
      navigate('/setup', { replace: true })
    }
  }, [mode, state.eventSlug, state.driver, navigate])

  useEffect(() => {
    replayIndexRef.current = replayIndex
  }, [replayIndex])

  // Load the chosen lap once.
  useEffect(() => {
    if (mode !== 'historical' || !state.eventSlug || !state.driver) return
    let cancelled = false
    fetch(`http://localhost:8000/api/historical/telemetry/${state.eventSlug}/${state.driver}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then((data: TelemetryPoint[]) => {
        if (cancelled) return
        setFullLap(data.map((p, i) => ({ ...p, ts: i })))
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load telemetry for this driver/event.')
      })
    return () => { cancelled = true }
  }, [mode, state.eventSlug, state.driver])

  // 10Hz playback ticker.
  useEffect(() => {
    if (mode !== 'historical' || !fullLap || historicalComplete) return
    const id = setInterval(() => {
      setReplayIndex((i) => {
        if (i + 1 >= fullLap.length) {
          setHistoricalComplete(true)
          return i
        }
        return i + 1
      })
    }, PLAYBACK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [mode, fullLap, historicalComplete])

  // Radio-call scheduler: fires on a randomized 8-12s cadence, matching
  // mock_generator.py's own _generate_sporadic_audio cadence, calling the
  // same historical analyze endpoint HistoricalReplay.tsx used to call
  // manually -- here it's automatic, per the auto-play simulation design.
  useEffect(() => {
    if (mode !== 'historical' || !fullLap || historicalComplete) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const scheduleNext = () => {
      const delay = (8 + Math.random() * 4) * 1000
      timer = setTimeout(async () => {
        if (cancelled) return
        const idx = replayIndexRef.current
        if (idx >= MIN_ANALYZE_INDEX && idx < fullLap.length - 5 && !firingRef.current) {
          firingRef.current = true
          const transcript = CANNED_TRANSCRIPTS[transcriptCursorRef.current % CANNED_TRANSCRIPTS.length]
          transcriptCursorRef.current += 1
          try {
            const res = await fetch(
              `http://localhost:8000/api/historical/analyze/${state.eventSlug}/${state.driver}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ at_index: idx, transcript }),
              }
            )
            if (res.ok) {
              const data: FusedInsight = await res.json()
              if (!cancelled) setHistoricalInsights((prev) => [data, ...prev])
            }
          } catch (e) {
            console.error('Automatic radio call analysis failed', e)
          }
          firingRef.current = false
        }
        if (!cancelled) scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [mode, fullLap, historicalComplete, state.eventSlug, state.driver])

  const isHistorical = mode === 'historical'
  const visibleData = isHistorical ? (fullLap ? fullLap.slice(0, replayIndex + 1) : []) : liveTelemetry
  const insights = isHistorical ? historicalInsights : fusedInsights
  const complete = isHistorical ? historicalComplete : isSessionOver
  const latestInsight = insights[0]

  const currentSpeed = visibleData.length > 0 ? visibleData[visibleData.length - 1].speed : 0
  const avgSpeed = average(visibleData.map((p) => p.speed))

  const historicalHeading = fullLap ? headingFromTrail(fullLap.slice(Math.max(0, replayIndex - 1), replayIndex + 1)) : 0

  const handleViewReport = () => {
    navigate('/report', {
      state: {
        mode,
        insights,
        telemetry: visibleData,
        eventSlug: state.eventSlug,
        eventName: state.eventName,
        driver: state.driver,
      },
    })
  }

  return (
    <div className="min-h-screen bg-f1-dark text-white font-sans p-6 lg:p-8 bg-carbon">
      <TopNav statuses={mode === 'live' ? { telemetry: telemetryStatus, insights: insightsStatus } : undefined} />

      {isHistorical && loadError && (
        <div className="max-w-4xl mx-auto mb-6 bg-f1-red/10 border border-f1-red/40 text-f1-red rounded p-4 text-sm">
          {loadError}
        </div>
      )}

      {complete && (
        <div className="mb-6 bg-f1-green/10 border border-f1-green/40 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-f1-green font-bold uppercase tracking-wide text-sm mb-1">Simulation Complete</h3>
            <p className="text-f1-muted text-sm">
              {insights.length} radio call{insights.length === 1 ? '' : 's'} diagnosed. View the full session report.
            </p>
          </div>
          <button
            onClick={handleViewReport}
            className="bg-f1-green hover:bg-[#25a85c] transition-colors text-black px-6 py-3 rounded-md font-bold uppercase tracking-wide text-sm whitespace-nowrap"
          >
            View Report
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main content: track / graphs sub-tabs */}
        <section className="xl:col-span-2 bg-f1-card border border-f1-border rounded-lg p-6 shadow-lg shadow-black/50">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('track')}
                className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wide transition-colors ${tab === 'track' ? 'bg-f1-red text-white' : 'bg-[#222222] text-f1-muted hover:text-white'}`}
              >
                Track
              </button>
              <button
                onClick={() => setTab('graphs')}
                className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wide transition-colors ${tab === 'graphs' ? 'bg-f1-red text-white' : 'bg-[#222222] text-f1-muted hover:text-white'}`}
              >
                Telemetry Graphs
              </button>
            </div>
            {isHistorical && fullLap && (
              <span className="text-f1-muted text-xs font-mono">
                {state.driver} &middot; {state.eventName} &middot; point {replayIndex + 1}/{fullLap.length}
              </span>
            )}
          </div>

          {tab === 'track' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 w-full min-h-[420px] bg-f1-dark p-4 rounded border border-f1-border">
                {isHistorical ? (
                  <TrackMap
                    pathData={fullLap ?? []}
                    positionData={fullLap ? [fullLap[replayIndex]] : []}
                    label={state.driver}
                    heading={historicalHeading}
                  />
                ) : (
                  <TrackMap />
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-f1-dark border border-f1-border rounded-lg p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-f1-muted mb-3">Current Pace</h4>
                  <p className="text-4xl font-black">{Math.round(currentSpeed)} <span className="text-base font-normal text-f1-muted">km/h</span></p>
                  <p className="text-f1-muted text-xs mt-1">Avg so far: {Math.round(avgSpeed)} km/h</p>
                </div>

                {latestInsight?.recommendation_delta ? (
                  <div className="bg-f1-green/10 border border-f1-green/40 rounded-lg p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-f1-green mb-3">If Addressed</h4>
                    <p className="text-3xl font-black text-f1-green">
                      +{latestInsight.recommendation_delta.delta} <span className="text-sm font-normal">{latestInsight.recommendation_delta.unit}</span>
                    </p>
                    <p className="text-f1-muted text-xs mt-1">
                      projected {latestInsight.recommendation_delta.channel} recovery by end of forecast
                      (illustrative, not a simulated fix)
                    </p>
                  </div>
                ) : (
                  <div className="bg-f1-dark border border-f1-border rounded-lg p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-f1-muted mb-3">If Addressed</h4>
                    <p className="text-f1-muted text-sm italic">No active recommendation to compare against yet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto feed-scrollbar pb-2">
              <div className="flex gap-6" style={{ minWidth: '900px' }}>
                <div className="flex-shrink-0" style={{ width: '520px' }}>
                  <SpeedRpmChart
                    data={visibleData}
                    predicted={latestInsight?.predicted_telemetry}
                    recommended={latestInsight?.recommended_telemetry}
                  />
                </div>
                <div className="flex-shrink-0" style={{ width: '520px' }}>
                  <BrakeTireChart
                    data={visibleData}
                    predicted={latestInsight?.predicted_telemetry}
                    recommended={latestInsight?.recommended_telemetry}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Persistent right sidebar -- shared by both tabs above */}
        <div className="xl:col-span-1 h-[600px] xl:h-auto">
          <RecommendationSidebar insights={insights} />
        </div>
      </div>
    </div>
  )
}
