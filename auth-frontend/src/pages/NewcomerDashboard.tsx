import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle, 
  Upload, 
  Clock, 
  FileText,
  User,
  Shield,
  AlertCircle,
  BookOpen,
  Target,
  Coffee,
  RefreshCw,
  Edit,
  Download,
  Trash2
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { employeeService } from "@/services/serviceFactory";

interface ProfileStatus {
  employee_id: string;
  user_id: string;
  verification_status: string;
  status_description: string;
  current_stage: string;
  progress_percentage: number;
  submitted_at?: string;
  next_steps: string[];
  required_actions: string[];
  can_resubmit: boolean;
  rejection_reason?: string;
}

interface DocumentData {
  id: string;
  document_type: string;
  display_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  review_status: 'PENDING' | 'APPROVED' | 'REQUIRES_REPLACEMENT';
  review_notes?: string;
  reviewed_at?: string;
  is_required: boolean;
}

interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  verification_status: string;
}

interface MeResponse {
  employee: EmployeeProfile | null;
}


export default function NewcomerDashboard() {
  const { user, userProfile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First check if user has an employee profile via /me/
      const meResponse = await employeeService.get<MeResponse>('/me/') ;
      
      if (meResponse.employee) {
        // User has a profile - load profile data
        setEmployeeProfile(meResponse.employee);
        
        // Try to load profile status and documents (these require profile to exist)
        const [statusResponse, documentsResponse] = await Promise.allSettled([
          employeeService.get<ProfileStatus>('/profile/status'),
          employeeService.get<DocumentData[]>('/profile/documents')
        ]);

        if (statusResponse.status === 'fulfilled') {
          setProfileStatus(statusResponse.value);
        } else {
          console.info('Profile status not available yet');
        }

        if (documentsResponse.status === 'fulfilled') {
          setDocuments(documentsResponse.value);
        } else {
          console.info('Documents not accessible yet:', documentsResponse.reason);
        }
      } else {
        // User has no employee profile yet - this is expected for newcomers
        console.info('No employee profile found - user needs to complete profile first');
        setEmployeeProfile(null);
        setProfileStatus(null);
        setDocuments([]);
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      // Don't show error for expected 404s - user just needs to complete profile
      if (err instanceof Error) {
      if(err.message?.includes('Profile verification required') || 
          err.message?.includes('Employee profile not found')) {
        console.info('User needs to complete profile first');
      } else {
        const errorMessage = 'Failed to load dashboard data. Please try again.';
        setError(errorMessage);
        showNotification('error', errorMessage);
      }
    }
    } finally {
      setLoading(false);
    }
  }, [userProfile]); // Dependency array for useCallback

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]); // Now depends on stable loadDashboardData

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      // Use the dedicated uploadDocument method which handles FormData correctly
      await employeeService.uploadDocument(user?.id || '', documentType, file);
      
      // Reload documents after successful upload
      await loadDashboardData();
      showNotification('success', 'Document uploaded successfully!');
    } catch (err) {
      console.error('Failed to upload document:', err);
      const errorMessage = 'Failed to upload document. Please try again.';
      setError(errorMessage);
      showNotification('error', errorMessage);
    } finally {
      setUploadingDocument(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await employeeService.delete(`/profile/documents/${documentId}`);
      await loadDashboardData();
      showNotification('success', 'Document deleted successfully!');
    } catch (err) {
      console.error('Failed to delete document:', err);
      const errorMessage = 'Failed to delete document. Please try again.';
      setError(errorMessage);
      showNotification('error', errorMessage);
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      await employeeService.download(`/profile/documents/${documentId}/download`, fileName);
      showNotification('success', 'Document downloaded successfully!');
    } catch (err) {
      console.error('Failed to download document:', err);
      const errorMessage = 'Failed to download document. Please try again.';
      setError(errorMessage);
      showNotification('error', errorMessage);
    }
  };

  const navigateToProfileCompletion = () => {
    // Use React Router navigation for better SPA behavior
    navigate('/profile/edit');
  };

  // Helper function to normalize verification status for display
  const normalizeVerificationStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'PENDING_DETAILS_REVIEW': 'Details Under Review',
      'PENDING_DOCUMENTS_REVIEW': 'Documents Under Review', 
      'PENDING_ROLE_ASSIGNMENT': 'Role Assignment Pending',
      'PENDING_FINAL_APPROVAL': 'Final Approval Pending',
      'VERIFIED': 'Verified',
      'REJECTED': 'Rejected',
      'NOT_STARTED': 'Not Started'
    };
    return statusMap[status] || status.replace(/_/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const requiredDocuments = [
    { type: 'ID_CARD', uploadKey: 'government_id', label: 'Government ID', required: true },
    { type: 'EDUCATION_CERTIFICATE', uploadKey: 'educational_certificates', label: 'Educational Certificates', required: true },
    { type: 'EMPLOYMENT_CONTRACT', uploadKey: 'employment_contract', label: 'Employment Contract', required: true },
  ];

  const optionalDocuments = [
    { type: 'PASSPORT', uploadKey: 'passport', label: 'Passport', required: false },
    { type: 'DRIVERS_LICENSE', uploadKey: 'drivers_license', label: 'Driver\'s License', required: false },
    { type: 'PROFESSIONAL_CERTIFICATION', uploadKey: 'professional_certification', label: 'Professional Certifications', required: false },
    { type: 'OTHER', uploadKey: 'other', label: 'Other Documents', required: false }
  ];

  // Calculate completion metrics
  const uploadedDocuments = documents.length;
  const approvedDocuments = documents.filter(doc => doc.review_status === 'APPROVED').length;
  const requiredUploaded = requiredDocuments.filter(reqDoc => 
    documents.some(doc => doc.document_type === reqDoc.type)
  ).length;

  const profileCompletion = employeeProfile ? 
    Math.round((
      (employeeProfile.first_name ? 1 : 0) +
      (employeeProfile.last_name ? 1 : 0) +
      (employeeProfile.phone ? 1 : 0) +
      (employeeProfile.title ? 1 : 0) +
      (employeeProfile.department ? 1 : 0)
    ) / 5 * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center p-6 rounded-lg bg-gradient-to-r from-primary/10 to-info/10 border animate-pulse">
          <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-4"></div>
          <div className="h-8 bg-gray-300 rounded w-64 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-96 mx-auto"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-gray-300 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Welcome Section */}
      <div className="text-center p-6 rounded-lg bg-gradient-to-r from-primary/10 to-info/10 border">
        <Coffee className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome to the team{employeeProfile ? `, ${employeeProfile.first_name}` : ''}!
        </h1>
        <p className="text-muted-foreground">Let's get you set up and ready to go. Complete your profile to access all features.</p>
      </div>

      {/* Progress Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Profile Complete"
          value={`${profileCompletion}%`}
          description="Overall progress"
          icon={User}
          variant="info"
        />
        <MetricCard
          title="Required Documents"
          value={`${requiredUploaded}/${requiredDocuments.length}`}
          description="Must upload to proceed"
          icon={AlertCircle}
          variant={requiredUploaded === requiredDocuments.length ? "success" : "warning"}
        />
        <MetricCard
          title="Documents Uploaded"
          value={uploadedDocuments.toString()}
          description="Total uploaded"
          icon={FileText}
          variant="info"
        />
        <MetricCard
          title="Verification Status"
          value={profileStatus ? normalizeVerificationStatus(profileStatus.verification_status) : "Not Started"}
          description="Current stage"
          icon={Shield}
          variant={profileStatus?.verification_status === 'VERIFIED' ? "success" : "warning"}
        />
      </div>

      {/* Profile and Document Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </CardTitle>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion</span>
                <span>{profileCompletion}%</span>
              </div>
              <Progress value={profileCompletion} className="h-2" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {employeeProfile ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Name</p>
                      <p>{employeeProfile.first_name} {employeeProfile.last_name}</p>
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p>{employeeProfile.email}</p>
                    </div>
                    <div>
                      <p className="font-medium">Phone</p>
                      <p>{employeeProfile.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="font-medium">Department</p>
                      <p>{employeeProfile.department || 'Not assigned'}</p>
                    </div>
                  </div>
                </div>
                <Button onClick={navigateToProfileCompletion} className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Profile not submitted yet</p>
                <Button onClick={navigateToProfileCompletion} className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Complete Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-info" />
              Document Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Required Documents */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-destructive">Required Documents</h4>
              {requiredDocuments.map((docType) => {
                const uploaded = documents.find(doc => doc.document_type === docType.type);
                return (
                  <div key={docType.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{docType.label}</p>
                      {uploaded ? (
                        <>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            📄 {uploaded.file_name}
                          </p>
                          <p className="text-xs text-success">
                            ✅ Uploaded {new Date(uploaded.uploaded_at).toLocaleDateString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-destructive">Required - Not uploaded</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {uploaded ? (
                        <>
                          <Badge 
                            variant={uploaded.review_status === 'APPROVED' ? "default" : uploaded.review_status === 'REQUIRES_REPLACEMENT' ? "destructive" : "secondary"}
                          >
                            {uploaded.review_status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(uploaded.id, uploaded.file_name)}>
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteDocument(uploaded.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => handleDocumentUpload(e, docType.uploadKey || docType.type)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={uploadingDocument}
                          />
                          <Button size="sm" variant="outline" disabled={uploadingDocument}>
                            <Upload className="w-3 h-3 mr-1" />
                            Upload
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional Documents */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Optional Documents</h4>
              {optionalDocuments.map((docType) => {
                const uploaded = documents.find(doc => doc.document_type === docType.type);
                return (
                  <div key={docType.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{docType.label}</p>
                      {uploaded ? (
                        <>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            📄 {uploaded.file_name}
                          </p>
                          <p className="text-xs text-success">
                            ✅ Uploaded {new Date(uploaded.uploaded_at).toLocaleDateString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Optional - Not uploaded</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {uploaded ? (
                        <>
                          <Badge 
                            variant={uploaded.review_status === 'APPROVED' ? "default" : uploaded.review_status === 'REQUIRES_REPLACEMENT' ? "destructive" : "secondary"}
                          >
                            {uploaded.review_status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(uploaded.id, uploaded.file_name)}>
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteDocument(uploaded.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => handleDocumentUpload(e, docType.uploadKey || docType.type)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={uploadingDocument}
                          />
                          <Button size="sm" variant="outline" disabled={uploadingDocument}>
                            <Upload className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status and Help Section */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success" />
                <span>Account Created</span>
              </div>
              <div className={`flex items-center gap-2 text-sm ${employeeProfile ? 'text-success' : 'text-muted-foreground'}`}>
                {employeeProfile ? <CheckCircle className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
                <span>Profile Submitted</span>
              </div>
              <div className={`flex items-center gap-2 text-sm ${requiredUploaded === requiredDocuments.length ? 'text-success' : 'text-muted-foreground'}`}>
                {requiredUploaded === requiredDocuments.length ? <CheckCircle className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
                <span>Documents Uploaded</span>
              </div>
              <div className={`flex items-center gap-2 text-sm ${profileStatus?.verification_status === 'VERIFIED' ? 'text-success' : 'text-muted-foreground'}`}>
                {profileStatus?.verification_status === 'VERIFIED' ? <CheckCircle className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
                <span>Verification Complete</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-warning" />
              Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileStatus ? (
              <div className="space-y-3">
                <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <Clock className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="font-medium text-sm">{normalizeVerificationStatus(profileStatus.verification_status)}</p>
                  {profileStatus.submitted_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(profileStatus.submitted_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {profileStatus.rejection_reason && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Rejection Reason:</strong> {profileStatus.rejection_reason}
                    </AlertDescription>
                  </Alert>
                )}
                {profileStatus.can_resubmit && (
                  <Button onClick={navigateToProfileCompletion} variant="outline" className="w-full">
                    Resubmit Profile
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground">No profile submitted yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-info" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded bg-info/10">
                <p className="font-medium">📋 Complete profile first</p>
                <p className="text-xs text-muted-foreground">Fill all required information</p>
              </div>
              <div className="p-2 rounded bg-success/10">
                <p className="font-medium">📄 Upload clear documents</p>
                <p className="text-xs text-muted-foreground">Ensure all text is readable</p>
              </div>
              <div className="p-2 rounded bg-warning/10">
                <p className="font-medium">💬 Need help? Contact HR</p>
                <p className="text-xs text-muted-foreground">We're here to support you</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}