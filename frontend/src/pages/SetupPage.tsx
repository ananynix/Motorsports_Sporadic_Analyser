import { useEffect, useState } from 'react'
import { useNavigate } from '../router'
import { useStore } from '../store/useStore'
import { TopNav } from '../components/TopNav'

type Mode = 'historical' | 'live'

export const SetupPage = () => {
  const { historicalIndex, fetchHistoricalIndex } = useStore()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('historical')
  const [eventSlug, setEventSlug] = useState('')
  const [driver, setDriver] = useState('')

  useEffect(() => {
    fetchHistoricalIndex()
  }, [fetchHistoricalIndex])

  const events = historicalIndex?.events ?? []
  const selectedEvent = events.find((e) => e.event_slug === eventSlug)
  const drivers = selectedEvent?.drivers ?? []

  const canStart = mode === 'live' || (eventSlug && driver)

  const handleStart = () => {
    if (mode === 'live') {
      navigate('/simulation', { state: { mode: 'live' } })
    } else {
      navigate('/simulation', { state: { mode: 'historical', eventSlug, driver, eventName: selectedEvent?.event_name } })
    }
  }

  return (
    <div className="min-h-screen bg-f1-dark text-white font-sans p-6 lg:p-10 bg-carbon">
      <TopNav />

      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight mb-2">
          Configure <span className="text-f1-red">Simulation</span>
        </h1>
        <p className="text-f1-muted text-sm mb-10">
          Pick a real 2024 race and driver to auto-play, or drop into the live demo session.
        </p>

        {/* Mode selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => setMode('historical')}
            className={`text-left p-6 rounded-lg border transition-all ${
              mode === 'historical'
                ? 'border-f1-red bg-f1-card shadow-lg shadow-f1-red/10'
                : 'border-f1-border bg-f1-card/50 opacity-60 hover:opacity-100'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-f1-red">2024 Season</span>
            <h3 className="text-xl font-bold mt-1 mb-2">Historical Simulation</h3>
            <p className="text-f1-muted text-sm">
              Auto-replays a real driver's fastest lap from any 2024 race weekend, firing
              simulated radio calls along the way for the analyser to diagnose.
            </p>
          </button>

          <button
            onClick={() => setMode('live')}
            className={`text-left p-6 rounded-lg border transition-all ${
              mode === 'live'
                ? 'border-f1-red bg-f1-card shadow-lg shadow-f1-red/10'
                : 'border-f1-border bg-f1-card/50 opacity-60 hover:opacity-100'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-f1-cyan">Demo</span>
            <h3 className="text-xl font-bold mt-1 mb-2">Live Session</h3>
            <p className="text-f1-muted text-sm">
              Streams the real-time Belgium GP mock session over WebSocket, exactly as it
              would run during an actual race broadcast.
            </p>
          </button>
        </div>

        {mode === 'historical' && (
          <div className="bg-f1-card border border-f1-border rounded-lg p-6 mb-10 animate-fade-in-up">
            {events.length === 0 ? (
              <p className="text-f1-muted italic">
                No historical data downloaded yet. Run backend/download_historical_season.py first.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-f1-muted mb-2 block">Race</span>
                  <select
                    className="w-full bg-f1-dark border border-f1-border text-white rounded px-3 py-3"
                    value={eventSlug}
                    onChange={(e) => { setEventSlug(e.target.value); setDriver('') }}
                  >
                    <option value="">Select a race...</option>
                    {events.map((e) => (
                      <option key={e.event_slug} value={e.event_slug}>
                        Round {e.round}: {e.event_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-f1-muted mb-2 block">Driver</span>
                  <select
                    className="w-full bg-f1-dark border border-f1-border text-white rounded px-3 py-3 disabled:opacity-40"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    disabled={!eventSlug}
                  >
                    <option value="">Select a driver...</option>
                    {drivers.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full md:w-auto bg-f1-red disabled:bg-f1-border disabled:cursor-not-allowed disabled:hover:scale-100 hover:bg-f1-redDark hover:scale-105 active:scale-95 transition-all duration-150 px-10 py-4 rounded-md font-bold uppercase tracking-wide text-base shadow-lg shadow-f1-red/20"
        >
          Start Simulation
        </button>
      </main>
    </div>
  )
}
