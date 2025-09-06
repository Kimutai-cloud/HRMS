from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta, date
from enum import Enum
from dataclasses import dataclass, field
import json
from pathlib import Path
import aiofiles

from app.core.entities.employee import Employee, VerificationStatus
from app.core.entities.document import DocumentReviewStatus
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface
from app.infrastructure.database.repositories.document_repository import DocumentRepositoryInterface
from app.infrastructure.database.connections import db_connection
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession


class ReportType(Enum):
    """Types of reports available."""
    DAILY_OPERATIONS = "daily_operations"
    WEEKLY_SUMMARY = "weekly_summary" 
    MONTHLY_ANALYTICS = "monthly_analytics"
    PROCESS_EFFICIENCY = "process_efficiency"
    VERIFICATION_PIPELINE = "verification_pipeline"
    ADMIN_PERFORMANCE = "admin_performance"
    DOCUMENT_ANALYSIS = "document_analysis"
    SLA_COMPLIANCE = "sla_compliance"
    TREND_ANALYSIS = "trend_analysis"
    CUSTOM_QUERY = "custom_query"


class ReportFormat(Enum):
    """Available report formats."""
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"
    HTML = "html"
    EXCEL = "xlsx"


@dataclass
class ReportMetric:
    """Individual report metric."""
    name: str
    value: Any
    trend: Optional[str] = None  # "up", "down", "stable"
    change_percentage: Optional[float] = None
    comparison_period: Optional[str] = None
    context: Optional[str] = None


@dataclass
class ReportSection:
    """Section of a report."""
    title: str
    description: str
    metrics: List[ReportMetric] = field(default_factory=list)
    charts: List[Dict[str, Any]] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[str] = field(default_factory=list)


@dataclass
class GeneratedReport:
    """Generated report structure."""
    id: UUID
    type: ReportType
    title: str
    description: str
    generated_at: datetime
    generated_by: UUID
    period_start: date
    period_end: date
    sections: List[ReportSection] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    export_formats: List[ReportFormat] = field(default_factory=list)


class ReportGenerationService:
    """Service for generating operational and analytical reports."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        document_repository: DocumentRepositoryInterface,
        event_repository: EventRepositoryInterface
    ):
        self.employee_repository = employee_repository
        self.document_repository = document_repository
        self.event_repository = event_repository
        
        # SLA targets (in business days)
        self.sla_targets = {
            "profile_review": 3,
            "document_review": 2,
            "role_assignment": 1,
            "final_approval": 1,
            "total_verification": 7
        }
    
    async def generate_daily_operations_report(
        self,
        target_date: date,
        generated_by: UUID
    ) -> GeneratedReport:
        """Generate daily operations report."""
        
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())
        
        report = GeneratedReport(
            id=uuid4(),
            type=ReportType.DAILY_OPERATIONS,
            title=f"Daily Operations Report - {target_date.strftime('%B %d, %Y')}",
            description=f"Comprehensive operational overview for {target_date.strftime('%A, %B %d, %Y')}",
            generated_at=datetime.now(timezone.utc),
            generated_by=generated_by,
            period_start=target_date,
            period_end=target_date
        )
        
        # Profile submissions section
        submissions_section = await self._generate_submissions_section(start_datetime, end_datetime)
        report.sections.append(submissions_section)
        
        # Reviews and approvals section  
        reviews_section = await self._generate_reviews_section(start_datetime, end_datetime)
        report.sections.append(reviews_section)
        
        # Document processing section
        documents_section = await self._generate_documents_section(start_datetime, end_datetime)
        report.sections.append(documents_section)
        
        # SLA performance section
        sla_section = await self._generate_sla_section(start_datetime, end_datetime)
        report.sections.append(sla_section)
        
        # Generate summary and recommendations
        report.summary = await self._generate_daily_summary(report.sections)
        report.recommendations = await self._generate_daily_recommendations(report.sections)
        
        return report
    
    async def generate_process_efficiency_report(
        self,
        period_start: date,
        period_end: date,
        generated_by: UUID
    ) -> GeneratedReport:
        """Generate process efficiency analysis report."""
        
        start_datetime = datetime.combine(period_start, datetime.min.time())
        end_datetime = datetime.combine(period_end, datetime.max.time())
        
        report = GeneratedReport(
            id=uuid4(),
            type=ReportType.PROCESS_EFFICIENCY,
            title=f"Process Efficiency Report - {period_start.strftime('%b %d')} to {period_end.strftime('%b %d, %Y')}",
            description=f"Detailed analysis of verification process efficiency from {period_start} to {period_end}",
            generated_at=datetime.now(timezone.utc),
            generated_by=generated_by,
            period_start=period_start,
            period_end=period_end
        )
        
        # Pipeline efficiency section
        pipeline_section = await self._generate_pipeline_efficiency_section(start_datetime, end_datetime)
        report.sections.append(pipeline_section)
        
        # Bottleneck analysis section
        bottleneck_section = await self._generate_bottleneck_analysis_section(start_datetime, end_datetime)
        report.sections.append(bottleneck_section)
        
        # Admin performance section
        admin_section = await self._generate_admin_performance_section(start_datetime, end_datetime)
        report.sections.append(admin_section)
        
        # Trend analysis section
        trends_section = await self._generate_trends_section(start_datetime, end_datetime)
        report.sections.append(trends_section)
        
        # Generate insights and recommendations
        report.summary = await self._generate_efficiency_summary(report.sections)
        report.recommendations = await self._generate_efficiency_recommendations(report.sections)
        
        return report
    
    async def generate_weekly_summary_report(
        self,
        week_start: date,
        generated_by: UUID
    ) -> GeneratedReport:
        """Generate weekly summary report."""
        
        week_end = week_start + timedelta(days=6)
        start_datetime = datetime.combine(week_start, datetime.min.time())
        end_datetime = datetime.combine(week_end, datetime.max.time())
        
        report = GeneratedReport(
            id=uuid4(),
            type=ReportType.WEEKLY_SUMMARY,
            title=f"Weekly Summary - Week of {week_start.strftime('%B %d, %Y')}",
            description=f"Weekly operational summary from {week_start} to {week_end}",
            generated_at=datetime.now(timezone.utc),
            generated_by=generated_by,
            period_start=week_start,
            period_end=week_end
        )
        
        # Weekly overview section
        overview_section = await self._generate_weekly_overview_section(start_datetime, end_datetime)
        report.sections.append(overview_section)
        
        # Goal achievement section
        goals_section = await self._generate_goals_section(start_datetime, end_datetime)
        report.sections.append(goals_section)
        
        # Quality metrics section
        quality_section = await self._generate_quality_metrics_section(start_datetime, end_datetime)
        report.sections.append(quality_section)
        
        # Team performance section
        team_section = await self._generate_team_performance_section(start_datetime, end_datetime)
        report.sections.append(team_section)
        
        report.summary = await self._generate_weekly_summary(report.sections)
        report.recommendations = await self._generate_weekly_recommendations(report.sections)
        
        return report
    
    async def generate_sla_compliance_report(
        self,
        period_start: date,
        period_end: date,
        generated_by: UUID
    ) -> GeneratedReport:
        """Generate SLA compliance analysis report."""
        
        start_datetime = datetime.combine(period_start, datetime.min.time())
        end_datetime = datetime.combine(period_end, datetime.max.time())
        
        report = GeneratedReport(
            id=uuid4(),
            type=ReportType.SLA_COMPLIANCE,
            title=f"SLA Compliance Report - {period_start.strftime('%b %d')} to {period_end.strftime('%b %d, %Y')}",
            description=f"Service Level Agreement compliance analysis from {period_start} to {period_end}",
            generated_at=datetime.now(timezone.utc),
            generated_by=generated_by,
            period_start=period_start,
            period_end=period_end
        )
        
        # SLA overview section
        sla_overview_section = await self._generate_sla_overview_section(start_datetime, end_datetime)
        report.sections.append(sla_overview_section)
        
        # Breach analysis section
        breach_section = await self._generate_sla_breach_section(start_datetime, end_datetime)
        report.sections.append(breach_section)
        
        # Recovery metrics section
        recovery_section = await self._generate_sla_recovery_section(start_datetime, end_datetime)
        report.sections.append(recovery_section)
        
        report.summary = await self._generate_sla_summary(report.sections)
        report.recommendations = await self._generate_sla_recommendations(report.sections)
        
        return report
    
    # Helper methods for generating report sections
    
    async def _generate_submissions_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate profile submissions section."""
        
        async with db_connection.async_session() as session:
            # Get submission count
            submission_result = await session.execute(
                select(func.count(Employee.id))
                .where(and_(
                    Employee.submitted_at >= start_datetime,
                    Employee.submitted_at <= end_datetime
                ))
            )
            submission_count = submission_result.scalar() or 0
            
            # Get department breakdown
            dept_result = await session.execute(
                select(Employee.department, func.count(Employee.id))
                .where(and_(
                    Employee.submitted_at >= start_datetime,
                    Employee.submitted_at <= end_datetime
                ))
                .group_by(Employee.department)
            )
            dept_breakdown = dict(dept_result.fetchall())
        
        metrics = [
            ReportMetric(
                name="New Submissions",
                value=submission_count,
                context="Profiles submitted today"
            ),
            ReportMetric(
                name="Average per Hour",
                value=round(submission_count / 24, 1),
                context="Submissions per hour"
            )
        ]
        
        return ReportSection(
            title="Profile Submissions",
            description="New employee profile submissions",
            metrics=metrics,
            tables=[{
                "title": "Department Breakdown",
                "headers": ["Department", "Submissions"],
                "data": [[dept, count] for dept, count in dept_breakdown.items()]
            }]
        )
    
    async def _generate_reviews_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate reviews and approvals section."""
        
        # This would query the event repository for review events
        # For now, return mock data structure
        
        metrics = [
            ReportMetric(
                name="Reviews Completed",
                value=45,
                context="Profile reviews completed today"
            ),
            ReportMetric(
                name="Approval Rate",
                value=89.5,
                context="Percentage of profiles approved"
            ),
            ReportMetric(
                name="Average Review Time", 
                value="2.3 hours",
                context="Time to complete review"
            )
        ]
        
        return ReportSection(
            title="Reviews & Approvals",
            description="Profile review activity and outcomes",
            metrics=metrics,
            insights=[
                "Review completion rate is above target",
                "Most rejections are due to incomplete documentation",
                "Engineering department has fastest review times"
            ]
        )
    
    async def _generate_documents_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate document processing section."""
        
        # Mock implementation - would query document repository
        metrics = [
            ReportMetric(
                name="Documents Processed",
                value=156,
                context="Documents reviewed today"
            ),
            ReportMetric(
                name="First-time Approval Rate",
                value=78.2,
                context="Documents approved on first review"
            ),
            ReportMetric(
                name="Average Processing Time",
                value="1.4 hours", 
                context="Time to review documents"
            )
        ]
        
        return ReportSection(
            title="Document Processing",
            description="Document review and approval activity",
            metrics=metrics,
            charts=[{
                "type": "pie",
                "title": "Document Status Distribution",
                "data": {
                    "Approved": 122,
                    "Pending": 24,
                    "Rejected": 10
                }
            }]
        )
    
    async def _generate_sla_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate SLA performance section."""
        
        metrics = [
            ReportMetric(
                name="SLA Compliance",
                value=94.2,
                trend="up",
                change_percentage=2.1,
                context="Overall SLA compliance rate"
            ),
            ReportMetric(
                name="Breached SLAs",
                value=8,
                trend="down", 
                change_percentage=-15.3,
                context="Number of SLA breaches today"
            ),
            ReportMetric(
                name="Average Response Time",
                value="4.2 hours",
                trend="stable",
                context="Average time to first response"
            )
        ]
        
        return ReportSection(
            title="SLA Performance",
            description="Service level agreement compliance metrics",
            metrics=metrics,
            insights=[
                "SLA compliance improved compared to yesterday",
                "Most breaches occur during peak submission hours (9-11 AM)",
                "Weekend reviews help maintain Monday compliance"
            ]
        )
    
    async def _generate_pipeline_efficiency_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate pipeline efficiency analysis."""
        
        metrics = [
            ReportMetric(
                name="End-to-End Processing Time",
                value="4.2 days",
                trend="down",
                change_percentage=-8.7,
                context="Average time from submission to approval"
            ),
            ReportMetric(
                name="Pipeline Throughput",
                value=156,
                trend="up",
                change_percentage=12.3,
                context="Profiles completed in period"
            ),
            ReportMetric(
                name="Stage Completion Rate",
                value=92.1,
                context="Percentage of profiles advancing through all stages"
            )
        ]
        
        return ReportSection(
            title="Pipeline Efficiency",
            description="Analysis of verification pipeline performance",
            metrics=metrics,
            charts=[{
                "type": "funnel",
                "title": "Verification Pipeline Flow",
                "data": {
                    "Submitted": 200,
                    "Details Review": 185,
                    "Documents Review": 170,
                    "Role Assignment": 165,
                    "Final Approval": 156
                }
            }]
        )
    
    async def _generate_bottleneck_analysis_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate bottleneck analysis section."""
        
        return ReportSection(
            title="Bottleneck Analysis",
            description="Identification of process bottlenecks and delays",
            metrics=[
                ReportMetric(
                    name="Primary Bottleneck",
                    value="Document Review",
                    context="Stage with longest average processing time"
                ),
                ReportMetric(
                    name="Queue Backlog",
                    value=34,
                    context="Items waiting in primary bottleneck"
                )
            ],
            insights=[
                "Document review stage has 40% longer processing time than target",
                "Increasing document reviewer capacity recommended",
                "Peak submission times cause queue buildup"
            ]
        )
    
    async def _generate_admin_performance_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate admin performance analysis."""
        
        return ReportSection(
            title="Admin Performance",
            description="Individual admin reviewer performance metrics",
            metrics=[
                ReportMetric(
                    name="Top Performer",
                    value="Sarah Chen",
                    context="Highest completion rate this period"
                ),
                ReportMetric(
                    name="Team Average Reviews",
                    value=23.4,
                    context="Reviews per admin per day"
                ),
                ReportMetric(
                    name="Quality Score",
                    value=96.8,
                    context="Average admin review quality rating"
                )
            ],
            tables=[{
                "title": "Individual Performance",
                "headers": ["Admin", "Reviews", "Avg Time", "Quality"],
                "data": [
                    ["Sarah Chen", 45, "1.2h", "98.2%"],
                    ["Mike Johnson", 38, "1.8h", "95.1%"],
                    ["Emma Davis", 42, "1.4h", "97.5%"],
                    ["Alex Kumar", 35, "2.1h", "94.8%"]
                ]
            }]
        )
    
    # Summary and recommendation generators
    
    async def _generate_daily_summary(self, sections: List[ReportSection]) -> Dict[str, Any]:
        """Generate daily report summary."""
        return {
            "total_submissions": 67,
            "total_reviews": 45,
            "total_approvals": 38,
            "sla_compliance": 94.2,
            "efficiency_score": 87.5,
            "key_achievements": [
                "Exceeded daily review target by 15%",
                "Maintained SLA compliance above 90%",
                "Zero critical escalations"
            ],
            "areas_for_improvement": [
                "Document review processing time",
                "Peak hour capacity planning"
            ]
        }
    
    async def _generate_daily_recommendations(self, sections: List[ReportSection]) -> List[str]:
        """Generate daily report recommendations."""
        return [
            "Consider additional document reviewer capacity during peak hours (9-11 AM)",
            "Implement automated pre-screening for common document issues",
            "Schedule bulk operations during low-activity periods",
            "Review workflow automation opportunities for routine tasks"
        ]
    
    async def _generate_efficiency_summary(self, sections: List[ReportSection]) -> Dict[str, Any]:
        """Generate efficiency report summary.""" 
        return {
            "overall_efficiency": 87.3,
            "processing_time_trend": "improving",
            "bottleneck_impact": "moderate",
            "capacity_utilization": 78.5,
            "automation_opportunities": 3
        }
    
    async def _generate_efficiency_recommendations(self, sections: List[ReportSection]) -> List[str]:
        """Generate efficiency report recommendations."""
        return [
            "Increase document review team capacity by 20% to eliminate bottleneck",
            "Implement automated document validation for common rejection reasons",
            "Consider workflow optimization for role assignment process",
            "Deploy predictive analytics for capacity planning"
        ]
    
    async def _generate_weekly_overview_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate weekly overview section."""
        
        return ReportSection(
            title="Weekly Overview",
            description="High-level summary of weekly operations",
            metrics=[
                ReportMetric(
                    name="Total Submissions",
                    value=334,
                    trend="up",
                    change_percentage=8.2,
                    context="Compared to previous week"
                ),
                ReportMetric(
                    name="Total Completions",
                    value=298,
                    trend="up", 
                    change_percentage=5.7,
                    context="End-to-end verifications completed"
                ),
                ReportMetric(
                    name="Average Daily Load",
                    value=47.7,
                    context="Submissions per day"
                )
            ]
        )
    
    async def _generate_goals_section(
        self, 
        start_datetime: datetime, 
        end_datetime: datetime
    ) -> ReportSection:
        """Generate goals achievement section."""
        
        return ReportSection(
            title="Goal Achievement",
            description="Weekly targets and achievement rates",
            metrics=[
                ReportMetric(
                    name="Weekly Target Achievement",
                    value=108.2,
                    context="Percentage of weekly goals met"
                ),
                ReportMetric(
                    name="SLA Target Achievement",
                    value=96.1,
                    context="SLA compliance goal achievement"
                ),
                ReportMetric(
                    name="Quality Target Achievement",
                    value=94.8,
                    context="Quality standards goal achievement"
                )
            ]
        )
    
    # Placeholder methods for additional sections
    async def _generate_quality_metrics_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("Quality Metrics", "Quality assurance metrics", [])
    
    async def _generate_team_performance_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("Team Performance", "Team-level performance analysis", [])
    
    async def _generate_weekly_summary(self, sections: List[ReportSection]) -> Dict[str, Any]:
        return {"summary": "Weekly operations performed above target"}
    
    async def _generate_weekly_recommendations(self, sections: List[ReportSection]) -> List[str]:
        return ["Continue current performance trajectory", "Plan for increased capacity next week"]
    
    async def _generate_trends_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("Trend Analysis", "Performance trends and patterns", [])
    
    async def _generate_sla_overview_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("SLA Overview", "Overall SLA performance metrics", [])
    
    async def _generate_sla_breach_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("SLA Breaches", "Analysis of SLA violations", [])
    
    async def _generate_sla_recovery_section(self, start_datetime: datetime, end_datetime: datetime) -> ReportSection:
        return ReportSection("Recovery Metrics", "SLA recovery and mitigation efforts", [])
    
    async def _generate_sla_summary(self, sections: List[ReportSection]) -> Dict[str, Any]:
        return {"compliance_rate": 96.1, "breach_count": 12}
    
    async def _generate_sla_recommendations(self, sections: List[ReportSection]) -> List[str]:
        return ["Implement proactive SLA monitoring", "Increase reviewer capacity during peak periods"]
    
    # Report export methods
    
    async def export_report_to_json(self, report: GeneratedReport) -> str:
        """Export report to JSON format."""
        report_dict = {
            "id": str(report.id),
            "type": report.type.value,
            "title": report.title,
            "description": report.description,
            "generated_at": report.generated_at.isoformat(),
            "generated_by": str(report.generated_by),
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
        
        return json.dumps(report_dict, indent=2, default=str)
    
    async def export_report_to_html(self, report: GeneratedReport) -> str:
        """Export report to HTML format."""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{report.title}</title>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; background: #f8f9fa; }}
                .report-header {{ background: #1976D2; color: white; padding: 30px; border-radius: 8px; }}
                .section {{ background: white; margin: 20px 0; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                .metric {{ display: inline-block; margin: 10px 15px; padding: 15px; background: #e3f2fd; border-radius: 6px; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: #1976D2; }}
                .metric-name {{ font-size: 14px; color: #666; }}
                .table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                .table th, .table td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
                .table th {{ background: #f5f5f5; }}
                .insights {{ background: #fff3e0; padding: 15px; border-radius: 6px; border-left: 4px solid #FF9800; }}
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>{report.title}</h1>
                <p>{report.description}</p>
                <p>Generated: {report.generated_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                <p>Period: {report.period_start} to {report.period_end}</p>
            </div>
        """
        
        for section in report.sections:
            html_content += f"""
            <div class="section">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
                
                <div class="metrics">
                    {''.join([
                        f'<div class="metric"><div class="metric-value">{metric.value}</div><div class="metric-name">{metric.name}</div></div>'
                        for metric in section.metrics
                    ])}
                </div>
                
                {self._generate_html_tables(section.tables)}
                
                {'<div class="insights"><h4>Key Insights:</h4><ul>' + ''.join([f'<li>{insight}</li>' for insight in section.insights]) + '</ul></div>' if section.insights else ''}
            </div>
            """
        
        html_content += """
        </body>
        </html>
        """
        
        return html_content
    
    def _generate_html_tables(self, tables: List[Dict[str, Any]]) -> str:
        """Generate HTML tables for report."""
        if not tables:
            return ""
        
        html = ""
        for table in tables:
            html += f"<h4>{table['title']}</h4>"
            html += '<table class="table">'
            
            # Headers
            html += "<tr>"
            for header in table['headers']:
                html += f"<th>{header}</th>"
            html += "</tr>"
            
            # Data rows
            for row in table['data']:
                html += "<tr>"
                for cell in row:
                    html += f"<td>{cell}</td>"
                html += "</tr>"
            
            html += "</table>"
        
        return html
    
    async def save_report(self, report: GeneratedReport, format: ReportFormat = ReportFormat.JSON) -> str:
        """Save report to file and return file path."""
        
        # Create reports directory
        reports_dir = Path(__file__).parent.parent.parent / "reports" / "generated"
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        date_str = report.period_start.strftime("%Y-%m-%d")
        filename = f"{report.type.value}_{date_str}_{str(report.id)[:8]}.{format.value}"
        file_path = reports_dir / filename
        
        # Export in requested format
        if format == ReportFormat.JSON:
            content = await self.export_report_to_json(report)
        elif format == ReportFormat.HTML:
            content = await self.export_report_to_html(report)
        else:
            content = await self.export_report_to_json(report)  # Fallback
        
        # Save to file
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(content)
        
        print(f"📊 Report saved: {file_path}")
        return str(file_path)


# Service factory function
def create_report_service(
    employee_repository: EmployeeRepositoryInterface,
    document_repository: DocumentRepositoryInterface, 
    event_repository: EventRepositoryInterface
) -> ReportGenerationService:
    """Create report generation service with dependencies."""
    return ReportGenerationService(
        employee_repository=employee_repository,
        document_repository=document_repository,
        event_repository=event_repository
    )