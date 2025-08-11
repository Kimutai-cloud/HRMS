from fastapi import APIRouter
from app.presentation.schema.common_schema import SuccessResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/", response_model=SuccessResponse)
async def health_check():
    """Health check endpoint."""
    return SuccessResponse(message="Service is healthy")


@router.get("/ready", response_model=SuccessResponse)
async def readiness_check():
    """Readiness check endpoint."""
    return SuccessResponse(message="Service is ready")

