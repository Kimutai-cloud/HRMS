import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Save, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/serviceFactory';
import { useToast } from '@/hooks/use-toast';

// Form validation schema matching backend requirements exactly
const profileSubmissionSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(255),
  last_name: z.string().min(1, 'Last name is required').max(255),
  department: z.string().min(1, 'Department is required').max(255),
  phone: z.string().max(50).optional().or(z.literal('')),
  title: z.string().max(255).optional().or(z.literal('')),
  manager_id: z.string().optional().or(z.literal('')),
});

type ProfileSubmissionData = z.infer<typeof profileSubmissionSchema>;

interface Department {
  id?: string;
  name: string;
  description?: string;
  manager_count: number;
  employee_count: number;
}

interface Manager {
  id: string;
  full_name: string;
  title?: string;
  department: string;
  email: string;
}

const SimpleProfileForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  
  // Check if user has verified profile (can only update basic details)
  const isVerifiedProfile = userProfile?.verification_status === 'VERIFIED';

  const form = useForm<ProfileSubmissionData>({
    resolver: zodResolver(profileSubmissionSchema),
    defaultValues: {
      first_name: userProfile?.first_name || '',
      last_name: userProfile?.last_name || '',
      department: userProfile?.department || '',
      phone: userProfile?.phone || '',
      title: userProfile?.title || '',
      manager_id: userProfile?.manager_id || '',
    },
  });

  // Update form when userProfile data loads
  useEffect(() => {
    if (userProfile) {
      form.reset({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        department: userProfile.department || '',
        phone: userProfile.phone || '',
        title: userProfile.title || '',
        manager_id: userProfile.manager_id || '',
      });
      setSelectedDepartment(userProfile.department || '');
    }
  }, [userProfile, form]);

  // Load departments on component mount (skip for verified profiles)
  useEffect(() => {
    // Skip loading departments for verified profiles since they can't change them
    if (isVerifiedProfile) {
      setLoadingDepartments(false);
      return;
    }
    
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const departmentsData = await employeeService.get<Department[]>('/profile/departments');
        console.info('Loaded departments:', departmentsData);
        setDepartments(departmentsData);
      } catch (error) {
        console.error('Failed to load departments:', error);
        toast({
          title: 'Error',
          description: 'Failed to load departments. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, [toast, isVerifiedProfile]);

  // Load managers when department is selected (skip for verified profiles)
  useEffect(() => {
    // Skip loading managers for verified profiles since they can't change them
    if (isVerifiedProfile) {
      return;
    }
    
    if (selectedDepartment) {
      const loadManagers = async () => {
        try {
          setLoadingManagers(true);
          const managersData = await employeeService.get<Manager[]>(`/profile/managers/by-department/${encodeURIComponent(selectedDepartment)}`);
          console.info('Loaded managers for department:', selectedDepartment, managersData);
          setManagers(managersData);
        } catch (error) {
          console.error('Failed to load managers:', error);
          setManagers([]);
        } finally {
          setLoadingManagers(false);
        }
      };

      loadManagers();
    } else {
      setManagers([]);
    }
  }, [selectedDepartment, isVerifiedProfile]);

  // Handle department change
  const handleDepartmentChange = (department: string) => {
    setSelectedDepartment(department);
    form.setValue('department', department);
    // Clear manager selection when department changes
    form.setValue('manager_id', '');
  };

  const onSubmit = async (data: ProfileSubmissionData) => {
    try {
      setSubmitting(true);
      
      // Prepare submission data matching backend schema exactly
      const submissionData = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        department: data.department.trim(),
        phone: data.phone?.trim() || null,
        title: data.title?.trim() || null,
        manager_id: data.manager_id && data.manager_id.trim() ? data.manager_id.trim() : null,
      };
      console.info('Submitting profile data:', submissionData);

      // Determine the correct endpoint based on user status
      const hasExistingProfile = !!userProfile?.id;
      const isRejectedProfile = userProfile?.verification_status === 'REJECTED';
      const isVerifiedProfile = userProfile?.verification_status === 'VERIFIED';
      let response;
      
      if (hasExistingProfile && isRejectedProfile) {
        // Resubmit rejected profile
        response = await employeeService.post('/profile/resubmit', submissionData);
        console.info('Profile resubmitted successfully:', response);
        
        toast({
          title: 'Profile Resubmitted Successfully!',
          description: 'Your employee profile has been resubmitted for admin review.',
        });
      } else if (!hasExistingProfile) {
        // Create new profile
        response = await employeeService.post('/profile/submit', submissionData);
        console.info('Profile submitted successfully:', response);
        
        toast({
          title: 'Profile Submitted Successfully!',
          description: 'Your employee profile has been submitted for admin review.',
        });
      } else if (hasExistingProfile && isVerifiedProfile) {
        // Update verified profile - only allow updating basic details
        const updateData = {
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          phone: data.phone?.trim() || null,
          title: data.title?.trim() || null,
        };
        
        response = await employeeService.updateEmployeeDetails(updateData);
        console.info('Profile details updated successfully:', response);
        
        toast({
          title: 'Profile Updated Successfully!',
          description: 'Your profile details have been updated.',
        });
      } else {
        // Profile exists but status doesn't allow updates
        console.warn('Profile update not supported for current verification status:', userProfile?.verification_status);
        toast({
          title: 'Profile Update Not Available',
          description: 'Profile editing is not available for your current verification status. Contact support if you need assistance.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      // Refresh user profile in auth context to reflect new employee profile status
      try {
        await refreshProfile();
        console.info('User profile refreshed after submission');
        
        // Small delay to ensure backend data is consistent
        setTimeout(() => {
          // Navigate back to appropriate dashboard
          navigate('/newcomer-dashboard');
        }, 1000);
        
      } catch (refreshError) {
        console.warn('Failed to refresh user profile:', refreshError);
        // Navigate even if refresh fails
        navigate('/newcomer-dashboard');
      }
      
    } catch (error: any) {
      console.error('Profile submission failed:', error);
      
      // Handle different types of errors more gracefully
      let errorTitle = 'Submission Failed';
      let errorDescription = 'Failed to submit profile. Please try again.';
      
      if (error.status === 400) {
        // Check if it's a profile submission conflict
        if (error.data?.error === 'SUBMISSION_NOT_ALLOWED') {
          errorTitle = 'Profile Already Submitted';
          errorDescription = error.data?.message || 'Your profile has already been submitted and is under review.';
          
          // Refresh the profile to get updated status
          try {
            await refreshProfile();
          } catch (refreshError) {
            console.warn('Failed to refresh profile after conflict:', refreshError);
          }
        } else {
          errorTitle = 'Invalid Profile Data';
          errorDescription = error.data?.message || 'Please check your information and try again.';
        }
      } else if (error.status === 401) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in again and try submitting your profile.';
      } else if (error.status === 409) {
        errorTitle = 'Profile Already Exists';
        errorDescription = 'You have already submitted a profile. Check your dashboard for status.';
      } else if (error.status === 422) {
        // Handle validation errors (including profile resubmission not allowed)
        errorTitle = 'Validation Error';
        errorDescription = error.data?.message || error.data?.detail || 'Please check your information and try again.';
        
        // If it's a profile status error, refresh the profile
        if (error.data?.message?.includes('Profile already exists')) {
          try {
            await refreshProfile();
          } catch (refreshError) {
            console.warn('Failed to refresh profile after validation error:', refreshError);
          }
        }
      } else if (error.status >= 500) {
        errorTitle = 'Server Error';
        errorDescription = 'There was a system error. Our team has been notified. Please try again in a few minutes.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/newcomer-dashboard');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header with Back Button */}
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={handleBackToDashboard}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isVerifiedProfile ? "Update Your Profile" : "Complete Your Employee Profile"}
          </h1>
          <p className="text-gray-600">
            {isVerifiedProfile 
              ? "Update your personal information as needed."
              : "Please provide your employment details to complete the onboarding process."
            }
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Employee Information</CardTitle>
              <CardDescription>
                Required fields are marked with *
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Name Fields - Required */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your first name"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your last name"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Department - Required Dropdown */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select 
                      onValueChange={handleDepartmentChange}
                      disabled={submitting || loadingDepartments || isVerifiedProfile}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            loadingDepartments ? "Loading departments..." : "Select your department"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.name} value={dept.name}>
                            {dept.name} 
                            {dept.description && ` - ${dept.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g. Software Developer"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g. +1 (555) 123-4567"
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Manager Selection - Optional, shows after department selected */}
              {selectedDepartment && !isVerifiedProfile && (
                <FormField
                  control={form.control}
                  name="manager_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager (Optional)</FormLabel>
                      <Select 
                        onValueChange={field.onChange}
                        disabled={submitting || loadingManagers || isVerifiedProfile}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              loadingManagers ? "Loading managers..." : "Select your manager (optional)"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.full_name} 
                              {manager.title && ` - ${manager.title}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Single Submit Button */}
              <div className="flex justify-end pt-6 border-t">
                <Button 
                  type="submit" 
                  disabled={submitting || !form.formState.isValid}
                  className="min-w-40"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting Profile...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Submit Profile
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleProfileForm;