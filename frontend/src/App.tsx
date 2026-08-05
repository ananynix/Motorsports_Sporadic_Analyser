import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrackMap } from './components/TrackMap'
import SessionReport from './components/SessionReport'
import f1Logo from './assets/f1@logotyp.us.png'
import './App.css'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label * 1000)
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`

    return (
      <div className="bg-[#222222dd] border border-[#E10600] p-3 rounded shadow-lg shadow-black/50">
        <p className="text-[#888888] font-mono text-xs mb-2">{timeStr}</p>
        {payload.map((pData: any, index: number) => (
          <p key={index} style={{ color: pData.color }} className="font-bold text-sm m-0 leading-relaxed">
            {pData.name} : {pData.value}
          </p>
        ))}
      </div>
    )
  }
  return null;
}

function App() {
  const { liveTelemetry, fusedInsights, isSessionOver, addTelemetry, addFusedInsight, setSessionOver, fetchTrackLayout } = useStore()

  useEffect(() => {
    fetchTrackLayout();
    
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry')

    ws.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'session_complete') {
          setSessionOver(true)
        } else if (data.type === 'fused_insight') {
          addFusedInsight(data.payload)
        } else {
          addTelemetry(data)
        }
      } catch (e) {
        console.error('Error parsing WS message', e)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }

    return () => {
      ws.close()
    }
  }, [addTelemetry, addFusedInsight, setSessionOver])

  if (isSessionOver) {
    return <SessionReport />
  }

  return (
    <div className="min-h-screen bg-[#111111] text-[#FFFFFF] font-sans p-6 lg:p-8">
      <header className="flex flex-col lg:flex-row justify-between items-center mb-8 pb-4 border-b border-[#333333]">
        <div className="flex items-center gap-6 mb-4 lg:mb-0">
          <img src={f1Logo} alt="F1 Logo" className="h-16 lg:h-20" />
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Real-Time Telemetry & Tactical Comm-Link Analyzer</h1>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Live Telemetry */}
        <section className="lg:col-span-2 bg-[#1A1A1A] border border-[#333333] rounded-lg p-6 shadow-lg shadow-black/50">
          <h2 className="text-xl text-[#888888] mb-6 font-medium">Live Telemetry & Tracking</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Track Map */}
            <div className="w-full min-h-[500px] bg-[#111111] p-4 rounded border border-[#333333]">
              <TrackMap />
            </div>

            {/* Line Charts */}
            <div className="flex flex-col gap-6">
              <div className="w-full h-80 bg-[#111111] p-4 rounded border border-[#333333] overflow-visible">
                <h3 className="text-sm text-[#888888] mb-2 font-medium">Speed & RPM (Actual vs Predicted)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={liveTelemetry} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
                    <XAxis dataKey="ts" hide />
                    <YAxis yAxisId="left" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-10, 410]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                    <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#00D2BE" name="Speed (km/h)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rpm" stroke="#888888" name="RPM" strokeWidth={2} dot={false} isAnimationActive={false} />
                    {fusedInsights[0]?.predicted_telemetry && (
                       <Line yAxisId="right" data={fusedInsights[0].predicted_telemetry} type="monotone" dataKey="rpm" stroke="#FF8C00" strokeDasharray="5 5" name="Predicted RPM" strokeWidth={2} dot={false} isAnimationActive={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-full h-80 bg-[#111111] p-4 rounded border border-[#333333] overflow-visible">
                <h3 className="text-sm text-[#888888] mb-2 font-medium">Brake & Tire Deg (Actual vs Predicted)</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={liveTelemetry} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
                    <XAxis dataKey="ts" hide />
                    <YAxis stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-5, 130]} />
                    <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                    <Line type="monotone" dataKey="throttle" stroke="#FFF200" name="Throttle (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="brake_pressure" stroke="#E10600" name="Brake (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="tire_temp_fl" stroke="#e05252" name="Tire FL (°C)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    {fusedInsights[0]?.predicted_telemetry && (
                       <>
                         <Line data={fusedInsights[0].predicted_telemetry} type="monotone" dataKey="brake_pressure" stroke="#FF6347" strokeDasharray="5 5" name="Predicted Brake" strokeWidth={2} dot={false} isAnimationActive={false} />
                         <Line data={fusedInsights[0].predicted_telemetry} type="monotone" dataKey="tire_temp_fl" stroke="#FFB6C1" strokeDasharray="5 5" name="Predicted Tire FL" strokeWidth={2} dot={false} isAnimationActive={false} />
                       </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Tactical Insights Feed */}
        <section className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-6 shadow-lg shadow-black/50 flex flex-col h-[500px] lg:h-[730px]">
          <h2 className="text-xl text-[#888888] mb-6 font-medium">Tactical Insights Feed</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 feed-scrollbar h-full">
            {fusedInsights.length === 0 ? (
              <p className="text-[#888888] italic text-center mt-10">Waiting for tactical comms...</p>
            ) : (
              fusedInsights.map((insight, idx) => {
                // Mock logic to determine if message is critical (e.g. grip, puncture)
                const isCritical = insight.severity === 'High' || insight.transcript.toLowerCase().includes('puncture');
                const borderColor = isCritical ? 'border-l-[#E10600]' : (insight.severity === 'Medium' ? 'border-l-[#FF8C00]' : 'border-l-[#00D2BE]');
                const insightColor = isCritical ? 'text-[#E10600]' : (insight.severity === 'Medium' ? 'text-[#FF8C00]' : 'text-[#00D2BE]');
                
                return (
                  <div key={idx} className={`bg-[#222222] p-4 rounded-r-md border-l-4 ${borderColor} shadow-md`}>
                    <p className="mb-2 text-sm">
                      <span className="text-[#888888] font-semibold mr-2">Transcript:</span>
                      <span className="text-white italic">"{insight.transcript}"</span>
                    </p>
                    {insight.intent && (
                      <div className="grid grid-cols-2 gap-2 mb-3 bg-[#111111] p-2 rounded">
                        <p className="text-xs">
                          <span className="text-[#888888]">Intent:</span> <span className="text-white">{insight.intent}</span>
                        </p>
                        <p className="text-xs">
                          <span className="text-[#888888]">Severity:</span> <span className={insightColor}>{insight.severity}</span>
                        </p>
                        <p className="text-xs col-span-2">
                          <span className="text-[#888888]">Action:</span> <span className="text-white font-medium">{insight.tactical_action}</span>
                        </p>
                      </div>
                    )}
                    <p className="mb-3 text-sm">
                      <span className="text-[#888888] font-semibold mr-2">System Insight:</span>
                      <span className={`font-bold ${insightColor}`}>{insight.insights}</span>
                    </p>
                    <p className="text-xs text-[#888888] font-mono opacity-60 mt-4 text-center">
                      Time Window: {insight.start_ts.toFixed(1)}s - {insight.end_ts.toFixed(1)}s
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
