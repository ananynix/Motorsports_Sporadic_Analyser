import asyncio
import json
import os
import redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Dict, Any, List

from fusion_engine import fuse_data, compute_lap_baseline, predictor
from redis_client import redis_client
from mock_generator import HistoricalGenerator, AUDIO_STREAM, STREAM_MAXLEN
import time

HISTORICAL_ROOT = os.path.join(os.path.dirname(__file__), "data", "historical")

# Streams (not pub/sub) so a message published while a consumer is briefly
# disconnected isn't lost -- it stays in the stream until XACK'd. Names must
# match worker/tasks.py's AUDIO_STREAM / TRANSCRIPT_STREAM.
TRANSCRIPT_STREAM = "stream:transcript_ready"
TRANSCRIPT_GROUP = "insight_consumers"
TRANSCRIPT_CONSUMER = "api-1"
FUSED_INSIGHTS_STREAM = "stream:fused_insights"


def ensure_group(client, stream, group):
    """Idempotent consumer-group creation -- safe to call on every (re)connect."""
    try:
        client.xgroup_create(stream, group, id="$", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()
insights_manager = ConnectionManager()

async def broadcast_telemetry(payload: dict):
    await manager.broadcast(payload)

async def broadcast_insight(payload: dict):
    # Bypass NLP model: directly fuse the text transcript with the current telemetry window
    start_ts = payload["timestamp"] - 5.0
    end_ts = payload["timestamp"]
    fused = fuse_data(start_ts, end_ts, payload["transcript"])
    await insights_manager.broadcast({"type": "fused_insight", "payload": fused})

# Global generator
generator = HistoricalGenerator(publish_callback=broadcast_telemetry, insight_callback=broadcast_insight)

def _read_transcript_stream():
    """Blocking XREADGROUP call -- run via asyncio.to_thread so it doesn't
    stall the event loop. Blocks up to 2s and returns immediately on new
    data, so this is strictly more responsive than the old 100ms poll loop."""
    return redis_client.xreadgroup(
        TRANSCRIPT_GROUP,
        TRANSCRIPT_CONSUMER,
        {TRANSCRIPT_STREAM: ">"},
        count=1,
        block=2000,
    )

async def listen_to_redis():
    # Redis may not be resolvable/reachable yet at container boot (a real,
    # observed race: this task can start querying Redis before Docker's
    # embedded DNS resolver inside this container is ready). A ConnectionError
    # here must not permanently kill this task -- retry with backoff instead.
    while True:
        try:
            ensure_group(redis_client, TRANSCRIPT_STREAM, TRANSCRIPT_GROUP)
            while True:
                try:
                    resp = await asyncio.to_thread(_read_transcript_stream)
                except redis.exceptions.TimeoutError:
                    # Benign: the blocking read's BLOCK window elapsed with no
                    # new data. socket_timeout is tuned to exceed BLOCK so this
                    # shouldn't normally fire, but treat it the same as an
                    # empty response rather than a real connection failure.
                    continue
                if not resp:
                    continue
                for _stream_name, messages in resp:
                    for msg_id, fields in messages:
                        data = json.loads(fields["data"])

                        if data.get("transcript"):
                            # We got a transcript from the worker, let's fuse it with telemetry
                            recent_data = generator.history
                            fused = fuse_data(data.get("start_ts", 0), data.get("end_ts", 0), data["transcript"], recent_data, generator.lap_baseline)
                            # Broadcast directly to websocket
                            await insights_manager.broadcast({"type": "fused_insight", "payload": fused})
                            # Keep a lightweight historical record (no consumer yet)
                            redis_client.xadd(FUSED_INSIGHTS_STREAM, {"data": json.dumps(fused)}, maxlen=STREAM_MAXLEN, approximate=True)

                        redis_client.xack(TRANSCRIPT_STREAM, TRANSCRIPT_GROUP, msg_id)
        except redis.exceptions.RedisError as e:
            print(f"listen_to_redis: Redis connection error ({e}), retrying in 2s...")
            await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start generators and redis listeners
    await generator.start()
    asyncio.create_task(listen_to_redis())
    yield
    # Shutdown
    await generator.stop()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Real-Time Telemetry & Tactical Comm-Link Analyzer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AudioEvent(BaseModel):
    start_ts: float
    end_ts: float
    mock_transcript: str

class HistoricalAnalyzeRequest(BaseModel):
    at_index: int
    transcript: str

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

@app.websocket("/ws/insights")
async def websocket_insights_endpoint(websocket: WebSocket):
    await insights_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        insights_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        insights_manager.disconnect(websocket)

@app.post("/api/audio-event")
async def receive_audio_event(event: AudioEvent, background_tasks: BackgroundTasks):
    payload = event.model_dump()
    # redis_client is the sync client from redis_client.py -- xadd() returns
    # the new entry id (a str), not an awaitable, so this must not be awaited.
    # Redis is reachable from this container intermittently (an observed,
    # transient DNS resolution failure against the "redis" service name at the
    # Docker network level), so a couple of quick retries here smooths over a
    # bad moment instead of surfacing a 500 to the frontend for it.
    last_error = None
    for attempt in range(3):
        try:
            redis_client.xadd(AUDIO_STREAM, {"data": json.dumps(payload)}, maxlen=STREAM_MAXLEN, approximate=True)
            return {"status": "event_queued"}
        except redis.exceptions.RedisError as e:
            last_error = e
            await asyncio.sleep(0.3)
    print(f"receive_audio_event: Redis xadd failed after retries: {last_error}")
    return {"status": "event_dropped", "error": str(last_error)}

@app.get("/api/track-layout")
async def get_track_layout():
    # Return just the x, y coordinates to draw the track boundary
    return [{"x": p["x"], "y": p["y"]} for p in generator.data_points]

def _load_historical_manifest():
    index_path = os.path.join(HISTORICAL_ROOT, "index.json")
    if not os.path.exists(index_path):
        return None
    with open(index_path) as f:
        return json.load(f)

@app.get("/api/historical/index")
async def get_historical_index():
    manifest = _load_historical_manifest()
    if manifest is None:
        # No historical batch download has been run yet -- a sane empty
        # shape so the frontend picker can render a "nothing yet" state
        # instead of erroring.
        return {"season": None, "session_type": None, "events": []}
    return manifest

def _load_historical_lap(event_slug: str, driver: str) -> list:
    manifest = _load_historical_manifest()
    if manifest is None:
        raise HTTPException(status_code=404, detail="No historical data available")

    # Validate against the manifest (known-good values) before touching the
    # filesystem at all -- never join raw path segments from the request.
    event = next((e for e in manifest["events"] if e["event_slug"] == event_slug), None)
    if event is None or driver not in event["drivers"]:
        raise HTTPException(status_code=404, detail="Unknown event or driver")

    file_path = os.path.join(
        HISTORICAL_ROOT, str(manifest["season"]), event["event_slug"],
        manifest["session_type"], f"{driver}.json",
    )
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Telemetry file not found")

    with open(file_path) as f:
        return json.load(f)

@app.get("/api/historical/telemetry/{event_slug}/{driver}")
async def get_historical_telemetry(event_slug: str, driver: str):
    return _load_historical_lap(event_slug, driver)

@app.post("/api/historical/analyze/{event_slug}/{driver}")
async def analyze_historical_moment(event_slug: str, driver: str, body: HistoricalAnalyzeRequest):
    points = _load_historical_lap(event_slug, driver)

    # The TCN needs a full input window ending at at_index, and at_index must
    # be a real point in this lap.
    if body.at_index < predictor.seq_length - 1 or body.at_index >= len(points):
        raise HTTPException(
            status_code=400,
            detail=f"at_index must be between {predictor.seq_length - 1} and {len(points) - 1} for this lap",
        )

    # Historical points have no real timestamps (a static per-lap extraction,
    # not a live timestamped stream) -- synthesize a sequential ts, same as
    # HistoricalReplay.tsx already does client-side for charting. fuse_data
    # needs recent_data[-1]["ts"] to place predicted points in time.
    recent_data = [{**p, "ts": i} for i, p in enumerate(points[: body.at_index + 1])]

    # This driver's real average pace for this specific lap -- same semantics
    # as the live path's generator.lap_baseline, computed over the whole lap.
    lap_baseline = compute_lap_baseline(points)

    return fuse_data(
        start_ts=body.at_index - 5,
        end_ts=body.at_index,
        transcript=body.transcript,
        recent_data=recent_data,
        lap_baseline=lap_baseline,
    )
