import { useEffect } from 'react'
import { useLocation } from './router'
import { useStore } from './store/useStore'
import { useWebSocketConnection } from './hooks/useWebSocketConnection'
import { LandingPage } from './pages/LandingPage'
import { SetupPage } from './pages/SetupPage'
import { SimulationPage } from './pages/SimulationPage'
import { ReportPage } from './pages/ReportPage'

function App() {
  const {
    addTelemetry, addFusedInsight, setSessionOver,
    setTelemetryStatus, setInsightsStatus,
    fetchTrackLayout,
  } = useStore()

  useEffect(() => {
    fetchTrackLayout()
  }, [fetchTrackLayout])

  // Mounted here, at the router root, so the Live Session's data keeps
  // flowing into the store regardless of which page is currently active --
  // raw telemetry and fused AI insights stay on separate sockets so one
  // connection's failure/reconnect behavior can't affect the other.
  useWebSocketConnection(
    'ws://localhost:8000/ws/telemetry',
    (data) => {
      if (data.type === 'session_complete') {
        setSessionOver(true)
      } else {
        addTelemetry(data)
      }
    },
    setTelemetryStatus,
  )

  useWebSocketConnection(
    'ws://localhost:8000/ws/insights',
    (data) => {
      if (data.type === 'fused_insight') {
        addFusedInsight(data.payload)
      }
    },
    setInsightsStatus,
  )

  const { pathname } = useLocation()

  switch (pathname) {
    case '/setup':
      return <SetupPage />
    case '/simulation':
      return <SimulationPage />
    case '/report':
      return <ReportPage />
    default:
      return <LandingPage />
  }
}

export default App
