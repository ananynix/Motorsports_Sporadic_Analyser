import { Link } from '../router'
import { InteractiveCarBackground } from '../components/InteractiveCarBackground'
import { F1Logo } from '../components/F1Logo'

export const LandingPage = () => (
  <div className="relative min-h-screen w-full overflow-hidden bg-f1-dark text-white flex items-center justify-center">
    <div className="absolute inset-0 bg-carbon" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black" />
    <InteractiveCarBackground />

    <div className="relative z-10 flex flex-col items-center text-center px-6 animate-fade-in-up">
      <F1Logo className="h-10 md:h-14 mb-8 drop-shadow-[0_0_20px_rgba(225,6,0,0.5)]" />

      <p className="text-f1-red font-bold tracking-[0.3em] uppercase text-xs md:text-sm mb-4">
        Real-Time Telemetry &amp; Tactical Comm-Link Analysis
      </p>

      <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tight leading-none mb-6">
        Sporadic <span className="text-f1-red">Analyser</span>
      </h1>

      <p className="max-w-xl text-f1-muted text-sm md:text-base mb-10 leading-relaxed">
        Diagnose what a driver's radio call actually means, forecast where the telemetry
        is heading with a trained temporal convolutional network, and see the pace that
        was on the table if the call was read correctly.
      </p>

      <Link
        to="/setup"
        className="bg-f1-red hover:bg-f1-redDark active:scale-95 transition-all duration-150 hover:scale-105 px-10 py-4 rounded-md font-bold uppercase tracking-wide text-base shadow-lg shadow-f1-red/30"
      >
        Enter Analyser
      </Link>
    </div>

    <div className="absolute bottom-4 left-0 right-0 text-center text-f1-muted text-xs font-mono opacity-60 z-10">
      2024 Season Data &middot; PyTorch TCN Forecasting &middot; LLM Diagnostic Reasoning
    </div>
  </div>
)
