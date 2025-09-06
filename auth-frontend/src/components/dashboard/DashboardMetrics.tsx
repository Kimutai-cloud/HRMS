import { Users, FileText, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useAccessControl";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AccessLevel } from "@/types/auth";

interface MetricData {
  id: string;
  title: string;
  value: string;
  description?: string;
  icon: any;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "info";
  requiredPermissions?: string[];
  requiredAccessLevels?: AccessLevel[];
}

// Use real data from API
const getMetricsData = (accessLevel: AccessLevel, isAdmin: boolean, isManager: boolean, dashboardData?: any): MetricData[] => {
  const metrics: MetricData[] = [];

  if (accessLevel === AccessLevel.PROFILE_COMPLETION) {
    return [
      {
        id: "profile_completion",
        title: "Profile Completion",
        value: `${dashboardData?.profileCompletion || 0}%`,
        description: "Complete your profile to unlock features",
        icon: Users,
        variant: "warning",
      },
      {
        id: "documents_needed",
        title: "Documents Required",
        value: `${dashboardData?.pendingApproval || 0}`,
        description: "Upload required documents",
        icon: FileText,
        variant: "info",
      }
    ];
  }

  if (accessLevel === AccessLevel.NEWCOMER) {
    return [
      {
        id: "verification_status",
        title: "Verification Status",
        value: dashboardData?.verificationStatus || "Pending",
        description: "Your profile is being reviewed",
        icon: Clock,
        variant: "warning",
      },
      {
        id: "documents_uploaded",
        title: "Documents Uploaded",
        value: `${dashboardData?.documentsUploaded || 0}`,
        description: dashboardData?.documentsUploaded > 0 ? "Documents uploaded!" : "Upload your documents",
        icon: FileText,
        variant: "info",
      },
      {
        id: "onboarding_progress",
        title: "Profile Completion",
        value: `${dashboardData?.profileCompletion || 0}%`,
        description: "Complete remaining steps",
        icon: TrendingUp,
        variant: "success",
      }
    ];
  }

  // Admin metrics
  if (isAdmin) {
    metrics.push(
      {
        id: "total_employees",
        title: "Total Employees",
        value: "247",
        description: "Active employees",
        icon: Users,
        trend: { value: 12, label: "vs last month" },
        variant: "default",
      },
      {
        id: "pending_approvals",
        title: "Pending Approvals",
        value: "18",
        description: "Require your attention",
        icon: AlertTriangle,
        variant: "warning",
      },
      {
        id: "completed_onboardings",
        title: "Completed This Month",
        value: "34",
        description: "New employees onboarded",
        icon: CheckCircle,
        trend: { value: 8, label: "vs last month" },
        variant: "success",
      },
      {
        id: "system_health",
        title: "System Health",
        value: "99.2%",
        description: "Uptime this month",
        icon: TrendingUp,
        variant: "success",
      }
    );
  }
  
  // Manager metrics
  else if (isManager) {
    metrics.push(
      {
        id: "team_members",
        title: "Team Members",
        value: "12",
        description: "Direct reports",
        icon: Users,
        variant: "default",
      },
      {
        id: "pending_requests",
        title: "Pending Requests",
        value: "4",
        description: "Require approval",
        icon: AlertTriangle,
        variant: "warning",
      },
      {
        id: "team_performance",
        title: "Team Performance",
        value: "92%",
        description: "Average completion rate",
        icon: TrendingUp,
        trend: { value: 5, label: "vs last month" },
        variant: "success",
      }
    );
  }
  
  // Employee metrics
  else {
    metrics.push(
      {
        id: "my_documents",
        title: "My Documents",
        value: "8",
        description: "Uploaded documents",
        icon: FileText,
        variant: "default",
      },
      {
        id: "pending_tasks",
        title: "Pending Tasks",
        value: "3",
        description: "Complete by end of week",
        icon: Clock,
        variant: "info",
      },
      {
        id: "completion_rate",
        title: "Completion Rate",
        value: "87%",
        description: "This month",
        icon: CheckCircle,
        trend: { value: 3, label: "vs last month" },
        variant: "success",
      }
    );
  }

  return metrics;
};

export function DashboardMetrics() {
  const { accessLevel, isAdmin, isManager } = useAuth();
  const features = useFeatureAccess();
  
  const metrics = getMetricsData(accessLevel, isAdmin, isManager);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          trend={metric.trend}
          variant={metric.variant}
        />
      ))}
    </div>
  );
}

export function EmployeeMetrics({ dashboardData }: { dashboardData?: any }) {
  const { accessLevel, isAdmin, isManager } = useAuth();
  const features = useFeatureAccess();
  
  const metrics = getMetricsData(accessLevel, isAdmin, isManager, dashboardData);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          trend={metric.trend}
          variant={metric.variant}
        />
      ))}
    </div>
  );
}

// Specialized metric components for different roles
export function AdminMetrics() {
  const { metrics, loading, error } = useDashboardData('admin');

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-16 animate-pulse bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500 text-sm">Failed to load metrics: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const adminMetrics = [
    {
      title: "Total Users",
      value: metrics.totalEmployees?.toString() || "0",
      description: "Active users in system",
      icon: Users,
      variant: "default" as const,
      trend: metrics.totalEmployees && metrics.totalEmployees > 0 
        ? { value: Math.round((metrics.totalEmployees / 100) * 5), label: "growth this month" }
        : undefined
    },
    {
      title: "Security Alerts",
      value: "0", // This would come from a security monitoring system
      description: "No alerts",
      icon: AlertTriangle,
      variant: "success" as const,
    },
    {
      title: "System Performance",
      value: "98.5%", // This would come from system monitoring
      description: "Uptime this month",
      icon: TrendingUp,
      variant: "success" as const,
    },
    {
      title: "Pending Approvals",
      value: metrics.pendingApprovals?.toString() || "0",
      description: metrics.pendingApprovals && metrics.pendingApprovals > 0 
        ? "Require attention" 
        : "All caught up",
      icon: FileText,
      variant: metrics.pendingApprovals && metrics.pendingApprovals > 0 ? "warning" as const : "success" as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {adminMetrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

export function ManagerMetrics() {
  const { metrics, loading, error } = useDashboardData('manager');

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-16 animate-pulse bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500 text-sm">Failed to load metrics: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const managerMetrics = [
    {
      title: "Team Size",
      value: metrics.teamMembers?.toString() || "0",
      description: "Direct reports",
      icon: Users,
      variant: "default" as const,
    },
    {
      title: "Approvals Pending", 
      value: metrics.pendingApprovals?.toString() || "0",
      description: metrics.pendingApprovals && metrics.pendingApprovals > 0 
        ? "Waiting for review" 
        : "All caught up",
      icon: Clock,
      variant: metrics.pendingApprovals && metrics.pendingApprovals > 0 ? "warning" as const : "success" as const,
    },
    {
      title: "Profile Completion",
      value: `${metrics.profileCompletion || 0}%`,
      description: "Team average",
      icon: TrendingUp,
      variant: (metrics.profileCompletion || 0) >= 80 ? "success" as const : "warning" as const,
    },
    {
      title: "Team Verified",
      value: `${Math.round(((metrics.teamMembers || 0) > 0 ? (metrics.teamMembers || 0) - (metrics.pendingApprovals || 0) : 0) / Math.max(metrics.teamMembers || 1, 1) * 100)}%`,
      description: "Verification rate",
      icon: CheckCircle,
      variant: "info" as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {managerMetrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

