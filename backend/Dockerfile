FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

# Without this, plain print() calls (e.g. the Redis retry/error logging added
# to main.py and mock_generator.py) sit in Python's stdout buffer and never
# reach `docker logs`, since stdout is fully block-buffered when it isn't a TTY.
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
