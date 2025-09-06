import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Users,
  BarChart3,
  PieChart,
  TrendingUp,
  Filter,
  Settings,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'employee' | 'department' | 'performance' | 'attendance' | 'custom';
  icon: any;
  fields: string[];
  requiredPermissions: string[];
}

interface ReportsGeneratorProps {
  className?: string;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'employee-roster',
    name: 'Employee Roster',
    description: 'Complete list of all employees with basic information',
    type: 'employee',
    icon: Users,
    fields: ['name', 'email', 'department', 'position', 'status', 'hire_date'],
    requiredPermissions: ['read:employees']
  },
  {
    id: 'department-summary',
    name: 'Department Summary',
    description: 'Employee count and metrics by department',
    type: 'department',
    icon: BarChart3,
    fields: ['department', 'total_employees', 'verified_count', 'pending_count'],
    requiredPermissions: ['read:departments']
  },
  {
    id: 'verification-status',
    name: 'Verification Status Report',
    description: 'Employee verification and onboarding progress',
    type: 'employee',
    icon: PieChart,
    fields: ['name', 'verification_status', 'profile_completion', 'documents_status'],
    requiredPermissions: ['read:employee_status']
  },
  {
    id: 'performance-metrics',
    name: 'Performance Metrics',
    description: 'Employee performance and goal tracking',
    type: 'performance',
    icon: TrendingUp,
    fields: ['name', 'department', 'goals_completed', 'performance_score'],
    requiredPermissions: ['read:performance']
  },
  {
    id: 'new-hires',
    name: 'New Hires Report',
    description: 'Recently hired employees and their onboarding status',
    type: 'employee',
    icon: Calendar,
    fields: ['name', 'hire_date', 'department', 'onboarding_progress'],
    requiredPermissions: ['read:employees']
  }
];

const ReportsGenerator: React.FC<ReportsGeneratorProps> = ({ className }) => {
  const { isAdmin, isManager, userProfile } = useAuth();
  const { toast } = useToast();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<any[]>([]);

  const availableTemplates = reportTemplates.filter(template => {
    if (isAdmin) return true;
    if (isManager && ['employee', 'department', 'performance'].includes(template.type)) return true;
    return false;
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = reportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedFields(template.fields);
    }
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      toast({
        title: 'Template Required',
        description: 'Please select a report template first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const template = reportTemplates.find(t => t.id === selectedTemplate);
      const newReport = {
        id: Date.now().toString(),
        name: template?.name || 'Custom Report',
        template: selectedTemplate,
        fields: selectedFields,
        filters,
        dateRange,
        generatedAt: new Date(),
        status: 'completed',
        downloadUrl: '#' // In real app, this would be the actual download URL
      };

      setGeneratedReports(prev => [newReport, ...prev]);
      
      toast({
        title: 'Report Generated',
        description: `${template?.name} has been generated successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = (reportId: string) => {
    const report = generatedReports.find(r => r.id === reportId);
    if (!report) return;

    // Generate CSV content
    const csvData = mockReportData[report.template] || [];
    const headers = report.fields;
    const csvContent = [headers, ...csvData].map(row => 
      Array.isArray(row) ? row.join(',') : headers.map((h: string) => (row as any)[h] || '').join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.name.replace(/\s+/g, '-').toLowerCase()}-${format(report.generatedAt, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Your report is being downloaded.',
    });
  };

  const selectedTemplateData = reportTemplates.find(t => t.id === selectedTemplate);

  if (!isAdmin && !isManager) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Access restricted to managers and administrators only.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports Generator</h1>
          <p className="text-muted-foreground">
            Generate custom reports and analytics for your organization
          </p>
        </div>
        <Button onClick={handleGenerateReport} disabled={!selectedTemplate || isGenerating}>
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Report Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer transition-colors",
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="flex items-start gap-3">
                      <template.icon className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {template.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Field Selection */}
          {selectedTemplateData && (
            <Card>
              <CardHeader>
                <CardTitle>Fields to Include</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedTemplateData.fields.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={selectedFields.includes(field)}
                        onCheckedChange={() => handleFieldToggle(field)}
                      />
                      <label
                        htmlFor={field}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                      >
                        {field.replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Filters & Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Department</label>
                    <Select 
                      value={filters.department || 'all'} 
                      onValueChange={(value) => setFilters(prev => ({ ...prev, department: value === 'all' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        <SelectItem value="engineering">Engineering</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="hr">HR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select 
                      value={filters.status || 'all'} 
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="VERIFIED">Verified</SelectItem>
                        <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                        <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="flex gap-2 mt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, 'MMM dd, yyyy') : 'From date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, 'MMM dd, yyyy') : 'To date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Generated Reports */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {generatedReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No reports generated yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generatedReports.slice(0, 5).map((report) => (
                    <div
                      key={report.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{report.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(report.generatedAt, 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadReport(report.id)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Mock data for demonstration
const mockReportData: Record<string, any[]> = {
  'employee-roster': [
    ['John Doe', 'john@company.com', 'Engineering', 'Senior Developer', 'VERIFIED', '2023-01-15'],
    ['Jane Smith', 'jane@company.com', 'Design', 'UI/UX Designer', 'VERIFIED', '2023-02-20'],
    ['Mike Johnson', 'mike@company.com', 'Product', 'Product Manager', 'PENDING_VERIFICATION', '2023-03-10']
  ],
  'department-summary': [
    ['Engineering', 25, 22, 3],
    ['Design', 8, 7, 1],
    ['Product', 6, 5, 1],
    ['Marketing', 4, 4, 0]
  ],
  'verification-status': [
    ['John Doe', 'VERIFIED', 100, 'Complete'],
    ['Jane Smith', 'VERIFIED', 95, 'Missing ID'],
    ['Mike Johnson', 'PENDING_VERIFICATION', 75, 'In Review']
  ]
};

export default ReportsGenerator;