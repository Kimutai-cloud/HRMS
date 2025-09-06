/**
 * Task Creation Form Component
 * Comprehensive form for creating new tasks with validation and backend integration
 */

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useCreateTask } from '@/hooks/queries/useTaskQueries';
import { useDepartments } from '@/hooks/useDepartmentQueries';
import { useAllEmployees } from '@/hooks/queries/useEmployeeQueries';
import { TaskType, Priority, type CreateTaskRequest } from '@/types/task';
import type { Department } from '@/types/department';
import type { EmployeeData } from '@/types/auth';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  X, 
  Plus,
  AlertTriangle,
  CheckCircle,
  User,
  Building
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Validation schema based on backend requirements
const taskCreationSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string().optional(),
  task_type: z.nativeEnum(TaskType, {
    required_error: 'Task type is required'
  }),
  priority: z.nativeEnum(Priority, {
    required_error: 'Priority is required'
  }),
  department_id: z.string()
    .min(1, 'Department is required')
    .uuid('Invalid department selected'),
  assignee_id: z.string().uuid('Invalid assignee selected').optional().or(z.literal('')),
  parent_task_id: z.string().uuid('Invalid parent task selected').optional().or(z.literal('')),
  estimated_hours: z.number()
    .min(0.5, 'Minimum 0.5 hours required')
    .max(999, 'Maximum 999 hours allowed')
    .optional(),
  due_date: z.date().optional(),
  tags: z.array(z.string()).optional(),
  assign_immediately: z.boolean().default(false),
});

type TaskCreationFormData = z.infer<typeof taskCreationSchema>;

interface TaskCreationFormProps {
  onSuccess?: (taskId: string) => void;
  onCancel?: () => void;
  defaultDepartment?: string;
  defaultAssignee?: string;
  parentTaskId?: string;
}

export const TaskCreationForm: React.FC<TaskCreationFormProps> = ({
  onSuccess,
  onCancel,
  defaultDepartment,
  defaultAssignee,
  parentTaskId
}) => {
  const [newTag, setNewTag] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<EmployeeData[]>([]);
  
  const createTaskMutation = useCreateTask();
  const { data: departments, isLoading: departmentsLoading } = useDepartments();
  const { data: employees, isLoading: employeesLoading } = useAllEmployees();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<TaskCreationFormData>({
    resolver: zodResolver(taskCreationSchema),
    defaultValues: {
      title: '',
      description: '',
      task_type: TaskType.TASK,
      priority: Priority.MEDIUM,
      department_id: defaultDepartment || '',
      assignee_id: defaultAssignee || '',
      parent_task_id: parentTaskId || '',
      estimated_hours: undefined,
      due_date: undefined,
      tags: [],
      assign_immediately: false,
    }
  });

  const watchedValues = watch();
  const { department_id, assignee_id, tags, assign_immediately } = watchedValues;

  // Filter employees by selected department
  const filteredEmployees = React.useMemo(() => {
    if (!employees || !department_id) return [];
    // EmployeeData has department as string, not department_id
    return employees.filter(emp => emp.department === department_id);
  }, [employees, department_id]);

  // Clear assignee when department changes
  useEffect(() => {
    if (department_id && assignee_id) {
      const isAssigneeInDepartment = filteredEmployees.some(emp => emp.id === assignee_id);
      if (!isAssigneeInDepartment) {
        setValue('assignee_id', '');
      }
    }
  }, [department_id, assignee_id, filteredEmployees, setValue]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags?.includes(newTag.trim())) {
      const updatedTags = [...(tags || []), newTag.trim()];
      setValue('tags', updatedTags);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags?.filter(tag => tag !== tagToRemove) || [];
    setValue('tags', updatedTags);
  };

  const onSubmit = async (data: TaskCreationFormData) => {
    try {
      // Prepare request data
      const requestData: CreateTaskRequest = {
        title: data.title,
        description: data.description || undefined,
        task_type: data.task_type,
        priority: data.priority,
        department_id: data.department_id,
        assignee_id: data.assign_immediately && data.assignee_id ? data.assignee_id : undefined,
        parent_task_id: data.parent_task_id || undefined,
        estimated_hours: data.estimated_hours,
        due_date: data.due_date ? data.due_date.toISOString() : undefined,
        tags: data.tags?.length ? data.tags : undefined,
      };

      const result = await createTaskMutation.mutateAsync(requestData);
      
      toast.success('Task created successfully!', {
        description: `Task "${data.title}" has been created and ${data.assign_immediately ? 'assigned' : 'saved as draft'}.`
      });

      onSuccess?.(result.id);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      
      // Handle validation warnings (task still created successfully)
      if (error.message?.includes('validation warnings')) {
        toast.warning('Task created with warnings', {
          description: 'Task was created successfully but may have validation issues.'
        });
        onSuccess?.(''); // We don't have the task ID in this case
      } else {
        toast.error('Failed to create task', {
          description: error.message || 'An unexpected error occurred.'
        });
      }
    }
  };

  const presetDueDates = [
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: '3 Days', date: addDays(new Date(), 3) },
    { label: '1 Week', date: addDays(new Date(), 7) },
    { label: '2 Weeks', date: addDays(new Date(), 14) },
    { label: '1 Month', date: addDays(new Date(), 30) },
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Enter a clear, descriptive title..."
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Provide detailed information about the task..."
                rows={3}
                className="resize-vertical"
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Task Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="task_type">Task Type *</Label>
              <Controller
                name="task_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.task_type ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TaskType.PROJECT}>
                        📁 Project - Large initiative
                      </SelectItem>
                      <SelectItem value={TaskType.TASK}>
                        📋 Task - Standard work item
                      </SelectItem>
                      <SelectItem value={TaskType.SUBTASK}>
                        📝 Subtask - Part of larger task
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.task_type && (
                <p className="text-sm text-red-500 mt-1">{errors.task_type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.priority ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Priority.LOW}>
                        🔽 Low - When convenient
                      </SelectItem>
                      <SelectItem value={Priority.MEDIUM}>
                        ➡️ Medium - Normal priority
                      </SelectItem>
                      <SelectItem value={Priority.HIGH}>
                        🔼 High - Important
                      </SelectItem>
                      <SelectItem value={Priority.URGENT}>
                        🚨 Urgent - Critical
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority && (
                <p className="text-sm text-red-500 mt-1">{errors.priority.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0.5"
                max="999"
                {...register('estimated_hours', { 
                  setValueAs: (value) => value === '' ? undefined : parseFloat(value) 
                })}
                placeholder="e.g. 8.5"
                className={errors.estimated_hours ? 'border-red-500' : ''}
              />
              {errors.estimated_hours && (
                <p className="text-sm text-red-500 mt-1">{errors.estimated_hours.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Assignment */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="department_id">Department *</Label>
              <Controller
                name="department_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.department_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select department">
                        {departmentsLoading && "Loading departments..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.departments?.map((dept: Department) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {dept.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.department_id && (
                <p className="text-sm text-red-500 mt-1">{errors.department_id.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="assign_immediately"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="assign_immediately"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="assign_immediately" className="text-sm font-normal">
                Assign to employee immediately (otherwise save as draft)
              </Label>
            </div>

            {assign_immediately && (
              <div>
                <Label htmlFor="assignee_id">Assign To</Label>
                <Controller
                  name="assignee_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={errors.assignee_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select employee">
                          {employeesLoading && "Loading employees..."}
                          {!department_id && "Select department first"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEmployees.map((employee: EmployeeData) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {`${employee.first_name} ${employee.last_name}`} ({employee.email})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.assignee_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.assignee_id.message}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Due Date */}
          <div>
            <Label>Due Date</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {presetDueDates.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue('due_date', preset.date)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
              
              <Controller
                name="due_date"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'text-xs',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {field.value ? format(field.value, 'MMM d, yyyy') : 'Custom date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              
              {watchedValues.due_date && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue('due_date', undefined)}
                  className="text-xs text-red-500"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="new_tag">Tags</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="new_tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                Add
              </Button>
            </div>
            
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {createTaskMutation.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {createTaskMutation.error.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TaskCreationForm;