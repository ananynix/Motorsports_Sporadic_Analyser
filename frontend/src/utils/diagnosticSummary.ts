import type { TelemetryPoint, FusedInsight } from '../store/useStore'

export interface DiagnosticColumns {
  observations: string[];
  positives: string[];
  improvements: string[];
}

// Mirrors fusion_engine.py's COMPONENT_TO_CHANNEL grouping (backend/fusion_engine.py)
// so each report section only cites radio diagnoses that actually belong to it.
const SPEED_RPM_COMPONENTS = new Set([
  'front_wing', 'rear_wing', 'floor', 'diffuser',
  'suspension_front', 'suspension_rear', 'differential', 'aero_balance_general',
  'engine_power_unit', 'ers_hybrid_system', 'cooling', 'gearbox',
])
const BRAKE_TIRE_COMPONENTS = new Set(['brakes', 'tires_front', 'tires_rear'])

const formatComponent = (component: string) =>
  component.split('_').map(w => (w.toLowerCase() === 'ers' ? 'ERS' : w[0].toUpperCase() + w.slice(1))).join(' ')

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)

const relevantInsights = (insights: FusedInsight[], components: Set<string>) =>
  insights.filter((i) => i.affected_component && components.has(i.affected_component))

const bestRecommendation = (insights: FusedInsight[]) => {
  const withDelta = insights.filter((i) => i.recommendation_delta)
  if (!withDelta.length) return null
  return withDelta.reduce((best, i) =>
    i.recommendation_delta!.delta > (best.recommendation_delta?.delta ?? -Infinity) ? i : best
  )
}

const NO_DATA: DiagnosticColumns = {
  observations: ['No telemetry was recorded for this session.'],
  positives: [],
  improvements: [],
}

// These two builders replace what used to be a single hardcoded, Belgium-GP-
// specific paragraph shown identically for every driver and every race. Every
// bullet below is computed directly from the actual telemetry/insights array
// passed in for THIS report, so it genuinely differs per driver and per lap
// instead of reading the same copy regardless of who or what was simulated.
export function buildSpeedRpmSummary(telemetry: TelemetryPoint[], insights: FusedInsight[]): DiagnosticColumns {
  if (telemetry.length === 0) return NO_DATA

  const speeds = telemetry.map((p) => p.speed)
  const rpms = telemetry.map((p) => p.rpm)
  const maxSpeed = Math.max(...speeds)
  const minSpeed = Math.min(...speeds)
  const avgSpeed = mean(speeds)
  const maxRpm = Math.max(...rpms)
  const minRpm = Math.min(...rpms)

  const related = relevantInsights(insights, SPEED_RPM_COMPONENTS)
  const highSeverity = insights.filter((i) => i.severity === 'High')
  const recommendation = bestRecommendation(related)

  const observations = [
    `Top speed reached ${maxSpeed.toFixed(0)} km/h, averaging ${avgSpeed.toFixed(0)} km/h across ${telemetry.length} recorded points.`,
    `Engine speed ranged from ${minRpm.toFixed(0)} to ${maxRpm.toFixed(0)} RPM over the session.`,
    related.length > 0
      ? `${related.length} radio call${related.length === 1 ? '' : 's'} diagnosed a speed/power-related issue this session (${[...new Set(related.map((i) => formatComponent(i.affected_component!)))].join(', ')}).`
      : 'No speed- or power-related mechanical issues were diagnosed from radio traffic this session.',
    `The lowest recorded speed was ${minSpeed.toFixed(0)} km/h, marking the tightest cornering phase of this lap.`,
  ]

  const positives = [
    highSeverity.length === 0
      ? 'No high-severity mechanical issues were flagged during this run.'
      : `${highSeverity.length} high-severity call${highSeverity.length === 1 ? ' was' : 's were'} caught and diagnosed in real time.`,
    recommendation
      ? `A projected recovery of +${recommendation.recommendation_delta!.delta} ${recommendation.recommendation_delta!.unit} was modeled after the ${formatComponent(recommendation.affected_component!)} diagnosis (illustrative, grounded in this lap's own pace -- not a simulated fix).`
      : "No corrective recommendation was necessary -- telemetry stayed close to this lap's own established pace throughout.",
    `Speed varied by ${(maxSpeed - minSpeed).toFixed(0)} km/h across the lap, consistent with a full mix of straights and corners.`,
  ]

  const improvements = related.length > 0
    ? related.slice(0, 3).map((i) => `${formatComponent(i.affected_component!)}: ${i.tactical_action}`)
    : ['No specific corrective action was flagged for the speed/RPM channel this session.']

  return { observations, positives, improvements }
}

export function buildBrakeTireSummary(telemetry: TelemetryPoint[], insights: FusedInsight[]): DiagnosticColumns {
  if (telemetry.length === 0) return NO_DATA

  const brakes = telemetry.map((p) => p.brake_pressure)
  const maxBrake = Math.max(...brakes)

  let brakeZones = 0
  let wasBraking = false
  let overlapCount = 0
  for (const p of telemetry) {
    const isBraking = p.brake_pressure > 50
    if (isBraking && !wasBraking) brakeZones++
    wasBraking = isBraking
    if (p.throttle > 15 && p.brake_pressure > 15) overlapCount++
  }
  const overlapPct = (overlapCount / telemetry.length) * 100

  const tireChannels: Array<[string, keyof TelemetryPoint]> = [
    ['front-left', 'tire_temp_fl'], ['front-right', 'tire_temp_fr'],
    ['rear-left', 'tire_temp_rl'], ['rear-right', 'tire_temp_rr'],
  ]
  const tireMaxes = tireChannels.map(([label, key]) => ({
    label, max: Math.max(...telemetry.map((p) => p[key] as number)),
  }))
  const hottest = tireMaxes.reduce((a, b) => (b.max > a.max ? b : a))
  const coolest = tireMaxes.reduce((a, b) => (b.max < a.max ? b : a))
  const tireSpread = hottest.max - coolest.max

  const related = relevantInsights(insights, BRAKE_TIRE_COMPONENTS)

  const observations = [
    `${brakeZones} distinct braking zone${brakeZones === 1 ? '' : 's'} identified this lap, with peak brake pressure reaching ${maxBrake.toFixed(0)}%.`,
    tireSpread < 1
      ? `Tire temperature telemetry sits at a flat ~${hottest.max.toFixed(0)}°C across all four corners for this session -- this data source doesn't expose real per-corner thermal variation.`
      : `The ${hottest.label} tire ran hottest this lap, peaking at ${hottest.max.toFixed(0)}°C (a ${tireSpread.toFixed(1)}°C spread across all four corners).`,
    `Throttle and brake were applied simultaneously for ${overlapPct.toFixed(1)}% of this lap${overlapPct > 5 ? ', indicating notable trail-braking or overlap phases' : ', a minimal amount consistent with clean pedal transitions'}.`,
  ]

  const positives = [
    overlapPct < 5
      ? 'Clean, minimal throttle/brake overlap this lap -- pedal transitions were sharp and deliberate.'
      : `Overlap phases were used across ${brakeZones} braking zone${brakeZones === 1 ? '' : 's'}, consistent with active trail-braking technique.`,
    related.length === 0
      ? 'No brake- or tire-related complaints were raised over the radio this session.'
      : `${related.length} brake/tire call${related.length === 1 ? ' was' : 's were'} caught and diagnosed in real time.`,
    tireSpread >= 1
      ? `Tire temperatures stayed within a ${tireSpread.toFixed(1)}°C spread across all four corners, indicating balanced thermal loading.`
      : `Peak brake pressure of ${maxBrake.toFixed(0)}% was reached without any radio-flagged lock-up complaints.`,
  ]

  const improvements = related.length > 0
    ? related.slice(0, 3).map((i) => `${formatComponent(i.affected_component!)}: ${i.tactical_action}`)
    : [
        maxBrake >= 99
          ? `Brake pressure reached full deployment (${maxBrake.toFixed(0)}%) at least once this lap -- worth monitoring for lock-up risk on colder tires.`
          : `Peak brake pressure topped out at ${maxBrake.toFixed(0)}%, below full deployment -- there may be margin for later, harder braking into the tightest corners.`,
      ]

  return { observations, positives, improvements }
}
