from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

from app.database import Base, engine
from app.limiter import limiter
from app.routers import screener, rules, signals
from app.routers.auth import router as auth_router
from app.services.scheduler import start_scheduler


def _run_migrations():
    with engine.connect() as conn:
        conn.execute(__import__("sqlalchemy").text(
            "ALTER TABLE watchlist_symbols ADD COLUMN IF NOT EXISTS company_name VARCHAR DEFAULT ''"
        ))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Signal App API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router)
app.include_router(screener.router)
app.include_router(rules.router)
app.include_router(signals.router)


@app.get("/health")
def health():
    return {"status": "ok"}
