import asyncio
import json
import time
import random
import math
from redis_client import redis_client

class DataGenerator:
    def __init__(self, publish_callback):
        self.publish_callback = publish_callback
        self.running = False
    
    async def start(self):
        self.running = True
        asyncio.create_task(self._generate_telemetry())
        asyncio.create_task(self._generate_sporadic_audio())

    async def stop(self):
        self.running = False

    async def _generate_telemetry(self):
        """Generates 100Hz telemetry data simulating an F1 car"""
        while self.running:
            ts = time.time()
            # Simple sine wave simulation for speed and rpm
            speed = max(0, 150 + 100 * math.sin(ts / 2.0) + random.uniform(-5, 5))
            rpm = max(1000, 7000 + 5000 * math.sin(ts / 2.0) + random.uniform(-200, 200))
            throttle = max(0, min(100, 50 + 50 * math.sin(ts / 2.0)))
            brake_pressure = max(0, min(100, 50 - 50 * math.sin(ts / 2.0))) if throttle < 5 else 0
            tire_temp_fl = 90 + 10 * math.sin(ts / 5.0) + random.uniform(-1, 1)
            tire_temp_fr = 90 + 10 * math.sin(ts / 5.0) + random.uniform(-1, 1)
            tire_temp_rl = 95 + 12 * math.sin(ts / 5.0) + random.uniform(-1, 1)
            tire_temp_rr = 95 + 12 * math.sin(ts / 5.0) + random.uniform(-1, 1)

            payload = {
                "type": "telemetry",
                "ts": ts,
                "speed": round(speed, 2),
                "rpm": round(rpm, 2),
                "throttle": round(throttle, 2),
                "brake_pressure": round(brake_pressure, 2),
                "tire_temp_fl": round(tire_temp_fl, 2),
                "tire_temp_fr": round(tire_temp_fr, 2),
                "tire_temp_rl": round(tire_temp_rl, 2),
                "tire_temp_rr": round(tire_temp_rr, 2),
            }
            # For simplicity, store in redis (as latest state or list)
            # In a real app we would use Redis TimeSeries
            redis_client.set("latest_telemetry", json.dumps(payload))
            await self.publish_callback(payload)
            await asyncio.sleep(0.01) # 100Hz

    async def _generate_sporadic_audio(self):
        """Generates sporadic radio communications"""
        transcripts = [
            "Tire degradation is high on turn 4.",
            "I'm losing grip on the rears.",
            "Engine feels a bit sluggish on the straight.",
            "Box box, we need to check the front wing.",
            "Brake pedal is getting soft."
        ]
        while self.running:
            # Wait for a random interval between 10 and 20 seconds
            await asyncio.sleep(random.uniform(10, 20))
            
            ts = time.time()
            event = {
                "start_ts": ts - 5,
                "end_ts": ts,
                "mock_transcript": random.choice(transcripts)
            }
            print(f"Mock Audio Event Generated: {event['mock_transcript']}")
            # Publish to redis so worker picks it up
            redis_client.publish("audio_events", json.dumps(event))
