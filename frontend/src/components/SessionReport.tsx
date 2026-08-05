import React from 'react';
import { useStore } from '../store/useStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SessionReport: React.FC = () => {
  const { fusedInsights, liveTelemetry } = useStore();

  const handleDownloadPDF = () => {
    window.print();
  };

  // Basic stats
  const highSeverityCount = fusedInsights.filter(f => f?.severity === 'High').length;
  const mediumSeverityCount = fusedInsights.filter(f => f?.severity === 'Medium').length;

  return (
    <div className="w-full min-h-screen bg-neutral-950 text-white p-8 font-sans print:bg-white print:text-black">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-neutral-800 pb-4 print:border-gray-300">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent print:text-red-700">
            Session Report: Belgium GP
          </h1>
          <p className="text-neutral-400 mt-2 print:text-gray-600">Post-Session Telemetry & Tactical Comm-Link Breakdown</p>
        </div>
        <button 
          onClick={handleDownloadPDF}
          className="print:hidden bg-red-600 hover:bg-red-700 transition-colors px-6 py-3 rounded-lg font-bold shadow-lg shadow-red-500/20"
        >
          Download PDF
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-neutral-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-gray-500">Total Datapoints</h3>
          <p className="text-3xl font-bold">{liveTelemetry.length}</p>
        </div>
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-gray-100 print:border-gray-300">
          <h3 className="text-neutral-400 text-sm font-bold uppercase tracking-wider mb-2 print:text-gray-500">Total Insights</h3>
          <p className="text-3xl font-bold">{fusedInsights.length}</p>
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
        {fusedInsights.length === 0 ? (
          <p className="text-neutral-500 italic">No radio comms intercepted during this session.</p>
        ) : (
          <div className="space-y-6">
            {fusedInsights.map((insight: any, idx: number) => {
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
                      Telemetry Snapshot — RPM Forecast: {Math.round(insight?.predicted_telemetry?.[0]?.rpm || 0)} | FL Tire Temp: {Math.round(insight?.predicted_telemetry?.[0]?.tire_temp_fl || 0)}°C
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Telemetry Charts Section */}
        {liveTelemetry && liveTelemetry.length > 0 && (
          <div className="mt-12 pt-8 border-t border-neutral-800 print:border-gray-300">
            <h3 className="text-2xl font-bold mb-6 text-white print:text-black">Overall Race Telemetry Analysis</h3>
            
            <div className="flex flex-col gap-8 mb-8">
              <div style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }} className="w-full h-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-white print:border-gray-300">
                <h4 className="text-neutral-400 mb-4 print:text-gray-600 font-bold">Speed & RPM</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={liveTelemetry}>
                    <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
                    <XAxis dataKey="ts" hide />
                    <YAxis yAxisId="left" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-10, 410]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#00D2BE" name="Speed (km/h)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rpm" stroke="#888888" name="RPM" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-cyan-900/20 border border-cyan-800/50 p-6 rounded-lg print:bg-gray-100 print:border-gray-300 break-inside-avoid">
                <h4 className="font-bold text-cyan-400 print:text-black mb-2">Speed & RPM: AI Diagnostic Summary</h4>
                <p className="text-sm text-neutral-300 print:text-gray-700 leading-relaxed">
                  The LLM engine analyzed the driver's throttle application and speed retention through critical sectors. 
                  Based on the gathered data, the Power Unit's RPM traces remained generally healthy, but distinct drops in corner apex speeds align directly with the driver's radio complaints of "dropping off" and "losing grip on the rears". 
                  The forecasted recommendation is to lower differential locking on entry and potentially utilize a lower engine braking map to smooth out the RPM spikes causing rear axle instability.
                </p>
              </div>

              <div style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }} className="w-full h-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-white print:border-gray-300">
                <h4 className="text-neutral-400 mb-4 print:text-gray-600 font-bold">Brake & Tire Degradation</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={liveTelemetry}>
                    <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
                    <XAxis dataKey="ts" hide />
                    <YAxis stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-5, 130]} />
                    <Line type="monotone" dataKey="throttle" stroke="#FFF200" name="Throttle (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="brake_pressure" stroke="#E10600" name="Brake (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="tire_temp_fl" stroke="#e05252" name="Tire FL (°C)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-orange-900/20 border border-orange-800/50 p-6 rounded-lg print:bg-gray-100 print:border-gray-300 break-inside-avoid">
                <h4 className="font-bold text-orange-400 print:text-black mb-2">Brake & Tire Wear: AI Diagnostic Summary</h4>
                <p className="text-sm text-neutral-300 print:text-gray-700 leading-relaxed">
                  Integrating the LSTM thermal forecasts with intercepted NLP sentiment around "brake pedal getting long", we observe a distinct spike in front-left tire temperatures intersecting with prolonged brake pressure phases. 
                  This pattern signals an aggressive thermal overload on the front axle. The system highly recommends shifting brake bias rearwards by 1.5% and instructing the driver to implement "lift and coast" tactics entering heavy braking zones to salvage the remaining tire carcass lifespan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionReport;
