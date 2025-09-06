import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Users,
  TrendingUp,
  Eye,
  UserCheck,
  Activity,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useManagedDepartments } from '@/hooks/useDepartmentQueries';
import { ROUTE_PATHS } from '@/config/routes';

interface DepartmentOverviewCardsProps {
  className?: string;
  maxDepartments?: number;
  showHeader?: boolean;
}

const DepartmentOverviewCards: React.FC<DepartmentOverviewCardsProps> = ({
  className = '',
  maxDepartments = 3,
  showHeader = true,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Queries
  const { data: departmentsData, isLoading, error } = useManagedDepartments();

  const departments = departmentsData?.departments || [];
  const displayDepartments = departments.slice(0, maxDepartments);

  // Calculate statistics
  const totalEmployees = departments.reduce((acc, dept) => 
    acc + ((dept as any).employee_count || 0), 0
  );
  
  const activeDepartments = departments.filter(dept => dept.is_active).length;
  
  const avgPerformance = departments.length > 0 
    ? Math.round(departments.reduce((acc, dept) => {
        // Mock performance calculation based on active status and employee count
        const performance = dept.is_active ? 85 : 50;
        return acc + performance;
      }, 0) / departments.length)
    : 0;

  const handleViewDepartment = (departmentId: string) => {
    navigate(`${ROUTE_PATHS.MANAGER_DEPARTMENT_DETAIL.replace(':id', departmentId)}`);
  };

  const handleViewAllDepartments = () => {
    navigate(ROUTE_PATHS.MANAGER_DEPARTMENTS);
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load department data
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading departments...</span>
        </CardContent>
      </Card>
    );
  }

  if (departments.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Building2 className="w-12 h-12 text-muted-foreground mb-3" />
          <h4 className="font-medium mb-1">No Departments</h4>
          <p className="text-sm text-muted-foreground text-center">
            You don't have any departments assigned to manage yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Department Overview</h3>
            <p className="text-sm text-muted-foreground">
              Departments under your management
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleViewAllDepartments}>
            <Building2 className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center p-4">
            <Building2 className="w-8 h-8 text-primary mr-3" />
            <div>
              <p className="text-xl font-bold">{departments.length}</p>
              <p className="text-xs text-muted-foreground">Managed Departments</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-xl font-bold">{totalEmployees}</p>
              <p className="text-xs text-muted-foreground">Total Employees</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-xl font-bold">{avgPerformance}%</p>
              <p className="text-xs text-muted-foreground">Avg Performance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Cards */}
      <div className="space-y-4">
        {displayDepartments.map((department) => {
          const employeeCount = (department as any).employee_count || 0;
          const activeEmployees = (department as any).active_employees || 0;
          const pendingEmployees = (department as any).pending_employees || 0;
          
          // Mock performance calculation
          const performance = department.is_active 
            ? Math.min(85 + Math.random() * 15, 100)
            : 50 + Math.random() * 30;

          return (
            <Card key={department.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium">{department.name}</h4>
                      <Badge variant={department.is_active ? 'default' : 'secondary'}>
                        {department.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {department.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {department.description}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDepartment(department.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center text-sm">
                    <Users className="w-4 h-4 text-muted-foreground mr-2" />
                    <span>{employeeCount} employees</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <UserCheck className="w-4 h-4 text-green-500 mr-2" />
                    <span>{activeEmployees} active</span>
                  </div>
                  {pendingEmployees > 0 && (
                    <div className="flex items-center text-sm col-span-2">
                      <Activity className="w-4 h-4 text-yellow-500 mr-2" />
                      <span>{pendingEmployees} pending review</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Department Performance</span>
                    <span>{Math.round(performance)}%</span>
                  </div>
                  <Progress value={performance} className="h-2" />
                </div>

                {department.manager && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center text-sm">
                      <UserCheck className="w-4 h-4 text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Manager:</span>
                      <span className="ml-2 font-medium">
                        {department.manager.first_name} {department.manager.last_name}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Show "View All" button if there are more departments */}
      {departments.length > maxDepartments && (
        <div className="mt-4">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleViewAllDepartments}
          >
            View All {departments.length} Departments
          </Button>
        </div>
      )}
    </div>
  );
};

export default DepartmentOverviewCards;