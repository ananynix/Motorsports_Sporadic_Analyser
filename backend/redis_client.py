import redis
import os

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# socket_timeout must be comfortably larger than the largest BLOCK value used
# for XREADGROUP calls (main.py uses BLOCK=2000ms) -- otherwise the client's
# own socket read times out before the server's BLOCK window does, raising a
# spurious redis.exceptions.TimeoutError on every blocking read that finds no
# new data (a well-known redis-py gotcha with blocking stream/list commands).
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=10)
