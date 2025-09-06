import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  File,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  Download,
  Loader2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUploadDocument, useEmployeeDocuments } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { DocumentStatus } from '@/types/auth';

interface DocumentUploadProps {
  userId?: string;
  documentTypes?: string[];
  maxFileSize?: number; // in MB
  allowedFileTypes?: string[];
  className?: string;
}

const defaultDocumentTypes = [
  'government_id',
  'address_proof',
  'educational_certificates',
  'previous_employment',
  'medical_certificate',
  'tax_documents',
  'bank_statement',
  'other',
];

const documentTypeLabels = {
  government_id: 'Government ID',
  address_proof: 'Address Proof',
  educational_certificates: 'Educational Certificates',
  previous_employment: 'Previous Employment Documents',
  medical_certificate: 'Medical Certificate',
  tax_documents: 'Tax Documents',
  bank_statement: 'Bank Statement',
  other: 'Other Documents',
};

interface FileUpload {
  id: string;
  file: File;
  documentType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  userId,
  documentTypes = defaultDocumentTypes,
  maxFileSize = 10,
  allowedFileTypes = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
  className,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingUploads, setPendingUploads] = useState<FileUpload[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');

  const targetUserId = userId || user?.id;
  const { data: existingDocuments = [], refetch: refetchDocuments } = useEmployeeDocuments(targetUserId);
  const uploadDocumentMutation = useUploadDocument();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (!selectedDocumentType) {
        toast({
          title: 'Document Type Required',
          description: 'Please select a document type before uploading.',
          variant: 'destructive',
        });
        return;
      }

      // Handle rejected files
      rejectedFiles.forEach((rejection) => {
        const { file, errors } = rejection;
        const errorMessages = errors.map((e: any) => e.message).join(', ');
        toast({
          title: 'File Rejected',
          description: `${file.name}: ${errorMessages}`,
          variant: 'destructive',
        });
      });

      // Add accepted files to pending uploads
      const newUploads = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        documentType: selectedDocumentType,
        progress: 0,
        status: 'pending' as const,
      }));

      setPendingUploads((prev) => [...prev, ...newUploads]);
    },
    [selectedDocumentType, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: maxFileSize * 1024 * 1024,
    multiple: true,
  });

  const uploadFile = async (fileUpload: FileUpload) => {
    setPendingUploads((prev) =>
      prev.map((upload) =>
        upload.id === fileUpload.id
          ? { ...upload, status: 'uploading', progress: 0 }
          : upload
      )
    );

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setPendingUploads((prev) =>
          prev.map((upload) =>
            upload.id === fileUpload.id && upload.progress < 90
              ? { ...upload, progress: upload.progress + 10 }
              : upload
          )
        );
      }, 200);

      await uploadDocumentMutation.mutateAsync({
        documentType: fileUpload.documentType,
        file: fileUpload.file,
      });

      clearInterval(progressInterval);

      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.id === fileUpload.id
            ? { ...upload, status: 'success', progress: 100 }
            : upload
        )
      );

      toast({
        title: 'Upload Successful',
        description: `${fileUpload.file.name} has been uploaded successfully.`,
      });

      // Remove successful upload after a delay
      setTimeout(() => {
        setPendingUploads((prev) => prev.filter((upload) => upload.id !== fileUpload.id));
      }, 2000);

      // Refetch documents
      refetchDocuments();
    } catch (error) {
      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.id === fileUpload.id
            ? {
                ...upload,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : upload
        )
      );

      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    }
  };

  const removeUpload = (id: string) => {
    setPendingUploads((prev) => prev.filter((upload) => upload.id !== id));
  };

  const uploadAllPending = () => {
    pendingUploads
      .filter((upload) => upload.status === 'pending')
      .forEach((upload) => uploadFile(upload));
  };

  const getStatusIcon = (status: DocumentStatus['status'] | FileUpload['status']) => {
    switch (status) {
      case 'approved':
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'rejected':
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
          <CardDescription>
            Upload required documents for your profile verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {documentTypeLabels[type as keyof typeof documentTypeLabels] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-300 hover:border-gray-400'
                }
                ${!selectedDocumentType ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} disabled={!selectedDocumentType} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p>Drop the files here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium">
                    Drag & drop files here, or click to select
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Maximum file size: {maxFileSize}MB. Supported formats: {allowedFileTypes.join(', ').toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            {pendingUploads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Pending Uploads</h4>
                  <Button
                    size="sm"
                    onClick={uploadAllPending}
                    disabled={pendingUploads.every((upload) => upload.status !== 'pending')}
                  >
                    Upload All
                  </Button>
                </div>
                
                {pendingUploads.map((upload) => (
                  <div key={upload.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    {getStatusIcon(upload.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{upload.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {documentTypeLabels[upload.documentType as keyof typeof documentTypeLabels]} • {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {upload.status === 'uploading' && (
                        <Progress value={upload.progress} className="h-1 mt-1" />
                      )}
                      {upload.status === 'error' && upload.error && (
                        <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {upload.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => uploadFile(upload)}
                        >
                          Upload
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUpload(upload.id)}
                        disabled={upload.status === 'uploading'}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Existing Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>
            View and manage your uploaded documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingDocuments.length === 0 ? (
            <div className="text-center py-8">
              <File className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {existingDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.document_type}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded on {new Date(doc.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      doc.status === 'approved' ? 'default' :
                      doc.status === 'pending' ? 'secondary' :
                      'destructive'
                    }
                  >
                    {doc.status}
                  </Badge>
                  <div className="flex items-center space-x-1">
                    {doc.file_url && (
                      <>
                        <Button size="sm" variant="ghost">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUpload;