from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

from app.database import Base, engine
from app.limiter import limiter
from app.routers import screener, signals
from app.routers import rules as rules_module
from app.routers.auth import router as auth_router
from app.services.scheduler import start_scheduler


def _run_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        # Phase 1 — original columns
        conn.execute(text("ALTER TABLE watchlist_symbols ADD COLUMN IF NOT EXISTS company_name VARCHAR DEFAULT ''"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expiry FLOAT"))
        # Phase 2 — standalone rules + watchlist rule assignment
        conn.execute(text("ALTER TABLE rules ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
        conn.execute(text("ALTER TABLE rules ALTER COLUMN watchlist_id DROP NOT NULL") )
        conn.execute(text("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS rule_id INTEGER"))
        conn.execute(text("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS rule_active BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE watchlist_symbols ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE alert_channels ADD COLUMN IF NOT EXISTS watchlist_id INTEGER REFERENCES watchlists(id)"))
        conn.execute(text("ALTER TABLE alert_channels ALTER COLUMN rule_id DROP NOT NULL"))
        # Phase 3 — position sizing for webhook trade orders
        conn.execute(text("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS position_sizing_type VARCHAR DEFAULT 'dollars'"))
        conn.execute(text("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS position_sizing_value FLOAT DEFAULT 1000.0"))
        # Data migration: propagate user_id to existing rules
        conn.execute(text("""
            UPDATE rules SET user_id = watchlists.user_id
            FROM watchlists WHERE watchlists.id = rules.watchlist_id AND rules.user_id IS NULL
        """))
        # Data migration: assign the first rule of each watchlist as its rule_id
        conn.execute(text("""
            UPDATE watchlists SET rule_id = sub.id
            FROM (SELECT DISTINCT ON (watchlist_id) id, watchlist_id FROM rules ORDER BY watchlist_id, id) sub
            WHERE watchlists.id = sub.watchlist_id AND watchlists.rule_id IS NULL
        """))
        # Data migration: carry over rule.active to watchlist.rule_active
        conn.execute(text("""
            UPDATE watchlists SET rule_active = rules.active
            FROM rules WHERE rules.id = watchlists.rule_id AND watchlists.rule_active = FALSE AND rules.active = TRUE
        """))
        # Data migration: move existing alert_channels to watchlist level
        conn.execute(text("""
            UPDATE alert_channels SET watchlist_id = rules.watchlist_id
            FROM rules WHERE rules.id = alert_channels.rule_id AND alert_channels.watchlist_id IS NULL
        """))
        # Phase 4 — buy/sell position pairing
        conn.execute(text("ALTER TABLE signals ADD COLUMN IF NOT EXISTS watchlist_id INTEGER REFERENCES watchlists(id)"))
        conn.execute(text("ALTER TABLE signals ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE signals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP"))
        conn.execute(text("ALTER TABLE signals ADD COLUMN IF NOT EXISTS closes_signal_id INTEGER REFERENCES signals(id) ON DELETE SET NULL"))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Signal App API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://signalflow.app",
        "https://web-rho-sable-37.vercel.app",
        "https://web-mca1p4zlf-chandwanis-3660s-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router)
app.include_router(screener.router)
app.include_router(rules_module.router)        # standalone rules: /rules
app.include_router(rules_module.legacy)        # legacy: /watchlists/{id}/rules
app.include_router(signals.router)


@app.get("/health")
def health():
    return {"status": "ok"}
