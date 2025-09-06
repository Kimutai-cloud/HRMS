import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Users,
  Eye,
  UserCheck,
  TrendingUp,
  Activity,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useManagedDepartments,
  useDepartmentEmployees,
} from '@/hooks/useDepartmentQueries';
import type { DepartmentResponse } from '@/types/department';

const ManagerDepartments: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  // Queries
  const { data: departmentsData, isLoading } = useManagedDepartments();
  const { data: employeesData, isLoading: employeesLoading } = useDepartmentEmployees(
    selectedDepartmentId || '',
    !!selectedDepartmentId
  );

  const departments = departmentsData?.departments || [];

  // Calculate statistics
  const totalEmployees = departments.reduce((acc, dept) => {
    // Assuming we have employee_count from stats or we'll fetch it
    return acc + (dept as any).employee_count || 0;
  }, 0);

  const activeDepartments = departments.filter(dept => dept.is_active).length;

  const handleViewDepartment = (departmentId: string) => {
    navigate(`/manager/departments/${departmentId}`);
  };

  const handleQuickView = (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading your departments...</span>
        </CardContent>
      </Card>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Departments</h2>
          <p className="text-muted-foreground">
            Manage and oversee departments under your supervision
          </p>
        </div>

        <Card className="w-full">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Departments Assigned</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You currently don't have any departments assigned to you. Contact your administrator 
              if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">My Departments</h2>
        <p className="text-muted-foreground">
          Overview of departments under your management
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Building2 className="w-8 h-8 text-primary mr-3" />
            <div>
              <p className="text-2xl font-bold">{departments.length}</p>
              <p className="text-sm text-muted-foreground">Managed Departments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalEmployees}</p>
              <p className="text-sm text-muted-foreground">Team Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Activity className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{activeDepartments}</p>
              <p className="text-sm text-muted-foreground">Active Departments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departments Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Department Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{department.name}</p>
                        {department.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {department.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {(department as any).employee_count || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={department.is_active ? 'default' : 'secondary'}>
                        {department.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Good</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickView(department.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Quick View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDepartment(department.id)}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick View Panel */}
      {selectedDepartmentId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Quick View - {departments.find(d => d.id === selectedDepartmentId)?.name}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDepartmentId(null)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {employeesLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading employees...</span>
              </div>
            ) : employeesData && employeesData.employees.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-medium">Department Employees</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employeesData.employees.slice(0, 6).map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-3 p-3 border rounded-md">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {employee.first_name[0]}{employee.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {employee.title || 'No title'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {employee.verification_status?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
                {employeesData.employees.length > 6 && (
                  <p className="text-sm text-muted-foreground">
                    And {employeesData.employees.length - 6} more employees...
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={() => handleViewDepartment(selectedDepartmentId)}
                >
                  View Full Department Details
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">No employees found in this department.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManagerDepartments;