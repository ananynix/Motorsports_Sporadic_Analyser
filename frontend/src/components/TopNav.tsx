import { Link, useLocation } from '../router'
import type { ConnectionStatus } from '../hooks/useWebSocketConnection'
import { F1Logo } from './F1Logo'

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  live: 'bg-f1-cyan',
  connecting: 'bg-f1-orange',
  disconnected: 'bg-f1-red',
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  live: 'Live',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
}

export const StatusIndicator = ({ label, status }: { label: string; status: ConnectionStatus }) => (
  <div className="flex items-center gap-2 text-xs text-f1-muted">
    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
    <span>{label}: {STATUS_LABEL[status]}</span>
  </div>
)

const NAV_LINKS = [
  { to: '/setup', label: 'Setup' },
  { to: '/simulation', label: 'Simulation' },
  { to: '/report', label: 'Report' },
]

interface TopNavProps {
  statuses?: { telemetry: ConnectionStatus; insights: ConnectionStatus };
}

export const TopNav = ({ statuses }: TopNavProps) => {
  const location = useLocation()

  return (
    <header className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8 pb-4 border-b border-f1-border">
      <Link to="/" className="flex items-center gap-4 group">
        <F1Logo className="h-8 lg:h-10 transition-transform group-hover:scale-105" />
        <span className="text-lg lg:text-2xl font-black tracking-tight uppercase">
          Sporadic <span className="text-f1-red">Analyser</span>
        </span>
      </Link>

      <nav className="flex items-center gap-2">
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wide transition-colors ${
              location.pathname === to ? 'bg-f1-red text-white' : 'bg-[#222222] text-f1-muted hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {statuses && (
        <div className="flex flex-col gap-2">
          <StatusIndicator label="Telemetry" status={statuses.telemetry} />
          <StatusIndicator label="Insights" status={statuses.insights} />
        </div>
      )}
    </header>
  )
}
