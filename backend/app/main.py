from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

from app.database import Base, engine
from app.routers import screener, rules, signals
from app.routers.auth import router as auth_router
from app.services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Signal App API", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(screener.router)
app.include_router(rules.router)
app.include_router(signals.router)


@app.get("/health")
def health():
    return {"status": "ok"}
