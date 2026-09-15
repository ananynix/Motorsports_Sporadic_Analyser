import asyncio
import json
import random
import time
import os
import redis
import redis.asyncio as aioredis

from fusion_engine import compute_lap_baseline

# Streams (not pub/sub) for sporadic events so a message published while no
# consumer is connected isn't silently lost -- it stays in the stream until
# XACK'd. Must match the stream/group names used in worker/tasks.py and
# backend/main.py.
AUDIO_STREAM = "stream:audio_events"
STREAM_MAXLEN = 1000


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

        # This lap's own average performance (real, already-observed data --
        # not invented) -- used by fusion_engine.py as the "recovery target"
        # for its illustrative reality-vs-recommended comparison (Phase 11).
        self.lap_baseline = compute_lap_baseline(self.data_points)

    async def start(self):
        self.running = True
        redis_client = aioredis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        
        # Run telemetry stream and sporadic audio simulation concurrently in the background
        asyncio.create_task(self._stream_telemetry(redis_client))
        asyncio.create_task(self._generate_sporadic_audio(redis_client))

    async def stop(self):
        self.running = False

    async def _stream_telemetry(self, redis_client):
        while self.running:
            if not self.data_points:
                await asyncio.sleep(1)
                continue
            if self.current_idx >= len(self.data_points):
                try:
                    await redis_client.xadd(
                        AUDIO_STREAM,
                        {"data": json.dumps({"type": "session_complete"})},
                        maxlen=STREAM_MAXLEN,
                        approximate=True,
                    )  # Just publish a dummy audio_event or handle it directly
                except redis.exceptions.RedisError as e:
                    print(f"_stream_telemetry: Redis xadd failed ({e}), continuing without it")
                # Wait, better to publish to a dedicated channel or directly via publish_callback so websocket picks it up.
                await self.publish_callback({"type": "session_complete", "payload": "Session finished."})
                self.running = False
                break

            # Get current point
            point = self.data_points[self.current_idx]
            self.current_idx += 1

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

            # Redis may not be resolvable/reachable yet at container boot (an
            # observed startup race with Docker's embedded DNS resolver). A
            # transient ConnectionError here must not kill this loop forever --
            # the websocket broadcast below still reaches the frontend even if
            # this particular publish is dropped.
            try:
                await redis_client.set("latest_telemetry", json.dumps(payload))
            except redis.exceptions.RedisError as e:
                print(f"_stream_telemetry: Redis set failed ({e}), continuing without it")
            await self.publish_callback(payload)
            # 10Hz to prevent React DOM/Heap crash
            await asyncio.sleep(0.1)

    async def _generate_sporadic_audio(self, redis_client):
        # We publish to audio_events to test the worker STT pipeline
        transcripts = [
            "I'm losing grip on the rears.",
            "Max: Tires are dropping off, no grip in sector 2.",
            "The car feels great, maintaining pace.",
            "Front left is graining a bit, let's keep an eye on it.",
            "Brake pedal is getting long.",
            "Box this lap, box this lap.",
            "Engine temp is a bit high, harvest on the straights.",
            "Copy that, push now, push now.",
            # Deliberately ambiguous phrasing (Phase 9) -- exercises the
            # diagnostic precision layer's symptom-to-component reasoning
            # instead of a driver naming the part outright.
            "I don't feel my rear floor entirely.",
            "The rear just doesn't feel planted through the fast stuff.",
            "Car's bouncing like crazy down the straight.",
        ]
        
        while self.running:
            for transcript in transcripts:
                if not self.running:
                    break
                
                await asyncio.sleep(random.uniform(8.0, 12.0))

                # Send to worker via a Redis stream (not pub/sub) so the event
                # isn't lost if the worker happens to be briefly disconnected.
                payload = {
                    "mock_transcript": transcript,
                    "start_ts": time.time() - 5.0,
                    "end_ts": time.time()
                }
                try:
                    await redis_client.xadd(
                        AUDIO_STREAM,
                        {"data": json.dumps(payload)},
                        maxlen=STREAM_MAXLEN,
                        approximate=True,
                    )
                except redis.exceptions.RedisError as e:
                    print(f"_generate_sporadic_audio: Redis xadd failed ({e}), skipping this event")
            
            # If we exhausted the list but session is still running, optionally break or restart
            # Given the data length, it should roughly align. If we reach here, we can stop emitting or loop again.
            if not self.running:
                break

