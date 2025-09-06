import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Search,
  Loader2,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useDepartmentsWithStats,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useAssignManager,
  useRemoveManager,
} from '@/hooks/useDepartmentQueries';
import { useManagers } from '@/hooks';
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentStatsResponse,
} from '@/types/department';

interface DepartmentFormData {
  name: string;
  description: string;
}

const DepartmentManagement: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentStatsResponse | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    description: '',
  });

  // Queries and mutations
  const { data: departmentsData, isLoading, refetch: refetchDepartments } = useDepartmentsWithStats();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();
  const assignManagerMutation = useAssignManager();
  const removeManagerMutation = useRemoveManager();

  // Get available managers from API
  const { data: managers = [], isLoading: managersLoading } = useManagers();

  const departments = departmentsData?.departments || [];
  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateDepartment = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Department name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const request: CreateDepartmentRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      await createMutation.mutateAsync(request);
      
      toast({
        title: 'Department Created',
        description: `Department "${formData.name}" has been created successfully.`,
      });

      setShowCreateDialog(false);
      setFormData({ name: '', description: '' });
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create department',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateDepartment = async () => {
    if (!selectedDepartment || !formData.name.trim()) return;

    try {
      const request: UpdateDepartmentRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      await updateMutation.mutateAsync({
        id: selectedDepartment.id,
        data: request,
      });

      toast({
        title: 'Department Updated',
        description: `Department "${formData.name}" has been updated successfully.`,
      });

      setShowEditDialog(false);
      setSelectedDepartment(null);
      setFormData({ name: '', description: '' });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update department',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDepartment = async (department: DepartmentStatsResponse) => {
    try {
      await deleteMutation.mutateAsync(department.id);

      toast({
        title: 'Department Deleted',
        description: `Department "${department.name}" has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Deletion Failed',
        description: error instanceof Error ? error.message : 'Failed to delete department',
        variant: 'destructive',
      });
    }
  };

  const handleAssignManager = async () => {
    if (!selectedDepartment || !selectedManagerId) return;

    try {
      await assignManagerMutation.mutateAsync({
        id: selectedDepartment.id,
        data: { manager_id: selectedManagerId },
      });

      toast({
        title: 'Manager Assigned',
        description: 'Department manager has been assigned successfully.',
      });

      setShowManagerDialog(false);
      setSelectedDepartment(null);
      setSelectedManagerId('');
    } catch (error) {
      console.error('Manager assignment error:', error);
      
      // Extract more specific error message from response
      let errorMessage = 'Failed to assign manager';
      if (error && typeof error === 'object' && 'response' in error) {
        const response = error.response as any;
        if (response?.data?.detail) {
          errorMessage = response.data.detail;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Assignment Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveManager = async (department: DepartmentStatsResponse) => {
    try {
      await removeManagerMutation.mutateAsync(department.id);

      toast({
        title: 'Manager Removed',
        description: 'Department manager has been removed successfully.',
      });
    } catch (error) {
      toast({
        title: 'Removal Failed',
        description: error instanceof Error ? error.message : 'Failed to remove manager',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (department: DepartmentStatsResponse) => {
    setSelectedDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
    });
    setShowEditDialog(true);
  };

  const openManagerDialog = (department: DepartmentStatsResponse) => {
    setSelectedDepartment(department);
    setSelectedManagerId('');
    setShowManagerDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading departments...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Department Management</h2>
          <p className="text-muted-foreground">
            Create and manage organizational departments, assign managers, and view statistics
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={refetchDepartments}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Department
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Department</DialogTitle>
              <DialogDescription>
                Add a new department to your organization with basic information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department Name *</label>
                <Input
                  placeholder="e.g., Engineering, Marketing, Sales"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Brief description of the department's purpose and responsibilities"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setFormData({ name: '', description: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDepartment}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Department
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Building2 className="w-8 h-8 text-primary mr-3" />
            <div>
              <p className="text-2xl font-bold">{departments.length}</p>
              <p className="text-sm text-muted-foreground">Total Departments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">
                {departments.reduce((acc, dept) => acc + dept.employee_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Employees</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <UserCheck className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">
                {departments.filter(dept => dept.manager_id).length}
              </p>
              <p className="text-sm text-muted-foreground">Departments with Managers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>

        {/* Departments Table */}
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {searchQuery ? 'No departments match your search.' : 'No departments found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => (
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
                        {department.manager_name ? (
                          <div>
                            <p className="font-medium">
                              {department.manager_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Manager ID: {department.manager_id}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No manager assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{department.employee_count}</span>
                          <span className="text-muted-foreground">total</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {department.active_employees} active, {department.pending_employees} pending
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={department.is_active ? 'default' : 'secondary'}>
                          {department.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(department)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          {department.manager_id ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <UserX className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Manager</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove the manager from "{department.name}"?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveManager(department)}
                                  >
                                    Remove Manager
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openManagerDialog(department)}
                            >
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Department</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{department.name}"? This action cannot be undone.
                                  {department.employee_count > 0 && (
                                    <span className="block mt-2 text-red-600">
                                      Warning: This department has {department.employee_count} employees assigned to it.
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDepartment(department)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Department
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update the department name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedDepartment(null);
                setFormData({ name: '', description: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDepartment}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Manager Dialog */}
      <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Manager</DialogTitle>
            <DialogDescription>
              Select a manager to assign to this department.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Manager</label>
              <Select onValueChange={setSelectedManagerId} value={selectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a manager..." />
                </SelectTrigger>
                <SelectContent>
                  {managersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading managers...
                    </SelectItem>
                  ) : managers.length === 0 ? (
                    <SelectItem value="no-managers" disabled>
                      No managers available
                    </SelectItem>
                  ) : (
                    managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        <div>
                          <p className="font-medium">{manager.full_name}</p>
                          <p className="text-sm text-muted-foreground">{manager.email}</p>
                          {manager.title && (
                            <p className="text-xs text-muted-foreground">{manager.title}</p>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManagerDialog(false);
                setSelectedDepartment(null);
                setSelectedManagerId('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignManager}
              disabled={assignManagerMutation.isPending || !selectedManagerId}
            >
              {assignManagerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentManagement;