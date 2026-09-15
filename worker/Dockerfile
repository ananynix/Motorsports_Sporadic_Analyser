FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

# Without this, tasks.py's print() calls sit in Python's stdout buffer and
# never reach `docker logs` (stdout is fully block-buffered, not line-buffered,
# when it isn't a TTY) -- making the worker's own STT pipeline unobservable.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# espeak-ng synthesizes real speech audio for the radio-call text so the STT
# step below has genuine audio to transcribe (see tasks.py) instead of the
# silent buffer this worker used to test the GPU path against.
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "tasks.py"]
