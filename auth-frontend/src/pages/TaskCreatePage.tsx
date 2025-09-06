import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { taskService } from '@/services/serviceFactory';
import { departmentService, employeeService } from '@/services/serviceFactory';
import { TaskType, Priority } from '@/types/task';
import { ROUTE_PATHS } from '@/config/routes';

interface CreateTaskFormData {
  title: string;
  description: string;
  task_type: TaskType;
  priority: Priority;
  department_id: string;
  assignee_id?: string;
  estimated_hours?: number;
  due_date?: string;
  tags: string[];
}

const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState<CreateTaskFormData>({
    title: '',
    description: '',
    task_type: 'TASK',
    priority: 'MEDIUM',
    department_id: '',
    assignee_id: '',
    estimated_hours: undefined,
    due_date: '',
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [assignImmediately, setAssignImmediately] = useState(false);

  // Fetch departments
  const { data: departments, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getDepartmentsForDropdown(),
  });

  // Fetch employees for selected department
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['departmentEmployees', formData.department_id],
    queryFn: () => departmentService.getDepartmentEmployees(formData.department_id),
    enabled: !!formData.department_id && assignImmediately,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data) => taskService.createTask(data),
    onSuccess: (data) => {
      toast({
        title: 'Task Created Successfully',
        description: `Task "${formData.title}" has been created.`,
      });
      // Invalidate manager dashboard and related queries
      console.log('Task created successfully - invalidating cache for user:', user?.id);
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'manager', 'dashboard', user.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', 'manager'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Force a hard refetch of manager dashboard
      queryClient.refetchQueries({ queryKey: ['tasks', 'manager', 'dashboard'] });
      navigate(ROUTE_PATHS.MANAGER_TASKS);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Task',
        description: error.message || 'An error occurred while creating the task.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: keyof CreateTaskFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear assignee when department changes
    if (field === 'department_id' && value !== formData.department_id) {
      setFormData(prev => ({ ...prev, assignee_id: '' }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Task title is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.department_id) {
      toast({
        title: 'Validation Error',
        description: 'Department is required.',
        variant: 'destructive',
      });
      return;
    }

    if (assignImmediately && !formData.assignee_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select an assignee or uncheck "Assign Immediately".',
        variant: 'destructive',
      });
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      assignee_id: (assignImmediately && formData.assignee_id) ? formData.assignee_id : undefined,
      estimated_hours: formData.estimated_hours || undefined,
      due_date: formData.due_date || undefined,
      // Ensure empty strings are converted to undefined
      description: formData.description?.trim() || undefined,
    };

    // Clean up any empty string values that should be undefined
    Object.keys(submitData).forEach(key => {
      if (submitData[key as keyof typeof submitData] === '') {
        (submitData as any)[key] = undefined;
      }
    });



    createTaskMutation.mutate(submitData);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => navigate(ROUTE_PATHS.MANAGER_TASKS)} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tasks
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Create New Task</h1>
          <p className="text-muted-foreground">Create and assign tasks to your team members</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter task title..."
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe the task requirements, objectives, and any specific instructions..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Task Properties */}
            <Card>
              <CardHeader>
                <CardTitle>Task Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="task_type">Task Type</Label>
                    <Select value={formData.task_type} onValueChange={(value: TaskType) => handleInputChange('task_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROJECT">Project</SelectItem>
                        <SelectItem value="TASK">Task</SelectItem>
                        <SelectItem value="SUBTASK">Subtask</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value: Priority) => handleInputChange('priority', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Select value={formData.department_id} onValueChange={(value) => handleInputChange('department_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentsLoading ? (
                        <SelectItem value="loading" disabled>Loading departments...</SelectItem>
                      ) : (
                        departments?.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimated_hours">Estimated Hours</Label>
                    <Input
                      id="estimated_hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.estimated_hours || ''}
                      onChange={(e) => handleInputChange('estimated_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => handleInputChange('due_date', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assignment */}
            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assign_immediately"
                    checked={assignImmediately}
                    onCheckedChange={setAssignImmediately}
                  />
                  <Label htmlFor="assign_immediately">Assign to team member</Label>
                </div>

                {assignImmediately && (
                  <div>
                    <Label htmlFor="assignee">Assignee</Label>
                    <Select 
                      value={formData.assignee_id} 
                      onValueChange={(value) => handleInputChange('assignee_id', value)}
                      disabled={!formData.department_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !formData.department_id 
                            ? "Select department first..." 
                            : employeesLoading 
                            ? "Loading employees..." 
                            : "Select assignee..."
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.employees?.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" onClick={handleAddTag} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <div key={tag} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
                        {tag}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createTaskMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate(ROUTE_PATHS.MANAGER_TASKS)}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TaskCreatePage;