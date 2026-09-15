import { create } from 'zustand';
import type { ConnectionStatus } from '../hooks/useWebSocketConnection';

export interface TelemetryPoint {
  // Historical (Phase 5) telemetry points have no `ts` -- they're a static
  // per-lap extraction, not a live timestamped stream.
  ts?: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake_pressure: number;
  tire_temp_fl: number;
  tire_temp_fr: number;
  tire_temp_rl: number;
  tire_temp_rr: number;
  x: number;
  y: number;
}

// Shape of dl_model.py's TelemetryPredictor.predict() output (Phase 10's
// TCN). Deliberately narrower than TelemetryPoint: tire_temp_fl/fr and x/y
// were dropped from the model entirely (FastF1's public API has no real
// tire temperature -- every point in the real season data is a hardcoded
// 100.0 constant, an unlearnable prediction target).
export interface PredictedTelemetryPoint {
  ts?: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake_pressure: number;
}

export interface RecommendationDelta {
  channel: string;
  delta: number;
  unit: string;
}

export interface FusedInsight {
  start_ts: number;
  end_ts: number;
  transcript: string;
  intent?: string;
  severity?: string;
  affected_component?: string;
  tactical_action?: string;
  insights: string;
  predicted_telemetry?: PredictedTelemetryPoint[];
  // Phase 11: illustrative "reality vs. recommended" comparison -- see
  // fusion_engine.py's COMPONENT_TO_CHANNEL / _build_counterfactual_window
  // for what this actually is (a model-projected estimate grounded in this
  // lap's own real average, not a simulated mechanical fix). Only present
  // for a real, addressable issue at Medium/High severity.
  recommended_telemetry?: PredictedTelemetryPoint[];
  recommendation_delta?: RecommendationDelta | null;
}

interface TrackPoint {
  x: number;
  y: number;
}

export interface HistoricalEvent {
  event_name: string;
  event_slug: string;
  round: number;
  drivers: string[];
}

export interface HistoricalIndex {
  season: number | null;
  session_type: string | null;
  events: HistoricalEvent[];
}

interface AppState {
  liveTelemetry: TelemetryPoint[];
  fusedInsights: FusedInsight[];
  trackLayout: TrackPoint[];
  isSessionOver: boolean;
  telemetryStatus: ConnectionStatus;
  insightsStatus: ConnectionStatus;
  historicalIndex: HistoricalIndex | null;
  addTelemetry: (point: TelemetryPoint) => void;
  addFusedInsight: (insight: FusedInsight) => void;
  setSessionOver: (status: boolean) => void;
  setTelemetryStatus: (status: ConnectionStatus) => void;
  setInsightsStatus: (status: ConnectionStatus) => void;
  fetchTrackLayout: () => Promise<void>;
  fetchHistoricalIndex: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  liveTelemetry: [],
  fusedInsights: [],
  trackLayout: [],
  isSessionOver: false,
  telemetryStatus: 'connecting',
  insightsStatus: 'connecting',
  historicalIndex: null,
  addTelemetry: (point) =>
    set((state) => ({
      // Keep 1200 points to ensure the full lap history is retained for the track map (~2 minutes at 10Hz)
      liveTelemetry: [...state.liveTelemetry, point].slice(-1200)
    })),
  addFusedInsight: (insight) =>
    set((state) => ({
      // Append new insights to the top
      fusedInsights: [insight, ...state.fusedInsights]
    })),
  setSessionOver: (status) => set({ isSessionOver: status }),
  setTelemetryStatus: (status) => set({ telemetryStatus: status }),
  setInsightsStatus: (status) => set({ insightsStatus: status }),
  fetchTrackLayout: async () => {
    try {
      const response = await fetch('http://localhost:8000/api/track-layout');
      if (response.ok) {
        const layout = await response.json();
        set({ trackLayout: layout });
      }
    } catch (e) {
      console.error('Failed to fetch track layout', e);
    }
  },
  fetchHistoricalIndex: async () => {
    try {
      const response = await fetch('http://localhost:8000/api/historical/index');
      if (response.ok) {
        const index = await response.json();
        set({ historicalIndex: index });
      }
    } catch (e) {
      console.error('Failed to fetch historical index', e);
    }
  }
}));
