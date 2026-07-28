import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../store/useStore'

const TrackTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    // Only show tooltip if it has live telemetry data (speed), not just track layout (x, y)
    if (data.speed === undefined) return null;

    return (
      <div className="bg-[#222222dd] border border-[#E10600] p-3 rounded shadow-lg shadow-black/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-[#E10600] text-white font-bold px-2 py-0.5 text-xs rounded">VER 1</span>
        </div>
        <p className="text-[#00D2BE] font-mono text-sm font-bold">Speed: {data.speed} km/h</p>
        <p className="text-[#888888] font-mono text-xs">RPM: {data.rpm}</p>
      </div>
    );
  }
  return null;
}

export const TrackMap = () => {
  const { liveTelemetry, trackLayout } = useStore()
  
  if (trackLayout.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#888888] font-mono">
        Waiting for track layout...
      </div>
    )
  }

  const currentData = liveTelemetry.length > 0 ? [liveTelemetry[liveTelemetry.length - 1]] : [];

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className="bg-[#E10600] text-white font-bold px-2 py-1 text-sm rounded shadow">
          VER 1
        </span>
        <span className="text-[#888888] text-xs font-mono">TRACK POSITION</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis type="number" dataKey="x" hide domain={['dataMin - 500', 'dataMax + 500']} />
          <YAxis type="number" dataKey="y" hide domain={['dataMin - 500', 'dataMax + 500']} />
          
          <Tooltip content={<TrackTooltip />} cursor={false} />
          
          {/* Track Boundary - Drawn as a thick, continuous line with hidden dots */}
          <Scatter 
            data={trackLayout} 
            line={{ stroke: '#333333', strokeWidth: 4 }} 
            shape={() => <g></g>} // Hides the individual coordinate dots
            isAnimationActive={false} 
          />
          
          {/* Current Car Position */}
          <Scatter 
            data={currentData} 
            fill="#E10600" 
            shape="circle"
            isAnimationActive={false} 
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
