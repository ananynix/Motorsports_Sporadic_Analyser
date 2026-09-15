import type { FusedInsight } from '../store/useStore'

// snake_case -> readable label, with a few acronyms kept upper-case (ERS).
const formatComponentLabel = (component: string): string =>
  component
    .split('_')
    .map(word => (word.toLowerCase() === 'ers' ? 'ERS' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')

interface RecommendationSidebarProps {
  insights: FusedInsight[];
  title?: string;
  emptyLabel?: string;
}

// Shared by SimulationPage's live and historical modes -- extracted from the
// original App.tsx tactical-insights-feed markup (same styling/behavior),
// parameterized over a generic insights list so both data sources can feed
// the same persistent sidebar without remounting it on tab switches.
export const RecommendationSidebar = ({
  insights,
  title = 'Tactical Insights Feed',
  emptyLabel = 'Waiting for tactical comms...',
}: RecommendationSidebarProps) => (
  <section className="bg-f1-card border border-f1-border rounded-lg p-6 shadow-lg shadow-black/50 flex flex-col h-full">
    <h2 className="text-xl text-f1-muted mb-6 font-bold uppercase tracking-wide flex items-center gap-2">
      <span className="inline-block w-2 h-6 bg-f1-red rounded-sm" />
      {title}
    </h2>

    <div className="flex-1 overflow-y-auto pr-2 space-y-4 feed-scrollbar">
      {insights.length === 0 ? (
        <p className="text-f1-muted italic text-center mt-10">{emptyLabel}</p>
      ) : (
        insights.map((insight, idx) => {
          const isCritical = insight.severity === 'High' || insight.transcript.toLowerCase().includes('puncture')
          const borderColor = isCritical ? 'border-l-f1-red' : (insight.severity === 'Medium' ? 'border-l-f1-orange' : 'border-l-f1-cyan')
          const insightColor = isCritical ? 'text-f1-red' : (insight.severity === 'Medium' ? 'text-f1-orange' : 'text-f1-cyan')

          return (
            <div key={idx} className={`bg-f1-dark p-4 rounded-r-md border-l-4 ${borderColor} shadow-md transition-transform hover:translate-x-0.5`}>
              {insight.affected_component && insight.affected_component !== 'none' && (
                <div className="mb-3">
                  <span className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-black/40 border ${isCritical ? 'border-f1-red text-f1-red' : 'border-f1-border text-white'}`}>
                    Component: {formatComponentLabel(insight.affected_component)}
                  </span>
                </div>
              )}
              <p className="mb-2 text-sm">
                <span className="text-f1-muted font-semibold mr-2">Transcript:</span>
                <span className="text-white italic">"{insight.transcript}"</span>
              </p>
              {insight.intent && (
                <div className="grid grid-cols-2 gap-2 mb-3 bg-black/40 p-2 rounded">
                  <p className="text-xs">
                    <span className="text-f1-muted">Intent:</span> <span className="text-white">{insight.intent}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-f1-muted">Severity:</span> <span className={insightColor}>{insight.severity}</span>
                  </p>
                  <p className="text-xs col-span-2">
                    <span className="text-f1-muted">Action:</span> <span className="text-white font-medium">{insight.tactical_action}</span>
                  </p>
                </div>
              )}
              <p className="mb-3 text-sm">
                <span className="text-f1-muted font-semibold mr-2">System Insight:</span>
                <span className={`font-bold ${insightColor}`}>{insight.insights}</span>
              </p>
              {insight.recommendation_delta && (
                <p className="mb-3 text-xs bg-f1-green/10 border border-f1-green/40 rounded p-2">
                  <span className="text-f1-green font-semibold">Model estimate:</span>{' '}
                  <span className="text-white">
                    {insight.recommendation_delta.delta > 0 ? '+' : ''}{insight.recommendation_delta.delta} {insight.recommendation_delta.unit} {insight.recommendation_delta.channel} by end of forecast if addressed
                  </span>
                  <span className="text-f1-muted italic"> (illustrative model projection grounded in this lap's own average pace -- not a simulated fix).</span>
                </p>
              )}
              <p className="text-xs text-f1-muted font-mono opacity-60 mt-4 text-center">
                Time Window: {insight.start_ts.toFixed(1)}s - {insight.end_ts.toFixed(1)}s
              </p>
            </div>
          )
        })
      )}
    </div>
  </section>
)
