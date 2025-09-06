import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, Eye, EyeOff, Plus, X, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { employeeProfileUpdateSchema, type EmployeeProfileUpdate } from '@/lib/validations';
import { useUpdateEmployeeProfile, useEmployeeProfile } from '@/hooks';
import { useDepartmentsForDropdown } from '@/hooks/useDepartmentQueries';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EmployeeProfileFormProps {
  userId?: string;
  readonly?: boolean;
  onSaved?: () => void;
}

const EmployeeProfileForm: React.FC<EmployeeProfileFormProps> = ({
  userId,
  readonly = false,
  onSaved,
}) => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('personal');

  const targetUserId = userId || user?.id;
  const { data: profileData, isLoading } = useEmployeeProfile(targetUserId);
  const { data: departments, isLoading: departmentsLoading } = useDepartmentsForDropdown();
  const updateProfileMutation = useUpdateEmployeeProfile();

  const form = useForm<EmployeeProfileUpdate>({
    resolver: zodResolver(employeeProfileUpdateSchema),
    defaultValues: {
      personalInfo: {
        firstName: '',
        lastName: '',
        phoneNumber: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
      },
      employmentInfo: {
        position: '',
        department: '',
        employmentType: 'full_time',
        workLocation: 'office',
      },
      emergencyContact: {
        name: '',
        relationship: '',
        phoneNumber: '',
        email: '',
      },
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profileData?.employee) {
      const employee = profileData.employee;
      form.reset({
        personalInfo: {
          firstName: employee.first_name || '',
          lastName: employee.last_name || '',
          phoneNumber: employee.phone_number || '',
          address: employee.address || '',
          city: employee.city || '',
          state: employee.state || ''
        },
        employmentInfo: {
          position: employee.position || '',
          department: employee.department || '',
          employmentType: (employee.employment_type as any) || 'full_time',
          workLocation: (employee.work_location as any) || 'office',
          startDate: employee.start_date ? new Date(employee.start_date) : undefined,
        },
      });
    }
  }, [profileData, form]);

  const onSubmit = async (data: EmployeeProfileUpdate) => {
    try {
      await updateProfileMutation.mutateAsync(data as any);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      onSaved?.();
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  const sections = [
    { id: 'personal', title: 'Personal Information', icon: User },
    { id: 'employment', title: 'Employment Details', icon: User },
    { id: 'emergency', title: 'Emergency Contact', icon: User },
  ];

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading profile...</span>
        </CardContent>
      </Card>
    );
  }

  const renderPersonalInfoSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="personalInfo.firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="personalInfo.lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="personalInfo.dateOfBirth"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date of Birth</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    disabled={readonly}
                    className={cn(
                      'w-[240px] pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    {field.value ? (
                      format(field.value, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date('1900-01-01') || readonly
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="personalInfo.phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input {...field} disabled={readonly} placeholder="+1 (555) 123-4567" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="personalInfo.address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Textarea {...field} disabled={readonly} placeholder="123 Main St, Apt 4B" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="personalInfo.city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="personalInfo.state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="personalInfo.zipCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ZIP Code</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderEmploymentSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="employmentInfo.position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="employmentInfo.department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={readonly || departmentsLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="employmentInfo.employmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employment Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={readonly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="employmentInfo.workLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work Location</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={readonly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select work location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="employmentInfo.startDate"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Start Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    disabled={readonly}
                    className={cn(
                      'w-[240px] pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    {field.value ? (
                      format(field.value, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={readonly}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderEmergencyContactSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="emergencyContact.name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContact.relationship"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Relationship</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="emergencyContact.phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} placeholder="+1 (555) 123-4567" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContact.email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input {...field} disabled={readonly} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'personal':
        return renderPersonalInfoSection();
      case 'employment':
        return renderEmploymentSection();
      case 'emergency':
        return renderEmergencyContactSection();
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Employee Profile</CardTitle>
            <CardDescription>
              {readonly ? 'View employee profile information' : 'Manage your profile information'}
            </CardDescription>
          </div>
          {profileData?.employee && (
            <Badge variant={profileData.employee.verification_status === 'VERIFIED' ? 'default' : 'secondary'}>
              {profileData.employee.verification_status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Section Navigation */}
        <div className="flex space-x-1 mb-6 p-1 bg-muted rounded-lg">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${activeSection === section.id 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <section.icon className="w-4 h-4" />
              <span>{section.title}</span>
            </button>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {renderCurrentSection()}

            {!readonly && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    className="min-w-32"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default EmployeeProfileForm;