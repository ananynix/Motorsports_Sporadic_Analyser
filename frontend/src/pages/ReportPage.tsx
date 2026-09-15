import { useLocation, useNavigate } from '../router'
import type { FusedInsight, TelemetryPoint } from '../store/useStore'
import SessionReport from '../components/SessionReport'

type Mode = 'historical' | 'live'
interface LocationState {
  mode?: Mode;
  insights?: FusedInsight[];
  telemetry?: TelemetryPoint[];
  eventSlug?: string;
  eventName?: string;
  driver?: string;
}

export const ReportPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as LocationState) || {}

  const title = state.mode === 'historical'
    ? (state.eventName ?? 'Historical Session')
    : 'Belgium GP (Live Demo)'
  const subtitle = state.mode === 'historical'
    ? `Post-Session Telemetry & Tactical Comm-Link Breakdown -- ${state.driver ?? 'Unknown Driver'}`
    : 'Post-Session Telemetry & Tactical Comm-Link Breakdown'

  const handleBack = () => {
    navigate('/simulation', {
      state: {
        mode: state.mode ?? 'live',
        eventSlug: state.eventSlug,
        driver: state.driver,
        eventName: state.eventName,
      },
    })
  }

  return (
    <SessionReport
      insights={state.insights}
      telemetry={state.telemetry}
      title={title}
      subtitle={subtitle}
      onBack={handleBack}
    />
  )
}
