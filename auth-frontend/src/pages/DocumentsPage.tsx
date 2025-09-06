import React from 'react';
import DocumentUpload from '@/components/forms/DocumentUpload';
import { useAuth } from '@/contexts/AuthContext';

const DocumentsPage: React.FC = () => {
  const { user, userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage your employment documents
        </p>
      </div>

      <DocumentUpload 
        userId={user?.id}
        className="w-full"
      />
    </div>
  );
};

export default DocumentsPage;