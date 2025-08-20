from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional, List
from uuid import UUID   
from datetime import datetime, timedelta

from app.presentation.api.dependencies import require_admin_access
from app.core.entities.user_claims import UserClaims
from app.presentation.schema.analytics_schema import (
    AdminAnalyticsResponse,
    VerificationMetricsResponse,
    AdminWorkloadResponse
)
from app.presentation.api.dependencies import get_employee_repository

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/admin-dashboard", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    user_claims: UserClaims = Depends(require_admin_access),
    employee_repository = Depends(get_employee_repository)
):
    """Get comprehensive analytics for admin dashboard."""
    
    # Calculate date range
    end_date = datetime.now(datetime.timezone.utc())
    start_date = end_date - timedelta(days=days)
    
    # Get verification metrics
    metrics = await _get_verification_metrics(employee_repository, start_date, end_date)
    
    # Get admin workload data
    workload = await _get_admin_workload(employee_repository)
    
    # Get bottleneck analysis
    bottlenecks = await _analyze_bottlenecks(employee_repository)
    
    return AdminAnalyticsResponse(
        period_days=days,
        verification_metrics=metrics,
        admin_workload=workload,
        bottlenecks=bottlenecks,
        recommendations=_generate_recommendations(metrics, workload, bottlenecks)
    )


@router.get("/verification-metrics", response_model=VerificationMetricsResponse)
async def get_verification_metrics(
    days: int = Query(30, ge=1, le=365),
    user_claims: UserClaims = Depends(require_admin_access),
    employee_repository = Depends(get_employee_repository)
):
    """Get detailed verification process metrics."""
    
    end_date = datetime.now(datetime.timezone.utc())
    start_date = end_date - timedelta(days=days)
    
    metrics = await _get_verification_metrics(employee_repository, start_date, end_date)
    return metrics


@router.get("/admin-workload", response_model=AdminWorkloadResponse) 
async def get_admin_workload(
    user_claims: UserClaims = Depends(require_admin_access),
    employee_repository = Depends(get_employee_repository)
):
    """Get admin workload distribution."""
    
    workload = await _get_admin_workload(employee_repository)
    return workload


# Helper functions for analytics

async def _get_verification_metrics(employee_repository, start_date: datetime, end_date: datetime) -> VerificationMetricsResponse:
    """Calculate verification process metrics."""
    
    # This would involve complex database queries
    # For now, returning mock data structure
    return VerificationMetricsResponse(
        total_submissions=150,
        completed_verifications=120,
        pending_reviews=25,
        rejected_profiles=5,
        completion_rate=80.0,
        average_processing_days=3.5,
        stage_metrics={
            "details_review": {"avg_time_hours": 8, "pending_count": 5},
            "documents_review": {"avg_time_hours": 16, "pending_count": 10},
            "role_assignment": {"avg_time_hours": 4, "pending_count": 6},
            "final_approval": {"avg_time_hours": 2, "pending_count": 4}
        },
        daily_trends=[
            {"date": "2024-01-01", "submissions": 5, "completions": 4},
            {"date": "2024-01-02", "submissions": 8, "completions": 6}
        ]
    )


async def _get_admin_workload(employee_repository) -> AdminWorkloadResponse:
    """Calculate admin workload distribution."""
    
    return AdminWorkloadResponse(
        total_pending_reviews=25,
        urgent_reviews=3,
        admin_distribution=[
            {"admin_name": "Admin User", "pending_count": 15, "completed_today": 8},
            {"admin_name": "Senior Admin", "pending_count": 10, "completed_today": 12}
        ],
        workload_balance_score=0.85
    )


async def _analyze_bottlenecks(employee_repository) -> Dict[str, Any]:
    """Analyze process bottlenecks."""
    
    return {
        "stage_bottlenecks": [
            {
                "stage": "documents_review",
                "severity": "high",
                "avg_delay_days": 4.5,
                "pending_count": 15,
                "recommendation": "Increase document review capacity"
            },
            {
                "stage": "role_assignment",
                "severity": "medium", 
                "avg_delay_days": 2.1,
                "pending_count": 8,
                "recommendation": "Streamline role assignment process"
            }
        ],
        "overall_bottleneck_score": 0.65
    }


def _generate_recommendations(metrics, workload, bottlenecks) -> List[str]:
    """Generate actionable recommendations."""
    
    recommendations = []
    
    if metrics.completion_rate < 85:
        recommendations.append("Consider reviewing rejection criteria to improve completion rate")
    
    if metrics.average_processing_days > 5:
        recommendations.append("Process time exceeds target - consider adding review capacity")
    
    if workload.urgent_reviews > 5:
        recommendations.append("High number of urgent reviews - prioritize older submissions")
    
    if bottlenecks["overall_bottleneck_score"] < 0.7:
        recommendations.append("Significant process bottlenecks detected - review workflow efficiency")
    
    return recommendations or ["Process is running efficiently"]