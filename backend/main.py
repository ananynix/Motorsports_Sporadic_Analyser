import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Dict, Any, List

from fusion_engine import fuse_data
from redis_client import redis_client
from mock_generator import DataGenerator

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # We need to handle potential disconnects during broadcast
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# This is our callback for the DataGenerator to send telemetry to WS
async def broadcast_telemetry(payload: dict):
    await manager.broadcast(payload)

# Global generator
generator = DataGenerator(publish_callback=broadcast_telemetry)

async def listen_to_redis():
    pubsub = redis_client.pubsub()
    pubsub.subscribe("transcript_ready", "fused_insights")
    while True:
        message = pubsub.get_message(ignore_subscribe_messages=True)
        if message:
            channel = message["channel"]
            data = json.loads(message["data"])
            
            if channel == "transcript_ready":
                # We got a transcript from the worker, let's fuse it with telemetry
                fused = fuse_data(data["start_ts"], data["end_ts"], data["transcript"])
                # Broadcast directly to websocket
                await manager.broadcast({"type": "fused_insight", "payload": fused})
                # Optionally publish to redis
                redis_client.publish("fused_insights", json.dumps(fused))
                
            elif channel == "fused_insights":
                pass # Already broadcasted above if we generated it, or we could just listen here and broadcast.
                # Since we broadcast directly in transcript_ready, we can ignore this, 
                # or we broadcast here instead. Let's just broadcast in transcript_ready.
        await asyncio.sleep(0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start generators and redis listeners
    await generator.start()
    asyncio.create_task(listen_to_redis())
    yield
    # Shutdown
    await generator.stop()

app = FastAPI(title="Real-Time Telemetry & Tactical Comm-Link Analyzer", lifespan=lifespan)

class AudioEvent(BaseModel):
    start_ts: float
    end_ts: float
    mock_transcript: str

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We can also receive messages from frontend if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

@app.post("/api/audio-event")
async def receive_audio_event(event: AudioEvent, background_tasks: BackgroundTasks):
    payload = event.model_dump()
    redis_client.publish("audio_events", json.dumps(payload))
    return {"status": "event_queued"}
