import React, { useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, Eye, EyeOff, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSubmitProfile, useEmployeeProfile } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const profileSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    dateOfBirth: z.date().optional(),
    phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    city: z.string().min(2, 'City must be at least 2 characters'),
    state: z.string().min(2, 'State must be at least 2 characters'),
    zipCode: z.string().min(5, 'ZIP code must be at least 5 characters'),
    country: z.string().min(2, 'Country must be at least 2 characters'),
  }),
  employmentInfo: z.object({
    position: z.string().min(2, 'Position must be at least 2 characters'),
    department: z.string().min(2, 'Department must be at least 2 characters'),
    startDate: z.date(),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
    workLocation: z.enum(['office', 'remote', 'hybrid']),
  }),
  emergencyContact: z.object({
    name: z.string().min(2, 'Emergency contact name is required'),
    relationship: z.string().min(2, 'Relationship is required'),
    phoneNumber: z.string().min(10, 'Emergency contact phone is required'),
    email: z.string().email('Valid email is required').optional().or(z.literal('')),
  }),
  bankingInfo: z.object({
    accountHolderName: z.string().min(2, 'Account holder name is required'),
    accountNumber: z.string().min(8, 'Account number must be at least 8 characters'),
    routingNumber: z.string().min(9, 'Routing number must be 9 characters'),
    bankName: z.string().min(2, 'Bank name is required'),
  }),
  taxInfo: z.object({
    socialSecurityNumber: z.string().min(9, 'SSN is required'),
    taxFilingStatus: z.enum(['single', 'married', 'head_of_household']),
    numberOfDependents: z.number().min(0),
  }),
  skillsAndExperience: z.object({
    skills: z.array(z.string()).optional(),
    previousExperience: z.string().optional(),
    education: z.string().optional(),
    certifications: z.array(z.string()).optional(),
  }).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileSubmissionFormProps {
  onSubmissionComplete?: () => void;
}

const ProfileSubmissionForm: React.FC<ProfileSubmissionFormProps> = ({
  onSubmissionComplete,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { data: existingProfile } = useEmployeeProfile();
  const submitProfileMutation = useSubmitProfile();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      personalInfo: {
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
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
      bankingInfo: {
        accountHolderName: '',
        accountNumber: '',
        routingNumber: '',
        bankName: '',
      },
      taxInfo: {
        socialSecurityNumber: '',
        taxFilingStatus: 'single',
        numberOfDependents: 0,
      },
      skillsAndExperience: {
        skills: [],
        previousExperience: '',
        education: '',
        certifications: [],
      },
    },
  });

  const steps = [
    {
      title: 'Personal Information',
      description: 'Basic personal details',
      fields: ['personalInfo'],
    },
    {
      title: 'Employment Details',
      description: 'Job and work information',
      fields: ['employmentInfo'],
    },
    {
      title: 'Emergency Contact',
      description: 'Contact person in case of emergency',
      fields: ['emergencyContact'],
    },
    {
      title: 'Banking Information',
      description: 'Direct deposit details',
      fields: ['bankingInfo'],
    },
    {
      title: 'Tax Information',
      description: 'Tax filing details',
      fields: ['taxInfo'],
    },
    {
      title: 'Skills & Experience',
      description: 'Optional additional information',
      fields: ['skillsAndExperience'],
    },
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await submitProfileMutation.mutateAsync(data as any);
      toast({
        title: 'Profile Submitted',
        description: 'Your profile has been submitted for review.',
      });
      onSubmissionComplete?.();
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Failed to submit profile',
        variant: 'destructive',
      });
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderPersonalInfoStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="personalInfo.firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Input {...field} />
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
                    date > new Date() || date < new Date('1900-01-01')
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
              <Input {...field} placeholder="+1 (555) 123-4567" />
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
              <Textarea {...field} placeholder="123 Main St, Apt 4B" />
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
                <Input {...field} />
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
                <Input {...field} />
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderPersonalInfoStep();
      case 1:
        return <div>Employment Info Step</div>; // Placeholder
      case 2:
        return <div>Emergency Contact Step</div>; // Placeholder
      case 3:
        return <div>Banking Info Step</div>; // Placeholder
      case 4:
        return <div>Tax Info Step</div>; // Placeholder
      case 5:
        return <div>Skills & Experience Step</div>; // Placeholder
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              Step {currentStep + 1} of {steps.length}: {currentStepData.description}
            </CardDescription>
          </div>
          <Badge variant="outline">{Math.round(progress)}% Complete</Badge>
        </div>
        <Progress value={progress} className="w-full" />
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {renderCurrentStep()}

            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStep < steps.length - 1 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={submitProfileMutation.isPending}
                    className="min-w-32"
                  >
                    {submitProfileMutation.isPending ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Submit Profile
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ProfileSubmissionForm;