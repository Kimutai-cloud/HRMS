import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Loader2,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useDepartment,
  useDepartmentEmployees,
} from '@/hooks/useDepartmentQueries';
import { format } from 'date-fns';

const ManagerDepartmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Queries
  const { data: department, isLoading: departmentLoading } = useDepartment(id || '');
  const { data: employeesData, isLoading: employeesLoading } = useDepartmentEmployees(id || '');

  const handleBack = () => {
    navigate('/manager/departments');
  };

  if (departmentLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading department details...</span>
        </CardContent>
      </Card>
    );
  }

  if (!department) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Departments
        </Button>
        <Card className="w-full">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Department Not Found</h3>
            <p className="text-muted-foreground text-center">
              The department you're looking for doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employees = employeesData?.employees || [];

  // Calculate statistics
  const activeEmployees = employees.filter(emp => emp.status === 'ACTIVE' || emp.employment_status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Departments
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{department.name}</h2>
            <p className="text-muted-foreground">Department Management</p>
          </div>
        </div>
        <Badge variant={department.is_active ? 'default' : 'secondary'}>
          {department.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Department Info */}
      <Card>
        <CardHeader>
          <CardTitle>Department Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-muted-foreground">
                {department.description || 'No description provided'}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Department Manager</h4>
              {department.manager ? (
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="font-medium">
                      {department.manager.first_name} {department.manager.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {department.manager.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No manager assigned</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="w-8 h-8 text-primary mr-3" />
            <div>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="text-sm text-muted-foreground">Total Employees</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Building2 className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{activeEmployees}</p>
              <p className="text-sm text-muted-foreground">Active Employees</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              <span>Loading employees...</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center p-8">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Employees</h3>
              <p className="text-muted-foreground">
                This department doesn't have any employees assigned yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hired Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {employee.first_name[0]}{employee.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ID: {employee.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{employee.title || 'No title'}</p>
                        <p className="text-sm text-muted-foreground">{employee.department}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="w-3 h-3 mr-1" />
                            {employee.email}
                          </div>
                          {employee.phone && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Phone className="w-3 h-3 mr-1" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            employee.verification_status === 'VERIFIED' 
                              ? 'default' 
                              : employee.verification_status?.startsWith('PENDING')
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {employee.verification_status?.toLowerCase().replace(/_/g, ' ') || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-3 h-3 mr-1" />
                          {employee.hired_at 
                            ? format(new Date(employee.hired_at), 'MMM dd, yyyy')
                            : 'Not set'
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDepartmentDetail;