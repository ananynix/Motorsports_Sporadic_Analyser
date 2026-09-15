import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../store/useStore'
import type { TelemetryPoint } from '../store/useStore'
import { headingFromTrail } from '../utils/heading'

interface TrackTooltipProps {
  active?: boolean;
  // Either series can trigger this tooltip: the plain {x,y} track-boundary
  // trace, or a full TelemetryPoint for the car-position marker -- speed/rpm
  // are only ever present for the latter.
  payload?: { payload: { x: number; y: number; speed?: number; rpm?: number } }[];
  driverLabel: string;
}

const TrackTooltip = ({ active, payload, driverLabel }: TrackTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    // Only show tooltip if it has live telemetry data (speed), not just track layout (x, y)
    if (data.speed === undefined) return null;

    return (
      <div className="bg-[#222222dd] border border-[#E10600] p-3 rounded shadow-lg shadow-black/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-[#E10600] text-white font-bold px-2 py-0.5 text-xs rounded">{driverLabel}</span>
        </div>
        <p className="text-[#00D2BE] font-mono text-sm font-bold">Speed: {data.speed} km/h</p>
        <p className="text-[#888888] font-mono text-xs">RPM: {data.rpm}</p>
      </div>
    );
  }
  return null;
}

interface TrackMapProps {
  // When omitted, TrackMap behaves exactly as it always has: track boundary
  // from the store's trackLayout, current position from the last liveTelemetry
  // point. Passed explicitly by the historical replay view, whose data has no
  // separate track-boundary source -- the full lap's own x/y trace serves as
  // both the static path and (sliced to the scrub position) the moving dot.
  pathData?: { x: number; y: number }[];
  positionData?: TelemetryPoint[];
  label?: string;
  // Car-icon rotation in degrees (0 = pointing up). Callers with their own
  // notion of "current index in a known path" (e.g. historical replay) pass
  // this explicitly; live mode derives it below from liveTelemetry's own
  // trailing history since it has no other way to know direction of travel.
  heading?: number;
}

interface CarMarkerProps {
  cx?: number;
  cy?: number;
}

const CarMarker = (heading: number) => ({ cx, cy }: CarMarkerProps) => {
  if (cx === undefined || cy === undefined) return <g />;
  return (
    <g transform={`translate(${cx},${cy}) rotate(${heading})`}>
      <path d="M0,-10 L5.5,7 L0,3.5 L-5.5,7 Z" fill="#E10600" stroke="#FFFFFF" strokeWidth={0.75} />
    </g>
  );
};

export const TrackMap = ({ pathData, positionData, label = 'VER 1', heading }: TrackMapProps) => {
  const { liveTelemetry, trackLayout } = useStore()

  const path = pathData ?? trackLayout;
  const position = positionData ?? (liveTelemetry.length > 0 ? [liveTelemetry[liveTelemetry.length - 1]] : []);
  const resolvedHeading = heading ?? headingFromTrail(liveTelemetry);

  if (path.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#888888] font-mono">
        Waiting for track layout...
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className="bg-[#E10600] text-white font-bold px-2 py-1 text-sm rounded shadow">
          {label}
        </span>
        <span className="text-[#888888] text-xs font-mono">TRACK POSITION</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis type="number" dataKey="x" hide domain={['dataMin - 500', 'dataMax + 500']} />
          <YAxis type="number" dataKey="y" hide domain={['dataMin - 500', 'dataMax + 500']} />

          <Tooltip content={<TrackTooltip driverLabel={label} />} cursor={false} />

          {/* Track Boundary - Drawn as a thick, continuous line with hidden dots */}
          <Scatter
            data={path}
            line={{ stroke: '#333333', strokeWidth: 4 }}
            shape={() => <g></g>} // Hides the individual coordinate dots
            isAnimationActive={false}
          />

          {/* Current Car Position */}
          <Scatter
            data={position}
            fill="#E10600"
            shape={CarMarker(resolvedHeading)}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
