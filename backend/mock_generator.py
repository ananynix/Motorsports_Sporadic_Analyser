import asyncio
import json
import random
import time
import os
import redis.asyncio as redis

class HistoricalGenerator:
    def __init__(self, publish_callback, insight_callback):
        self.publish_callback = publish_callback
        self.insight_callback = insight_callback
        self.running = False
        self.data_points = []
        self.current_idx = 0
        self.history = []
        
        # Load the Belgium GP data
        json_path = os.path.join(os.path.dirname(__file__), 'belgium_gp_telemetry.json')
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                self.data_points = json.load(f)
        else:
            print("WARNING: belgium_gp_telemetry.json not found. Using fallback mock data.")
            self.data_points = [{"speed": 0, "rpm": 0, "throttle": 0, "brake_pressure": 0, "x": 0, "y": 0, "tire_temp_fl": 100, "tire_temp_fr": 100, "tire_temp_rl": 100, "tire_temp_rr": 100}]

    async def start(self):
        self.running = True
        redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        
        # Run telemetry stream and sporadic audio simulation concurrently in the background
        asyncio.create_task(self._stream_telemetry(redis_client))
        asyncio.create_task(self._generate_sporadic_audio(redis_client))

    async def _stream_telemetry(self, redis_client):
        while self.running:
            if not self.data_points:
                await asyncio.sleep(1)
                continue
                
            # Get current point and loop around if at the end
            point = self.data_points[self.current_idx]
            self.current_idx = (self.current_idx + 1) % len(self.data_points)
            
            payload = {
                "ts": time.time(),
                "speed": point["speed"],
                "rpm": point["rpm"],
                "throttle": point["throttle"],
                "brake_pressure": point["brake_pressure"],
                "x": point["x"],
                "y": point["y"],
                # Fluctuate tire temps slightly for visual effect
                "tire_temp_fl": round(point["tire_temp_fl"] + random.uniform(-2, 2), 2),
                "tire_temp_fr": round(point["tire_temp_fr"] + random.uniform(-2, 2), 2),
                "tire_temp_rl": round(point["tire_temp_rl"] + random.uniform(-2, 2), 2),
                "tire_temp_rr": round(point["tire_temp_rr"] + random.uniform(-2, 2), 2),
            }
            
            self.history.append(payload)
            if len(self.history) > 20:
                self.history.pop(0)
                
            await redis_client.set("latest_telemetry", json.dumps(payload))
            await self.publish_callback(payload)
            # 10Hz to prevent React DOM/Heap crash
            await asyncio.sleep(0.1) 

    async def _generate_sporadic_audio(self, redis_client):
        # We publish to audio_events to test the worker STT pipeline
        transcripts = [
            "Max: Tires are dropping off, no grip in sector 2.",
            "Max: Brake pedal feels a bit long into turn 1.",
            "GP: Copy Max, engine modes look good, keep pushing.",
            "Max: I'm struggling with the rear on exit.",
            "Max: Front left is graining, front left is graining."
        ]
        
        while self.running:
            await asyncio.sleep(random.uniform(15.0, 35.0)) # Random interval between 15-35s
            
            transcript = random.choice(transcripts)
            
            # Send to worker via redis pubsub
            payload = {
                "mock_transcript": transcript,
                "start_ts": time.time() - 5.0,
                "end_ts": time.time()
            }
            await redis_client.publish("audio_events", json.dumps(payload))

