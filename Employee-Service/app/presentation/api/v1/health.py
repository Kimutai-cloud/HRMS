from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import get_db_session

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/", response_model=SuccessResponse)
async def health_check():
    """Health check endpoint."""
    return SuccessResponse(message="Employee Service is healthy")


@router.get("/ready", response_model=SuccessResponse)
async def readiness_check(session: AsyncSession = Depends(get_db_session)):
    """Readiness check endpoint with database connectivity."""
    try:
        # Test database connection
        result = await session.execute(text("SELECT 1"))
        result.scalar()
        
        return SuccessResponse(message="Employee Service is ready")
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}"
        )


@router.get("/live", response_model=SuccessResponse)
async def liveness_check():
    """Liveness check endpoint."""
    return SuccessResponse(message="Employee Service is alive")