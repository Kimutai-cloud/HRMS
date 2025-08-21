from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field

from app.core.entities.user_claims import UserClaims
from app.presentation.api.dependencies import require_admin_access
from app.application.services.report_generation_service import (
    ReportGenerationService,
    ReportType,
    ReportFormat,
    GeneratedReport,
    create_report_service
)
from app.presentation.api.dependencies import (
    get_employee_repository,
    get_document_repository,
    get_event_repository
)
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface
from app.infrastructure.database.repositories.document_repository import DocumentRepositoryInterface

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    """Request model for generating reports."""
    report_type: ReportType
    period_start: date
    period_end: Optional[date] = None
    format: ReportFormat = ReportFormat.JSON
    include_details: bool = True
    filters: Optional[Dict[str, Any]] = None


class ReportResponse(BaseModel):
    """Response model for report information."""
    id: str
    type: str
    title: str
    description: str
    generated_at: datetime
    generated_by: str
    period_start: date
    period_end: date
    file_path: Optional[str] = None
    download_url: Optional[str] = None
    status: str = "completed"


class ReportSummaryResponse(BaseModel):
    """Response model for report summary."""
    summary: Dict[str, Any]
    key_metrics: List[Dict[str, Any]]
    recommendations: List[str]
    insights: List[str]


def get_report_service(
    employee_repository: EmployeeRepositoryInterface = Depends(get_employee_repository),
    document_repository: DocumentRepositoryInterface = Depends(get_document_repository),
    event_repository: EventRepositoryInterface = Depends(get_event_repository)
) -> ReportGenerationService:
    """Get report generation service with dependencies."""
    return create_report_service(
        employee_repository=employee_repository,
        document_repository=document_repository,
        event_repository=event_repository
    )


@router.get("/dashboard-summary")
async def get_dashboard_summary(
    days: int = Query(7, ge=1, le=90, description="Number of days to include in summary"),
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get dashboard summary for admin overview."""
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days-1)
        
        # Generate quick summary report
        report = await report_service.generate_weekly_summary_report(
            week_start=start_date,
            generated_by=current_user.user_id
        )
        
        # Extract key metrics for dashboard
        dashboard_data = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days
            },
            "summary": report.summary,
            "key_metrics": [
                {
                    "name": metric.name,
                    "value": metric.value,
                    "trend": metric.trend,
                    "change_percentage": metric.change_percentage,
                    "context": metric.context
                }
                for section in report.sections[:2]  # First 2 sections only
                for metric in section.metrics[:3]  # Top 3 metrics per section
            ],
            "recommendations": report.recommendations[:5],  # Top 5 recommendations
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return dashboard_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard summary: {str(e)}")


@router.post("/generate")
async def generate_report(
    request: ReportRequest,
    background_tasks: BackgroundTasks,
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> ReportResponse:
    """Generate a new report."""
    
    try:
        # Set default end date if not provided
        if request.period_end is None:
            if request.report_type == ReportType.DAILY_OPERATIONS:
                request.period_end = request.period_start
            else:
                request.period_end = date.today()
        
        # Generate report based on type
        if request.report_type == ReportType.DAILY_OPERATIONS:
            report = await report_service.generate_daily_operations_report(
                target_date=request.period_start,
                generated_by=current_user.user_id
            )
        elif request.report_type == ReportType.WEEKLY_SUMMARY:
            report = await report_service.generate_weekly_summary_report(
                week_start=request.period_start,
                generated_by=current_user.user_id
            )
        elif request.report_type == ReportType.PROCESS_EFFICIENCY:
            report = await report_service.generate_process_efficiency_report(
                period_start=request.period_start,
                period_end=request.period_end,
                generated_by=current_user.user_id
            )
        elif request.report_type == ReportType.SLA_COMPLIANCE:
            report = await report_service.generate_sla_compliance_report(
                period_start=request.period_start,
                period_end=request.period_end,
                generated_by=current_user.user_id
            )
        else:
            raise HTTPException(status_code=400, detail=f"Report type {request.report_type.value} not supported")
        
        # Save report to file in background
        file_path = None
        if request.format in [ReportFormat.JSON, ReportFormat.HTML]:
            file_path = await report_service.save_report(report, request.format)
        
        return ReportResponse(
            id=str(report.id),
            type=report.type.value,
            title=report.title,
            description=report.description,
            generated_at=report.generated_at,
            generated_by=str(report.generated_by),
            period_start=report.period_start,
            period_end=report.period_end,
            file_path=file_path,
            download_url=f"/api/v1/reports/{report.id}/download" if file_path else None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/daily/{target_date}")
async def get_daily_operations_report(
    target_date: date,
    format: ReportFormat = Query(ReportFormat.JSON, description="Report format"),
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get daily operations report for specific date."""
    
    try:
        report = await report_service.generate_daily_operations_report(
            target_date=target_date,
            generated_by=current_user.user_id
        )
        
        if format == ReportFormat.HTML:
            html_content = await report_service.export_report_to_html(report)
            return {"content": html_content, "format": "html"}
        else:
            # Return JSON by default
            return {
                "report": {
                    "id": str(report.id),
                    "title": report.title,
                    "description": report.description,
                    "generated_at": report.generated_at.isoformat(),
                    "period_start": report.period_start.isoformat(),
                    "period_end": report.period_end.isoformat(),
                    "sections": [
                        {
                            "title": section.title,
                            "description": section.description,
                            "metrics": [
                                {
                                    "name": metric.name,
                                    "value": metric.value,
                                    "trend": metric.trend,
                                    "change_percentage": metric.change_percentage,
                                    "context": metric.context
                                }
                                for metric in section.metrics
                            ],
                            "charts": section.charts,
                            "tables": section.tables,
                            "insights": section.insights
                        }
                        for section in report.sections
                    ],
                    "summary": report.summary,
                    "recommendations": report.recommendations
                }
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get daily report: {str(e)}")


@router.get("/weekly/{week_start}")
async def get_weekly_summary_report(
    week_start: date,
    format: ReportFormat = Query(ReportFormat.JSON, description="Report format"),
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get weekly summary report."""
    
    try:
        report = await report_service.generate_weekly_summary_report(
            week_start=week_start,
            generated_by=current_user.user_id
        )
        
        return {
            "report": {
                "id": str(report.id),
                "title": report.title,
                "description": report.description,
                "generated_at": report.generated_at.isoformat(),
                "period_start": report.period_start.isoformat(),
                "period_end": report.period_end.isoformat(),
                "sections": [
                    {
                        "title": section.title,
                        "description": section.description,
                        "metrics": [
                            {
                                "name": metric.name,
                                "value": metric.value,
                                "trend": metric.trend,
                                "change_percentage": metric.change_percentage,
                                "context": metric.context
                            }
                            for metric in section.metrics
                        ],
                        "insights": section.insights
                    }
                    for section in report.sections
                ],
                "summary": report.summary,
                "recommendations": report.recommendations
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get weekly report: {str(e)}")


@router.get("/efficiency")
async def get_process_efficiency_report(
    period_start: date = Query(..., description="Start date for analysis period"),
    period_end: date = Query(None, description="End date for analysis period (defaults to today)"),
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get process efficiency analysis report."""
    
    try:
        if period_end is None:
            period_end = date.today()
        
        report = await report_service.generate_process_efficiency_report(
            period_start=period_start,
            period_end=period_end,
            generated_by=current_user.user_id
        )
        
        return {
            "report": {
                "id": str(report.id),
                "title": report.title,
                "description": report.description,
                "generated_at": report.generated_at.isoformat(),
                "analysis_period": {
                    "start": report.period_start.isoformat(),
                    "end": report.period_end.isoformat(),
                    "duration_days": (report.period_end - report.period_start).days + 1
                },
                "sections": [
                    {
                        "title": section.title,
                        "description": section.description,
                        "metrics": [
                            {
                                "name": metric.name,
                                "value": metric.value,
                                "trend": metric.trend,
                                "change_percentage": metric.change_percentage,
                                "context": metric.context
                            }
                            for metric in section.metrics
                        ],
                        "charts": section.charts,
                        "tables": section.tables,
                        "insights": section.insights
                    }
                    for section in report.sections
                ],
                "summary": report.summary,
                "recommendations": report.recommendations
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get efficiency report: {str(e)}")


@router.get("/sla-compliance")
async def get_sla_compliance_report(
    period_start: date = Query(..., description="Start date for SLA analysis"),
    period_end: date = Query(None, description="End date for SLA analysis (defaults to today)"),
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get SLA compliance report."""
    
    try:
        if period_end is None:
            period_end = date.today()
        
        report = await report_service.generate_sla_compliance_report(
            period_start=period_start,
            period_end=period_end,
            generated_by=current_user.user_id
        )
        
        return {
            "report": {
                "id": str(report.id),
                "title": report.title,
                "description": report.description,
                "generated_at": report.generated_at.isoformat(),
                "compliance_period": {
                    "start": report.period_start.isoformat(),
                    "end": report.period_end.isoformat()
                },
                "sections": [
                    {
                        "title": section.title,
                        "description": section.description,
                        "metrics": [
                            {
                                "name": metric.name,
                                "value": metric.value,
                                "trend": metric.trend,
                                "context": metric.context
                            }
                            for metric in section.metrics
                        ],
                        "insights": section.insights
                    }
                    for section in report.sections
                ],
                "summary": report.summary,
                "recommendations": report.recommendations
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get SLA compliance report: {str(e)}")


@router.get("/available-types")
async def get_available_report_types(
    current_user: UserClaims = Depends(require_admin_access)
) -> Dict[str, List[Dict[str, str]]]:
    """Get list of available report types."""
    
    report_types = [
        {
            "type": ReportType.DAILY_OPERATIONS.value,
            "name": "Daily Operations Report",
            "description": "Comprehensive daily operational overview with key metrics and performance indicators"
        },
        {
            "type": ReportType.WEEKLY_SUMMARY.value,
            "name": "Weekly Summary Report", 
            "description": "Weekly operational summary with goal achievement and team performance analysis"
        },
        {
            "type": ReportType.PROCESS_EFFICIENCY.value,
            "name": "Process Efficiency Report",
            "description": "Detailed analysis of verification process efficiency and bottleneck identification"
        },
        {
            "type": ReportType.SLA_COMPLIANCE.value,
            "name": "SLA Compliance Report",
            "description": "Service level agreement compliance analysis with breach tracking and recovery metrics"
        },
        {
            "type": ReportType.VERIFICATION_PIPELINE.value,
            "name": "Verification Pipeline Report",
            "description": "Analysis of verification pipeline flow and stage-by-stage performance"
        },
        {
            "type": ReportType.ADMIN_PERFORMANCE.value,
            "name": "Admin Performance Report", 
            "description": "Individual admin reviewer performance metrics and quality analysis"
        }
    ]
    
    formats = [
        {
            "format": ReportFormat.JSON.value,
            "name": "JSON",
            "description": "Machine-readable JSON format for API consumption"
        },
        {
            "format": ReportFormat.HTML.value,
            "name": "HTML",
            "description": "Web-friendly HTML format with styling and charts"
        },
        {
            "format": ReportFormat.CSV.value,
            "name": "CSV",
            "description": "Comma-separated values for data analysis tools"
        },
        {
            "format": ReportFormat.PDF.value,
            "name": "PDF",
            "description": "Portable document format for printing and sharing"
        }
    ]
    
    return {
        "report_types": report_types,
        "formats": formats
    }


@router.get("/metrics/real-time")
async def get_real_time_metrics(
    current_user: UserClaims = Depends(require_admin_access),
    report_service: ReportGenerationService = Depends(get_report_service)
) -> Dict[str, Any]:
    """Get real-time operational metrics for dashboard."""
    
    try:
        today = date.today()
        
        # Generate today's report for real-time metrics
        report = await report_service.generate_daily_operations_report(
            target_date=today,
            generated_by=current_user.user_id
        )
        
        # Extract key real-time metrics
        real_time_metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "date": today.isoformat(),
            "metrics": {}
        }
        
        # Aggregate metrics from all sections
        for section in report.sections:
            section_metrics = {}
            for metric in section.metrics:
                section_metrics[metric.name.lower().replace(" ", "_")] = {
                    "value": metric.value,
                    "trend": metric.trend,
                    "change_percentage": metric.change_percentage,
                    "context": metric.context
                }
            real_time_metrics["metrics"][section.title.lower().replace(" ", "_").replace("&", "and")] = section_metrics
        
        # Add summary information
        real_time_metrics["summary"] = report.summary
        real_time_metrics["urgent_items"] = [
            rec for rec in report.recommendations 
            if any(word in rec.lower() for word in ["urgent", "critical", "immediate"])
        ]
        
        return real_time_metrics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get real-time metrics: {str(e)}")


@router.get("/export/{report_id}")
async def export_report(
    report_id: UUID,
    format: ReportFormat = Query(ReportFormat.JSON, description="Export format"),
    current_user: UserClaims = Depends(require_admin_access)
) -> Dict[str, Any]:
    """Export existing report in specified format."""
    
    # This would typically retrieve a stored report from database
    # For now, return a placeholder response
    
    return {
        "report_id": str(report_id),
        "format": format.value,
        "status": "export_initiated",
        "message": "Report export functionality would be implemented here",
        "download_url": f"/api/v1/reports/{report_id}/download?format={format.value}"
    }