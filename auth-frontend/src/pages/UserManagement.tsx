import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  UserMinus,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  MoreHorizontal,
  Download,
  Mail,
  Phone,
  Calendar,
  Building,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import EmployeeService from "@/services/employeeService";
import { type EmployeeData } from "@/types/auth";
import { useNavigate } from "react-router-dom";

interface FilterOptions {
  search: string;
  department: string;
  verificationStatus: string;
  employmentStatus: string;
}

interface ActionDialog {
  open: boolean;
  type: 'approve' | 'reject' | 'deactivate' | null;
  employee: EmployeeData | null;
  reason: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    department: "",
    verificationStatus: "",
    employmentStatus: ""
  });
  const [actionDialog, setActionDialog] = useState<ActionDialog>({
    open: false,
    type: null,
    employee: null,
    reason: ""
  });

  const employeeService = new EmployeeService();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [employees, filters]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Set access token
      const authService = new (await import('../services/authService')).default();
      const token = authService.getAccessToken();
      employeeService.setAccessToken(token);

      const employeesData = await employeeService.getAllEmployees();
      setEmployees(employeesData);
      
    } catch (err) {
      console.error('Failed to load employees:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load employees';
      setError(errorMessage);
      showNotification('error', `Failed to load employees: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...employees];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.first_name?.toLowerCase().includes(searchLower) ||
        emp.last_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower) ||
        emp.department?.toLowerCase().includes(searchLower) ||
        emp.position?.toLowerCase().includes(searchLower)
      );
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(emp => emp.department === filters.department);
    }

    // Verification status filter
    if (filters.verificationStatus) {
      filtered = filtered.filter(emp => emp.verification_status === filters.verificationStatus);
    }

    setFilteredEmployees(filtered);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    // Convert "all" to empty string for filter logic
    const filterValue = value === "all" ? "" : value;
    setFilters(prev => ({ ...prev, [key]: filterValue }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      department: "",
      verificationStatus: "",
      employmentStatus: ""
    });
  };

  const openActionDialog = (type: 'approve' | 'reject' | 'deactivate', employee: EmployeeData) => {
    setActionDialog({
      open: true,
      type,
      employee,
      reason: ""
    });
  };

  const closeActionDialog = () => {
    setActionDialog({
      open: false,
      type: null,
      employee: null,
      reason: ""
    });
  };

  const handleAction = async () => {
    if (!actionDialog.employee || !actionDialog.type) return;

    try {
      const employeeId = actionDialog.employee.id;
      
      switch (actionDialog.type) {
        case 'approve':
          await employeeService.approveEmployee(employeeId, actionDialog.reason || 'Approved by admin');
          break;
        case 'reject':
          await employeeService.rejectEmployee(employeeId, actionDialog.reason || 'Rejected by admin');
          break;
        case 'deactivate':
          // Use admin service for deactivation
          const adminService = (await import('@/services/adminService')).default;
          await adminService.deleteUser(employeeId, actionDialog.reason || 'Deactivated by admin');
          break;
      }

      closeActionDialog();
      await loadEmployees(); // Reload data
      
    } catch (err) {
      console.error(`Failed to ${actionDialog.type} employee:`, err);
      const errorMessage = err instanceof Error ? err.message : `Failed to ${actionDialog.type} employee`;
      setError(errorMessage);
      showNotification('error', errorMessage);
    }
  };

  const getVerificationStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'PENDING_DETAILS_REVIEW':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Details Review</Badge>;
      case 'PENDING_DOCUMENTS_REVIEW':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Docs Review</Badge>;
      case 'PENDING_ROLE_ASSIGNMENT':
        return <Badge className="bg-purple-100 text-purple-800"><Clock className="w-3 h-3 mr-1" />Role Assignment</Badge>;
      case 'PENDING_FINAL_APPROVAL':
        return <Badge className="bg-orange-100 text-orange-800"><Clock className="w-3 h-3 mr-1" />Final Approval</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800"><UserX className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'NOT_SUBMITTED':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Not Submitted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmploymentStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get unique departments for filter dropdown
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">
              Manage all employees, review profiles, and handle approvals
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadEmployees} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="ml-2 text-2xl font-bold">{employees.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total Employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="ml-2 text-2xl font-bold text-green-600">
                  {employees.filter(e => e.verification_status === 'VERIFIED').length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="ml-2 text-2xl font-bold text-yellow-600">
                  {employees.filter(e => e.verification_status?.includes('PENDING')).length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="ml-2 text-2xl font-bold text-red-600">
                  {employees.filter(e => e.verification_status === 'REJECTED').length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Rejected</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select value={filters.department} onValueChange={(value) => handleFilterChange('department', value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Verification Status</label>
                <Select value={filters.verificationStatus} onValueChange={(value) => handleFilterChange('verificationStatus', value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="PENDING_DETAILS_REVIEW">Pending Details</SelectItem>
                    <SelectItem value="PENDING_DOCUMENTS_REVIEW">Pending Documents</SelectItem>
                    <SelectItem value="PENDING_ROLE_ASSIGNMENT">Pending Role</SelectItem>
                    <SelectItem value="PENDING_FINAL_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="NOT_SUBMITTED">Not Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Employment</label>
                <Select value={filters.employmentStatus} onValueChange={(value) => handleFilterChange('employmentStatus', value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={clearFilters} variant="outline" size="sm">
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Employee Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Employees ({filteredEmployees.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.position}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>
                        {getVerificationStatusBadge(employee.verification_status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(employee.hire_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/employees/${employee.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {employee.verification_status?.includes('PENDING') && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog('approve', employee)}
                                  className="text-green-600"
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog('reject', employee)}
                                  className="text-red-600"
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredEmployees.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No employees found matching the current filters.</p>
                <Button onClick={clearFilters} variant="outline" className="mt-2">
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={actionDialog.open} onOpenChange={closeActionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionDialog.type === 'approve' && 'Approve Employee'}
                {actionDialog.type === 'reject' && 'Reject Employee'}
                {actionDialog.type === 'deactivate' && 'Deactivate Employee'}
              </DialogTitle>
              <DialogDescription>
                {actionDialog.type === 'approve' && `Are you sure you want to approve ${actionDialog.employee?.first_name} ${actionDialog.employee?.last_name}?`}
                {actionDialog.type === 'reject' && `Are you sure you want to reject ${actionDialog.employee?.first_name} ${actionDialog.employee?.last_name}?`}
                {actionDialog.type === 'deactivate' && `Are you sure you want to deactivate ${actionDialog.employee?.first_name} ${actionDialog.employee?.last_name}?`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {actionDialog.type === 'approve' ? 'Notes (optional)' : 'Reason'}
                </label>
                <Textarea
                  value={actionDialog.reason}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={
                    actionDialog.type === 'approve' 
                      ? 'Add any notes about this approval...' 
                      : `Please provide a reason for ${actionDialog.type}ing this employee...`
                  }
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeActionDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleAction}
                variant={actionDialog.type === 'approve' ? 'default' : 'destructive'}
              >
                {actionDialog.type === 'approve' && 'Approve'}
                {actionDialog.type === 'reject' && 'Reject'}
                {actionDialog.type === 'deactivate' && 'Deactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}