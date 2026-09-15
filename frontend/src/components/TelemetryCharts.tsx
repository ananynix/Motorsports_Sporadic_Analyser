import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { TelemetryPoint, PredictedTelemetryPoint } from '../store/useStore'

// Recharts' default tick generator doesn't always land on round numbers for
// a fixed (non-auto) domain -- e.g. [-5, 130] produces "64.99393272399902"
// instead of "65". Rounding for display only; doesn't affect the data.
const roundTick = (v: number) => String(Math.round(v))

interface ChartProps {
  data: TelemetryPoint[];
  // Phase 11's illustrative "actual vs predicted vs recommended" overlay,
  // extended here to historical simulation (see pages/SimulationPage.tsx) --
  // each Line below is given its own `data` prop rather than merged into the
  // main dataset, same pattern the original live dashboard used.
  predicted?: PredictedTelemetryPoint[];
  recommended?: PredictedTelemetryPoint[];
}

// Extracted from SessionReport.tsx so the same real telemetry charts can be
// reused by the historical replay view against a historical driver's lap,
// without carrying along SessionReport's hardcoded demo-specific AI summary
// text (which is written for the live Belgium GP session and would be
// misleading against arbitrary historical data).

export const SpeedRpmChart = ({ data, predicted, recommended }: ChartProps) => (
  <div className="w-full h-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-white print:border-gray-300">
    <h4 className="text-neutral-400 mb-4 print:text-gray-600 font-bold">Speed & RPM</h4>
    <ResponsiveContainer width="100%" height="90%">
      <LineChart data={data}>
        <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
        <XAxis dataKey="ts" hide />
        <YAxis yAxisId="left" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-10, 410]} tickFormatter={roundTick} />
        <YAxis yAxisId="right" orientation="right" stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} tickFormatter={roundTick} />
        <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#00D2BE" name="Speed (km/h)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line yAxisId="right" type="monotone" dataKey="rpm" stroke="#888888" name="RPM" strokeWidth={2} dot={false} isAnimationActive={false} />
        {predicted && predicted.length > 0 && (
          <>
            <Line yAxisId="left" data={predicted} type="monotone" dataKey="speed" stroke="#FF8C00" strokeDasharray="5 5" name="Predicted Speed" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="right" data={predicted} type="monotone" dataKey="rpm" stroke="#FF8C00" strokeDasharray="5 5" name="Predicted RPM" strokeWidth={2} dot={false} isAnimationActive={false} />
          </>
        )}
        {recommended && recommended.length > 0 && (
          <>
            <Line yAxisId="left" data={recommended} type="monotone" dataKey="speed" stroke="#2ECC71" strokeDasharray="5 5" name="Recommended Speed (if addressed)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="right" data={recommended} type="monotone" dataKey="rpm" stroke="#2ECC71" strokeDasharray="5 5" name="Recommended RPM (if addressed)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  </div>
)

export const BrakeTireChart = ({ data, predicted, recommended }: ChartProps) => (
  <div className="w-full h-80 bg-neutral-900 p-6 rounded-xl border border-neutral-800 print:bg-white print:border-gray-300">
    <h4 className="text-neutral-400 mb-4 print:text-gray-600 font-bold">Brake & Tire Degradation</h4>
    <ResponsiveContainer width="100%" height="90%">
      <LineChart data={data}>
        <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={true} horizontal={true} />
        <XAxis dataKey="ts" hide />
        <YAxis stroke="#888888" tick={{ fill: '#888888', fontSize: 12 }} axisLine={false} tickLine={false} domain={[-5, 130]} tickFormatter={roundTick} />
        <Line type="monotone" dataKey="throttle" stroke="#FFF200" name="Throttle (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="brake_pressure" stroke="#E10600" name="Brake (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="tire_temp_fl" stroke="#e05252" name="Tire FL (°C)" strokeWidth={2} dot={false} isAnimationActive={false} />
        {predicted && predicted.length > 0 && (
          <>
            <Line data={predicted} type="monotone" dataKey="brake_pressure" stroke="#FF6347" strokeDasharray="5 5" name="Predicted Brake" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line data={predicted} type="monotone" dataKey="throttle" stroke="#FFB6C1" strokeDasharray="5 5" name="Predicted Throttle" strokeWidth={2} dot={false} isAnimationActive={false} />
          </>
        )}
        {recommended && recommended.length > 0 && (
          <>
            <Line data={recommended} type="monotone" dataKey="brake_pressure" stroke="#2ECC71" strokeDasharray="5 5" name="Recommended Brake (if addressed)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line data={recommended} type="monotone" dataKey="throttle" stroke="#2ECC71" strokeDasharray="5 5" name="Recommended Throttle (if addressed)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  </div>
)
