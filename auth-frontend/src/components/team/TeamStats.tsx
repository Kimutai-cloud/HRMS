import React from 'react';
import { Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTeamData, useDashboardData } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';

interface TeamStatsProps {
  managerId?: string;
}

const TeamStats: React.FC<TeamStatsProps> = ({ managerId }) => {
  const { user } = useAuth();
  
  const { members: teamMembers = [], loading: membersLoading, error: membersError, refresh: refetchMembers } = useTeamData();
  const { metrics, loading: metricsLoading, error: metricsError, refresh: refetchMetrics } = useDashboardData('manager');

  if (membersLoading || metricsLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (membersError || metricsError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Failed to load team statistics. {membersError || metricsError}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              refetchMembers();
              refetchMetrics();
            }}
            className="ml-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const totalMembers = teamMembers.length;
  const verifiedMembers = teamMembers.filter((member: { verification_status: string; }) => member.verification_status === 'VERIFIED').length;
  const pendingMembers = teamMembers.filter(member => 
    member.verification_status === 'PENDING_DETAILS_REVIEW' || 
    member.verification_status === 'PENDING_DOCUMENTS_REVIEW' || 
    member.verification_status === 'PENDING_ROLE_ASSIGNMENT' || 
    member.verification_status === 'PENDING_FINAL_APPROVAL'
  ).length;
  const rejectedMembers = teamMembers.filter(member => member.verification_status === 'REJECTED').length;
  
  const averageCompletion = totalMembers > 0 
    ? teamMembers.reduce((sum, member) => sum + (member.profile_completion_percentage || 0), 0) / totalMembers
    : 0;

  const fullTimeMembers = teamMembers.filter(member => member.employment_type === 'full_time').length;
  const contractMembers = teamMembers.filter(member => member.employment_type === 'contract').length;
  const remoteMembers = teamMembers.filter(member => member.work_location === 'remote').length;

  const stats = [
    {
      title: 'Total Members',
      value: totalMembers,
      description: `${verifiedMembers} verified`,
      icon: Users,
      trend: totalMembers > 0 ? 'stable' : 'neutral',
      color: 'blue',
    },
    {
      title: 'Verified',
      value: verifiedMembers,
      description: `${Math.round((verifiedMembers / Math.max(totalMembers, 1)) * 100)}% of team`,
      icon: UserCheck,
      trend: verifiedMembers === totalMembers ? 'up' : 'neutral',
      color: 'green',
    },
    {
      title: 'Pending Review',
      value: pendingMembers,
      description: metrics?.pendingApprovals ? `${metrics.pendingApprovals} awaiting approval` : 'Needs attention',
      icon: Clock,
      trend: pendingMembers > 0 ? 'down' : 'up',
      color: 'yellow',
    },
    {
      title: 'Profile Completion',
      value: `${Math.round(averageCompletion)}%`,
      description: 'Team average',
      icon: TrendingUp,
      trend: averageCompletion >= 80 ? 'up' : averageCompletion >= 60 ? 'neutral' : 'down',
      color: averageCompletion >= 80 ? 'green' : averageCompletion >= 60 ? 'yellow' : 'red',
    },
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'yellow':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'red':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'blue':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-1 rounded-full border ${getColorClasses(stat.color)}`}>
                  <stat.icon className="w-3 h-3" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{stat.value}</div>
                {getTrendIcon(stat.trend)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Breakdown */}
      {totalMembers > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Employment Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employment Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Full Time</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(fullTimeMembers / totalMembers) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{fullTimeMembers}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Contract</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${(contractMembers / totalMembers) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{contractMembers}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Other</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-500 h-2 rounded-full"
                      style={{ 
                        width: `${((totalMembers - fullTimeMembers - contractMembers) / totalMembers) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{totalMembers - fullTimeMembers - contractMembers}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Locations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Work Arrangements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Remote</span>
                <Badge variant="outline">{remoteMembers}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Office</span>
                <Badge variant="outline">
                  {teamMembers.filter(m => m.work_location === 'office').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Hybrid</span>
                <Badge variant="outline">
                  {teamMembers.filter(m => m.work_location === 'hybrid').length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Overview */}
      {totalMembers > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-600">{verifiedMembers}</div>
                <div className="text-sm text-green-600">Verified</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{pendingMembers}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              {rejectedMembers > 0 && (
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{rejectedMembers}</div>
                  <div className="text-sm text-red-600">Rejected</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamStats;