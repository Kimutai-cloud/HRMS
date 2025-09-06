import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Building, Calendar, Edit } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const employee = userProfile?.employee;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">
            View and manage your profile information
          </p>
        </div>
        <Button onClick={() => navigate('/profile/edit')}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="font-medium">
                {employee ? `${employee.first_name} ${employee.last_name}` : user?.firstName || 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {employee?.email || user?.email || 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone</label>
              <p className="font-medium">{employee?.phone_number || 'Not provided'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium  text-muted-foreground">Department</label>
              <p className="font-medium">{employee?.department || 'Not assigned'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Position</label>
              <p className="font-medium">{employee?.position || 'Not assigned'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
              <div>
                <Badge 
                  variant={employee?.verification_status === 'VERIFIED' ? 'default' : 'secondary'}
                  className={employee?.verification_status === 'VERIFIED' ? 'bg-green-100 text-green-800' : ''}
                >
                  {employee?.verification_status || 'PENDING'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Join Date</label>
              <p className="font-medium">
                {employee?.hire_date 
                  ? new Date(employee.hire_date).toLocaleDateString() 
                  : 'Not set'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Profile Completion</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${employee?.profile_completion_percentage || 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {employee?.profile_completion_percentage || 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Current Roles</label>
              <div className="flex flex-wrap gap-2">
                {userProfile?.roles?.length?(
                  userProfile.roles!.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.role_code}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">No roles assigned</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;