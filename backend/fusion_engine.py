import os
import json
from openai import OpenAI
from dl_model import TelemetryPredictor

# Initialize the Deep Learning Telemetry Predictor
predictor = TelemetryPredictor()

# Initialize OpenAI client for LLM intent extraction
# If no key is set, it will fail gracefully and use a fallback
openai_client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY", "dummy_key"),
    base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
)

def extract_tactical_intent(transcript: str) -> dict:
    try:
        if openai_client.api_key == "dummy_key":
            raise Exception("No API key provided.")
            
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an F1 tactical race engineer. Analyze the radio transcript and return a JSON object with 'intent', 'severity' (Low/Medium/High), and 'tactical_action'."},
                {"role": "user", "content": transcript}
            ],
            response_format={ "type": "json_object" }
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"LLM API fallback due to: {e}")
        # Fallback to simple rule-based intent
        if "rear" in transcript.lower() or "graining" in transcript.lower() or "dropping" in transcript.lower():
            return {"intent": "Tire Degradation", "severity": "High", "tactical_action": "Brake earlier, manage rear slip"}
        elif "brake" in transcript.lower():
            return {"intent": "Brake Wear", "severity": "Medium", "tactical_action": "Shift brake bias forward"}
        else:
            return {"intent": "General Check-in", "severity": "Low", "tactical_action": "Maintain pace"}

def fuse_data(start_ts: float, end_ts: float, transcript: str, recent_data: list = None) -> dict:
    # 1. NLP Pipeline: Extract tactical intent
    intent_data = extract_tactical_intent(transcript)
    
    # 2. Deep Learning Pipeline: Predict future trajectories
    predicted_telemetry = []
    if recent_data and len(recent_data) >= 20:
        preds = predictor.predict(recent_data)
        if preds:
            # Shift timestamps into the future for the predicted telemetry
            last_ts = recent_data[-1]["ts"]
            for i, p in enumerate(preds):
                p["ts"] = last_ts + (i + 1) * 0.1
                predicted_telemetry.append(p)
                
    fused_object = {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "transcript": transcript,
        "intent": intent_data["intent"],
        "severity": intent_data["severity"],
        "tactical_action": intent_data["tactical_action"],
        "insights": f"NLP Analysis: {intent_data['tactical_action']}. DL Model forecasts shifted tire degradation trajectory.",
        "predicted_telemetry": predicted_telemetry
    }
    return fused_object
