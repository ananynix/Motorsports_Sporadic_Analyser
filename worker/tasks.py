import json
import os
import subprocess
import tempfile
import time

import redis
import torch
from faster_whisper import WhisperModel

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
# socket_timeout must be comfortably larger than the BLOCK value used for
# XREADGROUP below (5000ms) -- otherwise the client's own socket read times
# out before the server's BLOCK window does, raising a spurious
# redis.exceptions.TimeoutError on every blocking read that finds no new data
# (a well-known redis-py gotcha with blocking stream/list commands).
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=10)

# Streams (not pub/sub) so a message published while this worker is briefly
# disconnected/restarting isn't lost -- it stays in the stream until XACK'd.
AUDIO_STREAM = "stream:audio_events"
AUDIO_GROUP = "stt_workers"
AUDIO_CONSUMER = "worker-1"
TRANSCRIPT_STREAM = "stream:transcript_ready"
STREAM_MAXLEN = 1000


def ensure_group(client, stream, group):
    """Idempotent consumer-group creation -- safe to call on every (re)connect."""
    try:
        client.xgroup_create(stream, group, id="$", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise

# --- Faster-Whisper model -------------------------------------------------
# "base" over "tiny": meaningfully better accuracy on technical/proper-noun
# jargon (driver names, car systems), which matters now that fusion_engine.py
# is trying to distinguish e.g. "floor" from "rear wing" -- still small enough
# for the GPU that already ran "tiny" comfortably.
WHISPER_MODEL_SIZE = "base"
print(f"Loading faster-whisper model ({WHISPER_MODEL_SIZE})...")
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"
whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device=device, compute_type=compute_type)
print(f"Faster-whisper model ({WHISPER_MODEL_SIZE}) loaded on {device} ({compute_type}).")


def synthesize_radio_audio(text: str) -> str:
    """
    Stand-in for real radio/mic capture (that lands with the Phase 8 frontend
    audio work). Converts the driver's line into an actual WAV file via
    espeak-ng so the worker has genuine audio to run inference on, instead of
    the silent numpy buffer this pipeline used to test against.

    Returns the path to a temporary mono WAV file. Caller is responsible for
    deleting it.
    """
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run(
            ["espeak-ng", "-s", "165", "-v", "en-us", "-w", wav_path, text],
            check=True,
            capture_output=True,
            timeout=15,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        if os.path.exists(wav_path):
            os.remove(wav_path)
        raise RuntimeError(f"espeak-ng synthesis failed: {e}") from e
    return wav_path


def transcribe_audio(wav_path: str) -> str:
    """
    Runs real faster-whisper inference on the given audio file and returns
    exactly what the model decoded -- never a hardcoded string.

    vad_filter=True drops non-speech segments before decoding, which is
    faster-whisper's documented mitigation for the model's known tendency to
    hallucinate phrases over silence/noise. condition_on_previous_text=False
    keeps each short radio clip an independent decode so one bad guess can't
    bias the next one.
    """
    segments, info = whisper_model.transcribe(
        wav_path,
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    text = " ".join(segment.text.strip() for segment in segments).strip()
    print(f"Whisper decoded (lang={info.language}, p={info.language_probability:.2f}): {text!r}")
    return text


def process_audio_event(event_data):
    print(f"Worker received event: {event_data}")

    # `mock_transcript` is the simulated content of a radio call -- the
    # ingestion layer doesn't capture real mic/radio audio yet (see Phase 8
    # in the project plan). We treat it as the *source text to speak*, not as
    # the answer: we synthesize real audio from it and run that audio through
    # the same faster-whisper inference the production audio path will use,
    # so `transcript` below is always the model's real decoding.
    source_text = event_data.get("mock_transcript", "") or ""
    wav_path = None
    real_transcript = ""

    try:
        if source_text.strip():
            wav_path = synthesize_radio_audio(source_text)
            real_transcript = transcribe_audio(wav_path)
    except Exception as e:
        print(f"STT pipeline error, publishing empty transcript: {e}")
        real_transcript = ""
    finally:
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

    transcript_result = {
        "start_ts": event_data.get("start_ts"),
        "end_ts": event_data.get("end_ts"),
        "transcript": real_transcript,
        # Kept only so the dashboard/demo can show "what was actually said"
        # vs. "what Whisper heard" side by side -- never used as the output.
        "source_text": source_text,
        "status": "processed" if real_transcript else "stt_failed",
    }

    redis_client.xadd(
        TRANSCRIPT_STREAM,
        {"data": json.dumps(transcript_result)},
        maxlen=STREAM_MAXLEN,
        approximate=True,
    )
    print(f"Worker published transcript_ready: {transcript_result}")


def listen_for_events():
    # Redis may not be resolvable/reachable yet at container boot (an observed
    # startup race with Docker's embedded DNS resolver: this worker happens to
    # dodge it today because loading the whisper model delays the first Redis
    # call, but that's luck, not a guarantee). Retry with backoff instead of
    # letting a transient ConnectionError crash the whole worker process.
    while True:
        try:
            ensure_group(redis_client, AUDIO_STREAM, AUDIO_GROUP)
            print("Worker listening for audio_events...")

            while True:
                try:
                    resp = redis_client.xreadgroup(
                        AUDIO_GROUP,
                        AUDIO_CONSUMER,
                        {AUDIO_STREAM: ">"},
                        count=1,
                        block=5000,
                    )
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
                        event_data = json.loads(fields["data"])
                        process_audio_event(event_data)
                        redis_client.xack(AUDIO_STREAM, AUDIO_GROUP, msg_id)
        except redis.exceptions.RedisError as e:
            print(f"listen_for_events: Redis connection error ({e}), retrying in 2s...")
            time.sleep(2)


if __name__ == "__main__":
    listen_for_events()
