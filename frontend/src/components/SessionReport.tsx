import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { FusedInsight, TelemetryPoint } from '../store/useStore';
import { SpeedRpmChart, BrakeTireChart } from './TelemetryCharts';
import { buildSpeedRpmSummary, buildBrakeTireSummary } from '../utils/diagnosticSummary';

interface SessionReportProps {
  // When omitted, falls back to the store's live-session data -- SessionReport
  // behaves exactly as it always has for the Live Session mode. ReportPage
  // passes these explicitly for a historical simulation run, whose insights
  // never touch the global store.
  insights?: FusedInsight[];
  telemetry?: TelemetryPoint[];
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

const SessionReport: React.FC<SessionReportProps> = ({ insights: insightsProp, telemetry: telemetryProp, title, subtitle, onBack }) => {
  const { fusedInsights, liveTelemetry } = useStore();
  const fusedInsightsResolved = insightsProp ?? fusedInsights;
  const liveTelemetryResolved = telemetryProp ?? liveTelemetry;

  const handleDownloadPDF = () => {
    window.print();
  };

  // Basic stats
  const highSeverityCount = fusedInsightsResolved.filter(f => f?.severity === 'High').length;
  const mediumSeverityCount = fusedInsightsResolved.filter(f => f?.severity === 'Medium').length;

  // Computed fresh from this report's own telemetry/insights -- see
  // utils/diagnosticSummary.ts for why (this used to be one hardcoded
  // Belgium-GP-specific paragraph shown identically for every driver).
  const speedRpmSummary = useMemo(
    () => buildSpeedRpmSummary(liveTelemetryResolved, fusedInsightsResolved),
    [liveTelemetryResolved, fusedInsightsResolved]
  );
  const brakeTireSummary = useMemo(
    () => buildBrakeTireSummary(liveTelemetryResolved, fusedInsightsResolved),
    [liveTelemetryResolved, fusedInsightsResolved]
  );

  return (
    <div className="w-full min-h-screen bg-neutral-950 text-white p-8 font-sans print:bg-white print:text-black">

      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-neutral-800 pb-4 print:border-gray-300">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent print:text-red-700">
            Session Report: {title ?? 'Belgium GP'}
          </h1>
          <p className="text-neutral-400 mt-2 print:text-gray-600">{subtitle ?? 'Post-Session Telemetry & Tactical Comm-Link Breakdown'}</p>
        </div>
        <div className="print:hidden flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors px-6 py-3 rounded-lg font-bold"
            >
              Back to Simulation
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            className="bg-red-600 hover:bg-red-700 transition-colors px-6 py-3 rounded-lg font-bold shadow-lg shadow-red-500/20"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-neutral-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-gray-500">Total Datapoints</h3>
          <p className="text-3xl font-bold">{liveTelemetryResolved.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-neutral-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-gray-500">Total Insights</h3>
          <p className="text-3xl font-bold">{fusedInsightsResolved.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-red-600">Critical Alerts</h3>
          <p className="text-3xl font-bold text-red-500 print:text-red-700">{highSeverityCount}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-orange-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-orange-600">Warnings</h3>
          <p className="text-3xl font-bold text-orange-500 print:text-orange-700">{mediumSeverityCount}</p>
        </div>
      </div>

      {/* What Happened Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-neutral-200 print:text-black">Radio Frequency Insights Timeline</h2>
        {fusedInsightsResolved.length === 0 ? (
          <p className="text-neutral-500 italic">No radio comms intercepted during this session.</p>
        ) : (
          <div className="space-y-6">
            {fusedInsightsResolved.map((insight: any, idx: number) => {
              const severityColor = 
                insight?.severity === 'High' ? 'text-red-500 print:text-red-700' :
                insight?.severity === 'Medium' ? 'text-orange-500 print:text-orange-700' :
                'text-cyan-500 print:text-cyan-700';

              const severityBg = 
                insight?.severity === 'High' ? 'bg-red-500/10 border-red-500/30 print:bg-red-50 print:border-red-200' :
                insight?.severity === 'Medium' ? 'bg-orange-500/10 border-orange-500/30 print:bg-orange-50 print:border-orange-200' :
                'bg-cyan-500/10 border-cyan-500/30 print:bg-cyan-50 print:border-cyan-200';

              return (
                <div key={idx} className={`p-6 rounded-xl border ${severityBg} break-inside-avoid`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`font-bold uppercase tracking-wider text-sm ${severityColor}`}>
                        [{insight?.severity || 'Low'} Priority]
                      </span>
                      <h4 className="text-xl font-bold mt-1 text-white print:text-black">{insight?.intent || 'Unknown'}</h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h5 className="text-neutral-400 text-sm uppercase mb-2 print:text-gray-500">Radio Transcript</h5>
                      <p className="italic text-neutral-300 print:text-gray-800">"{insight?.transcript}"</p>
                    </div>
                    <div>
                      <h5 className="text-neutral-400 text-sm uppercase mb-2 print:text-gray-500">Improvised Tactical Action</h5>
                      <p className="font-semibold text-white print:text-black">{insight?.tactical_action || 'No action needed.'}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h5 className="text-neutral-400 text-sm uppercase mb-2 print:text-gray-500">System Insight</h5>
                    <p className="text-red-400 font-medium print:text-red-700">{insight?.insights || 'No system insight generated.'}</p>
                  </div>
                  {/* DL Prediction snapshot summary */}
                  <div className="mt-4 pt-4 border-t border-neutral-700/50 print:border-gray-300">
                    <p className="text-xs text-neutral-500 print:text-gray-500">
                      Telemetry Snapshot — RPM Forecast: {Math.round(insight?.predicted_telemetry?.[0]?.rpm || 0)} | Throttle Forecast: {Math.round(insight?.predicted_telemetry?.[0]?.throttle || 0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Telemetry Charts Section */}
        {liveTelemetryResolved && liveTelemetryResolved.length > 0 && (
          <div className="mt-12 pt-8 border-t border-neutral-800 print:border-gray-300">
            <h3 className="text-2xl font-bold mb-6 text-white print:text-black">Overall Race Telemetry Analysis</h3>
            
            <div className="flex flex-col gap-8 mb-8">
              <div style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
                <SpeedRpmChart data={liveTelemetryResolved} />
              </div>

              <div className="bg-cyan-900/20 border border-cyan-800/50 p-6 rounded-lg print:bg-gray-100 print:border-gray-300 break-inside-avoid">
                <h4 className="font-bold text-cyan-400 print:text-black mb-4 text-xl">Speed & RPM: AI Diagnostic Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-cyan-500">◈</span> Key Observations
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {speedRpmSummary.observations.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-green-500">◈</span> Positive Takeaways
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {speedRpmSummary.positives.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-orange-500">◈</span> Areas for Improvement
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {speedRpmSummary.improvements.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
                <BrakeTireChart data={liveTelemetryResolved} />
              </div>

              <div className="bg-orange-900/20 border border-orange-800/50 p-6 rounded-lg print:bg-gray-100 print:border-gray-300 break-inside-avoid">
                <h4 className="font-bold text-orange-400 print:text-black mb-4 text-xl">Brake & Tire Wear: AI Diagnostic Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-orange-500">◈</span> Key Observations
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {brakeTireSummary.observations.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-green-500">◈</span> Positive Takeaways
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {brakeTireSummary.positives.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-red-500">◈</span> Areas for Improvement
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      {brakeTireSummary.improvements.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionReport;
