from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.util.init_db import create_tables
from app.routers.auth import authRouter

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating tables...")
    create_tables()
    yield 

app = FastAPI(lifespan=lifespan)
app.include_router(authRouter, prefix="/auth", tags=["auth"])

@app.get("/health")
def health_check():
    return {"status": "Running..."}
