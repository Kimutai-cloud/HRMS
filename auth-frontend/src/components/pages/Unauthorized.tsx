import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardAccess } from '@/hooks/useAccessControl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Unauthorized() {
  const navigate = useNavigate();
  const { user, userProfile, accessLevel, isAdmin, isManager, isEmployee, isNewcomer } = useAuth();
  const { dashboardRoute } = useDashboardAccess();

  const getUserTypeMessage = () => {
    if (!userProfile) return "You are not logged in.";
    
    if (isAdmin) return "You have administrator access.";
    if (isManager) return "You have manager access.";
    if (isEmployee) return "You have employee access.";
    if (isNewcomer) return "You are a newcomer with limited access.";
    
    return "Your access level is being determined.";
  };

  const getAccessLevelMessage = () => {
    switch (accessLevel) {
      case 'PROFILE_COMPLETION':
        return "Please complete your profile to gain access to more features.";
      case 'NEWCOMER':
        return "Your profile is being reviewed. You have limited access while waiting for verification.";
      case 'VERIFIED':
        return "You have verified access to the system.";
      case 'ADMIN':
        return "You have full administrative access.";
      default:
        return "Your access level is being determined.";
    }
  };

  const getSuggestions = () => {
    const suggestions = [];
    
    if (!user) {
      suggestions.push({
        title: "Log In",
        description: "Please log in to access this feature",
        action: () => navigate('/login'),
        buttonText: "Go to Login"
      });
    } else if (accessLevel === 'PROFILE_COMPLETION') {
      suggestions.push({
        title: "Complete Your Profile",
        description: "You need to complete your profile before accessing this feature",
        action: () => navigate('/profile-completion'),
        buttonText: "Complete Profile"
      });
    } else {
      suggestions.push({
        title: "Go to Dashboard",
        description: "Return to your dashboard to access available features",
        action: () => navigate(dashboardRoute),
        buttonText: "Go to Dashboard"
      });
      
      suggestions.push({
        title: "View Profile",
        description: "Check your profile and permissions",
        action: () => navigate('/profile'),
        buttonText: "View Profile"
      });
      
      if (userProfile?.employee && userProfile.employee.profile_completion_percentage < 100) {
        suggestions.push({
          title: "Update Profile",
          description: "Complete your profile to unlock more features",
          action: () => navigate('/profile/edit'),
          buttonText: "Update Profile"
        });
      }
    }
    
    return suggestions;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="p-8 text-center">
          {/* Error Icon */}
          <div className="w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Main Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            You don't have permission to access this page or feature.
          </p>

          {/* User Status Information */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Current Status</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">User Type:</span>
                <span className="font-medium">{getUserTypeMessage()}</span>
              </div>
              
              {userProfile && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Access Level:</span>
                    <span className="font-medium capitalize">
                      {accessLevel.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Verification Status:</span>
                    <span className="font-medium capitalize">
                      {userProfile.verification_status.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  
                  {userProfile.employee && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profile Completion:</span>
                      <span className="font-medium">
                        {userProfile.employee.profile_completion_percentage}%
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {getAccessLevelMessage()}
              </p>
            </div>
          </div>

          {/* Suggestions */}
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              What can you do?
            </h3>
            
            <div className="space-y-4">
              {getSuggestions().map((suggestion, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                      <p className="text-sm text-gray-600">{suggestion.description}</p>
                    </div>
                    <Button
                      onClick={suggestion.action}
                      className="ml-4"
                    >
                      {suggestion.buttonText}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Need Help?</h4>
            <p className="text-sm text-gray-600 mb-3">
              If you believe you should have access to this feature, please contact your administrator or HR department.
            </p>
            <div className="flex space-x-2 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.href = 'mailto:support@company.com'}
              >
                Contact Support
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}