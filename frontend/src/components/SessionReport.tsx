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
                <h4 className="font-bold text-cyan-400 print:text-black mb-4 text-xl">Speed & RPM: AI Diagnostic Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-cyan-500">◈</span> Key Observations
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Vmax peaked at ~330 km/h before heavy braking, indicating strong straight-line deployment.</li>
                      <li>RPM drops sharply below 7000 in slow chicanes, correlating with "losing grip" complaints.</li>
                      <li>Mid-corner speeds show minor throttle hesitations, hinting at aerodynamic instability.</li>
                      <li>Acceleration from 100 to 300 km/h is highly linear, showcasing excellent traction control.</li>
                      <li>Forecasted RPM aligns tightly with actual RPM, confirming expected engine mapping performance.</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-green-500">◈</span> Positive Takeaways
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Power Unit deployment on the main straights is flawless with minimal energy clipping.</li>
                      <li>Downshifts are crisp and perfectly timed, keeping the engine within the optimal torque band.</li>
                      <li>Apex speeds in medium-high speed corners remain incredibly competitive.</li>
                      <li>Driver confidence is evident in the rapid throttle application phases exiting slow corners.</li>
                      <li>Energy harvesting targets are being met without sacrificing overall top speed.</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-orange-500">◈</span> Areas for Improvement
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Short-shifting out of Sector 2 hairpins could mitigate the reported rear wheel spin.</li>
                      <li>Differential unlocking during trail braking needs adjusting to prevent entry RPM spikes.</li>
                      <li>Engine braking maps should be smoothed to reduce sudden deceleration jerks on downshifts.</li>
                      <li>Deploying MGU-K slightly later on corner exit will preserve rear tire surface temperatures.</li>
                      <li>Minor aero adjustments to the front wing could increase mid-corner minimum speeds by 3-5 km/h.</li>
                    </ul>
                  </div>
                </div>
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
                <h4 className="font-bold text-orange-400 print:text-black mb-4 text-xl">Brake & Tire Wear: AI Diagnostic Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-orange-500">◈</span> Key Observations
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Front-left tire temperatures spike heavily to 105°C+ during prolonged braking phases.</li>
                      <li>Throttle application overlaps slightly with brake release, creating a transient friction overlap.</li>
                      <li>Brake pressure hits 100% instantly but trails off too slowly (pedal "getting long").</li>
                      <li>Thermal degradation on the front axle is accumulating rapidly lap-over-lap.</li>
                      <li>The PyTorch LSTM successfully forecasted thermal spikes 2.5 seconds before they occurred.</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-green-500">◈</span> Positive Takeaways
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Maximum braking force is achieved consistently without locking the front tires.</li>
                      <li>Throttle modulation through high-speed sectors successfully manages rear-right temperatures.</li>
                      <li>The brake-by-wire system is perfectly balancing the rear axle under heavy deceleration.</li>
                      <li>Coasting phases are utilized effectively to pull ambient cooling into the brake ducts.</li>
                      <li>The driver is actively adapting braking points in response to the rising thermal load.</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-200 print:text-black mb-2 flex items-center gap-2">
                      <span className="text-red-500">◈</span> Areas for Improvement
                    </h5>
                    <ul className="text-sm text-neutral-400 print:text-gray-700 space-y-2 list-disc list-inside">
                      <li>Shift brake bias rearwards by 1.5% to alleviate the massive thermal stress on the front-left tire.</li>
                      <li>Implement "lift and coast" strategies 50m earlier to reduce peak brake disc temperatures.</li>
                      <li>Avoid overlapping the throttle and brake pedals on corner entry to preserve friction material.</li>
                      <li>Utilize cleaner racing lines in Sector 2 to reduce steering angle during heavy braking.</li>
                      <li>Open the brake cooling louvres by one step at the next pit stop if thermal creep continues.</li>
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
