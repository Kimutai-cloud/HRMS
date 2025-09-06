import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  UserCheck, 
  FileCheck, 
  Settings, 
  CheckCircle,
  ChevronRight
} from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  completed?: boolean;
}

interface WorkflowStepperProps {
  currentStep: string;
  onStepChange: (stepId: string) => void;
  steps: Step[];
}

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  onStepChange,
  steps
}) => {
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  const getStepStatus = (stepId: string, index: number) => {
    if (index < currentIndex) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500';
      case 'current':
        return 'bg-blue-500 text-white border-blue-500';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-300';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Employee Approval Process</h3>
          <p className="text-sm text-muted-foreground">
            Step {currentIndex + 1} of {steps.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => onStepChange(steps[currentIndex - 1]?.id)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === steps.length - 1}
            onClick={() => onStepChange(steps[currentIndex + 1]?.id)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, index);
          const IconComponent = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div 
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => onStepChange(step.id)}
              >
                <div 
                  className={`
                    w-12 h-12 rounded-full border-2 flex items-center justify-center mb-2 
                    transition-all duration-200 group-hover:scale-105
                    ${getStepClasses(status)}
                  `}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <IconComponent className="w-6 h-6" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${
                    status === 'current' ? 'text-blue-600' : 
                    status === 'completed' ? 'text-green-600' : 
                    'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {step.description}
                  </p>
                  {step.count > 0 && (
                    <Badge 
                      variant={status === 'current' ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      {step.count} pending
                    </Badge>
                  )}
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="flex-1 flex items-center justify-center mb-8">
                  <ChevronRight className={`w-5 h-5 ${
                    index < currentIndex ? 'text-green-500' : 'text-gray-300'
                  }`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowStepper;