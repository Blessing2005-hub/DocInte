"""
Blocks password guessing. Wrong passwords are counted per (EC number + the
visitor's address), and per address overall. After too many in a short time
the person must wait before trying again. A correct login clears the count.

Counts are kept in memory, which is right for a single server process. If you
later run several server processes, move the counts to the database or Redis.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import LOGIN_MAX_FAILS, LOGIN_WINDOW_SECONDS

_PER_ADDRESS_MAX = LOGIN_MAX_FAILS * 4

_fails = defaultdict(deque)  # key -> timestamps of recent failures


def client_address(request: Request) -> str:
    # Behind a host's proxy the real address is the first X-Forwarded-For entry.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _recent(key: str):
    q = _fails[key]
    cutoff = time.time() - LOGIN_WINDOW_SECONDS
    while q and q[0] < cutoff:
        q.popleft()
    if not q:
        _fails.pop(key, None)
        return deque()
    return q


def check_allowed(ec_number: str, address: str):
    pair = _recent(f"pair:{ec_number.lower()}|{address}")
    addr = _recent(f"addr:{address}")
    if len(pair) >= LOGIN_MAX_FAILS or len(addr) >= _PER_ADDRESS_MAX:
        oldest = (pair[0] if len(pair) >= LOGIN_MAX_FAILS else addr[0])
        wait = max(1, int(oldest + LOGIN_WINDOW_SECONDS - time.time()))
        minutes = max(1, (wait + 59) // 60)
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
            headers={"Retry-After": str(wait)},
        )


def record_failure(ec_number: str, address: str):
    now = time.time()
    _fails[f"pair:{ec_number.lower()}|{address}"].append(now)
    _fails[f"addr:{address}"].append(now)


def record_success(ec_number: str, address: str):
    _fails.pop(f"pair:{ec_number.lower()}|{address}", None)
