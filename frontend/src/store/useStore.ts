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
  x: number;
  y: number;
}

interface FusedInsight {
  start_ts: number;
  end_ts: number;
  transcript: string;
  intent?: string;
  severity?: string;
  tactical_action?: string;
  insights: string;
  predicted_telemetry?: TelemetryPoint[];
}

interface TrackPoint {
  x: number;
  y: number;
}

interface AppState {
  liveTelemetry: TelemetryPoint[];
  fusedInsights: FusedInsight[];
  trackLayout: TrackPoint[];
  isSessionOver: boolean;
  addTelemetry: (point: TelemetryPoint) => void;
  addFusedInsight: (insight: FusedInsight) => void;
  setSessionOver: (status: boolean) => void;
  fetchTrackLayout: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  liveTelemetry: [],
  fusedInsights: [],
  trackLayout: [],
  isSessionOver: false,
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
  }
}));
