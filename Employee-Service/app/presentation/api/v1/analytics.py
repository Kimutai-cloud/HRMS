from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional, List
from uuid import UUID   
from datetime import datetime, timedelta

from sqlalchemy import text
from app.infrastructure.database.connections import db_connection
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
async def _get_verification_metrics(employee_repository, start_date: datetime, end_date: datetime) -> VerificationMetricsResponse:
    """Calculate actual verification process metrics."""

    async with db_connection.async_session() as session:
        # Get submission counts
        submissions_result = await session.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN verification_status = 'VERIFIED' THEN 1 END) as completed,
                   COUNT(CASE WHEN verification_status = 'REJECTED' THEN 1 END) as rejected,
                   COUNT(CASE WHEN verification_status IN (
                       'PENDING_DETAILS_REVIEW', 'PENDING_DOCUMENTS_REVIEW', 
                       'PENDING_ROLE_ASSIGNMENT', 'PENDING_FINAL_APPROVAL'
                   ) THEN 1 END) as pending
            FROM employees 
            WHERE submitted_at BETWEEN :start_date AND :end_date
        """), {"start_date": start_date, "end_date": end_date})
        
        metrics = submissions_result.fetchone()
        
        # Calculate average processing time
        processing_time_result = await session.execute(text("""
            SELECT AVG(EXTRACT(epoch FROM (final_approved_at - submitted_at))/86400) as avg_days
            FROM employees 
            WHERE verification_status = 'VERIFIED' 
            AND submitted_at BETWEEN :start_date AND :end_date
            AND final_approved_at IS NOT NULL
        """), {"start_date": start_date, "end_date": end_date})
        
        avg_processing = processing_time_result.scalar() or 0
        
        # Get stage-specific metrics
        stage_metrics = {}
        stages = [
            ("details_review", "PENDING_DETAILS_REVIEW"),
            ("documents_review", "PENDING_DOCUMENTS_REVIEW"),
            ("role_assignment", "PENDING_ROLE_ASSIGNMENT"),
            ("final_approval", "PENDING_FINAL_APPROVAL")
        ]
        
        for stage_name, status in stages:
            stage_result = await session.execute(text("""
                SELECT COUNT(*) as pending_count,
                       AVG(EXTRACT(epoch FROM (NOW() - submitted_at))/3600) as avg_time_hours
                FROM employees 
                WHERE verification_status = :status
            """), {"status": status})
            
            stage_data = stage_result.fetchone()
            stage_metrics[stage_name] = {
                "avg_time_hours": round(stage_data.avg_time_hours or 0, 1),
                "pending_count": stage_data.pending_count or 0
            }
        
        # Calculate completion rate
        completion_rate = (metrics.completed / metrics.total * 100) if metrics.total > 0 else 0
        
        return VerificationMetricsResponse(
            total_submissions=metrics.total,
            completed_verifications=metrics.completed,
            pending_reviews=metrics.pending,
            rejected_profiles=metrics.rejected,
            completion_rate=round(completion_rate, 1),
            average_processing_days=round(avg_processing, 1),
            stage_metrics=stage_metrics,
            daily_trends=await _get_daily_trends(session, start_date, end_date)
        )

async def _get_daily_trends(session, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
    """Get daily submission and completion trends."""
    
    trends_result = await session.execute(text("""
        SELECT DATE(submitted_at) as date,
               COUNT(*) as submissions,
               COUNT(CASE WHEN verification_status = 'VERIFIED' THEN 1 END) as completions
        FROM employees 
        WHERE submitted_at BETWEEN :start_date AND :end_date
        GROUP BY DATE(submitted_at)
        ORDER BY DATE(submitted_at)
    """), {"start_date": start_date, "end_date": end_date})
    
    return [
        {
            "date": row.date.strftime("%Y-%m-%d"),
            "submissions": row.submissions,
            "completions": row.completions
        }
        for row in trends_result.fetchall()
    ]


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