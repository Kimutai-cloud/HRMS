from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional


class StageMetric(BaseModel):
    """Metrics for a verification stage."""
    
    avg_time_hours: float = Field(..., description="Average time in hours")
    pending_count: int = Field(..., description="Number of pending items")


class DailyTrend(BaseModel):
    """Daily trend data."""
    
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    submissions: int = Field(..., description="Number of submissions")
    completions: int = Field(..., description="Number of completions")


class VerificationMetricsResponse(BaseModel):
    """Verification process metrics."""
    
    total_submissions: int = Field(..., description="Total profile submissions")
    completed_verifications: int = Field(..., description="Completed verifications")
    pending_reviews: int = Field(..., description="Pending reviews")
    rejected_profiles: int = Field(..., description="Rejected profiles")
    completion_rate: float = Field(..., description="Completion rate percentage")
    average_processing_days: float = Field(..., description="Average processing time in days")
    stage_metrics: Dict[str, StageMetric] = Field(..., description="Metrics by stage")
    daily_trends: List[DailyTrend] = Field(..., description="Daily trend data")


class AdminDistribution(BaseModel):
    """Admin workload distribution."""
    
    admin_name: str = Field(..., description="Admin name")
    pending_count: int = Field(..., description="Pending reviews assigned")
    completed_today: int = Field(..., description="Reviews completed today")


class AdminWorkloadResponse(BaseModel):
    """Admin workload analysis."""
    
    total_pending_reviews: int = Field(..., description="Total pending reviews")
    urgent_reviews: int = Field(..., description="Urgent reviews (>7 days)")
    admin_distribution: List[AdminDistribution] = Field(..., description="Workload by admin")
    workload_balance_score: float = Field(..., description="Workload balance score (0-1)")


class BottleneckInfo(BaseModel):
    """Process bottleneck information."""
    
    stage: str = Field(..., description="Bottleneck stage")
    severity: str = Field(..., description="Severity level")
    avg_delay_days: float = Field(..., description="Average delay in days")
    pending_count: int = Field(..., description="Items pending at this stage")
    recommendation: str = Field(..., description="Recommended action")


class AdminAnalyticsResponse(BaseModel):
    """Comprehensive admin analytics."""
    
    period_days: int = Field(..., description="Analysis period in days")
    verification_metrics: VerificationMetricsResponse = Field(..., description="Verification metrics")
    admin_workload: AdminWorkloadResponse = Field(..., description="Admin workload data")
    bottlenecks: Dict[str, Any] = Field(..., description="Bottleneck analysis")
    recommendations: List[str] = Field(..., description="Actionable recommendations")