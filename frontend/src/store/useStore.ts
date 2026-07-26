import { create } from 'zustand';

interface TelemetryPoint {
  ts: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake_pressure: number;
  tire_temp_fl: number;
  tire_temp_fr: number;
  tire_temp_rl: number;
  tire_temp_rr: number;
}

interface FusedInsight {
  start_ts: number;
  end_ts: number;
  transcript: string;
  insights: string;
  telemetry_points: TelemetryPoint[];
}

interface AppState {
  liveTelemetry: TelemetryPoint[];
  fusedInsights: FusedInsight[];
  addTelemetry: (point: TelemetryPoint) => void;
  addFusedInsight: (insight: FusedInsight) => void;
}

export const useStore = create<AppState>((set) => ({
  liveTelemetry: [],
  fusedInsights: [],
  addTelemetry: (point) => 
    set((state) => ({ 
      // Keep only last 100 points for performance
      liveTelemetry: [...state.liveTelemetry, point].slice(-100) 
    })),
  addFusedInsight: (insight) =>
    set((state) => ({
      // Append new insights to the top
      fusedInsights: [insight, ...state.fusedInsights]
    })),
}));
