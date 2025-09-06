import React, { useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccessLevel, VerificationStatus } from '@/types/auth';
import { ROUTE_PATHS } from '@/config/routes';

/**
 * Verification-based redirect component
 * Redirects users based on their verification status and profile completion
 */
export function VerificationRedirect() {
  const { user, userProfile, accessLevel, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user || !userProfile) return;

    const currentPath = location.pathname;
    const redirectPath = getRedirectPath(userProfile.verification_status, accessLevel, userProfile.employee_profile_status);

    // Only redirect if current path is not the target path
    if (redirectPath && currentPath !== redirectPath) {
      navigate(redirectPath, { 
        replace: true,
        state: { from: location }
      });
    }
  }, [user, userProfile, accessLevel, loading, location, navigate]);

  return null; // This component doesn't render anything
}

/**
 * Get redirect path based on verification status
 */
function getRedirectPath(
  verificationStatus: VerificationStatus,
  accessLevel: AccessLevel,
  profileStatus: string
): string | null {
  // Profile completion needed
  if (accessLevel === AccessLevel.PROFILE_COMPLETION || profileStatus === 'NOT_CREATED' || profileStatus === 'INCOMPLETE') {
    return ROUTE_PATHS.PROFILE_COMPLETION;
  }

  // Handle different verification statuses
  switch (verificationStatus) {
    case VerificationStatus.NOT_STARTED:
      // Profile is complete but verification not started
      if (profileStatus === 'READY_FOR_VERIFICATION') {
        return ROUTE_PATHS.NEWCOMER_DASHBOARD;
      }
      return ROUTE_PATHS.PROFILE_COMPLETION;

    case VerificationStatus.PENDING_DETAILS_REVIEW:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
    case VerificationStatus.PENDING_DOCUMENTS_REVIEW:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
    case VerificationStatus.PENDING_ROLE_ASSIGNMENT:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
    case VerificationStatus.PENDING_FINAL_APPROVAL:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;

    case VerificationStatus.VERIFIED:
      // User is verified, let normal routing take over
      return null;

    case VerificationStatus.REJECTED:
      return ROUTE_PATHS.PROFILE_COMPLETION; // Allow them to resubmit

    default:
      return ROUTE_PATHS.PROFILE_COMPLETION;
  }
}

/**
 * Hook for verification-based routing logic
 */
export function useVerificationRouting() {
  const { userProfile, accessLevel } = useAuth();

  const getVerificationStatus = () => {
    if (!userProfile) return null;
    return userProfile.verification_status;
  };

  const getProfileCompletionStatus = () => {
    if (!userProfile) return 0;
    return userProfile.employee?.profile_completion_percentage || 0;
  };

  const needsProfileCompletion = () => {
    return accessLevel === AccessLevel.PROFILE_COMPLETION || 
           getProfileCompletionStatus() < 100;
  };

  const isVerificationPending = () => {
    const status = getVerificationStatus();
    return status === VerificationStatus.PENDING_DETAILS_REVIEW ||
           status === VerificationStatus.PENDING_DOCUMENTS_REVIEW ||
           status === VerificationStatus.PENDING_ROLE_ASSIGNMENT ||
           status === VerificationStatus.PENDING_FINAL_APPROVAL;
  };

  const isVerified = () => {
    return getVerificationStatus() === VerificationStatus.VERIFIED;
  };

  const isRejected = () => {
    return getVerificationStatus() === VerificationStatus.REJECTED;
  };

  const canAccessVerifiedRoutes = () => {
    return isVerified() && accessLevel !== AccessLevel.PROFILE_COMPLETION;
  };

  const getNextStep = () => {
    if (needsProfileCompletion()) {
      return {
        route: ROUTE_PATHS.PROFILE_COMPLETION,
        message: 'Please complete your profile to continue.',
        action: 'Complete Profile'
      };
    }

    if (isRejected()) {
      return {
        route: ROUTE_PATHS.PROFILE_COMPLETION,
        message: 'Your profile was rejected. Please review and resubmit.',
        action: 'Review Profile'
      };
    }

    if (isVerificationPending()) {
      return {
        route: ROUTE_PATHS.NEWCOMER_DASHBOARD,
        message: 'Your profile is being reviewed. You have limited access.',
        action: 'View Status'
      };
    }

    if (isVerified()) {
      return {
        route: ROUTE_PATHS.DASHBOARD,
        message: 'Welcome! You have full access to the system.',
        action: 'Go to Dashboard'
      };
    }

    return {
      route: ROUTE_PATHS.PROFILE_COMPLETION,
      message: 'Please complete your profile to get started.',
      action: 'Get Started'
    };
  };

  const getAllowedRoutes = () => {
    const baseRoutes = [ROUTE_PATHS.PROFILE];

    if (needsProfileCompletion()) {
      return [
        ...baseRoutes,
        ROUTE_PATHS.PROFILE_COMPLETION,
        ROUTE_PATHS.PROFILE_EDIT,
      ];
    }

    if (isVerificationPending() || isRejected()) {
      return [
        ...baseRoutes,
        ROUTE_PATHS.NEWCOMER_DASHBOARD,
        ROUTE_PATHS.DOCUMENTS,
        ROUTE_PATHS.DOCUMENT_UPLOAD,
        ROUTE_PATHS.PROFILE_EDIT,
      ];
    }

    if (isVerified()) {
      return []; // All routes allowed, will be handled by role-based routing
    }

    return baseRoutes;
  };

  return {
    verificationStatus: getVerificationStatus(),
    profileCompletionPercentage: getProfileCompletionStatus(),
    needsProfileCompletion: needsProfileCompletion(),
    isVerificationPending: isVerificationPending(),
    isVerified: isVerified(),
    isRejected: isRejected(),
    canAccessVerifiedRoutes: canAccessVerifiedRoutes(),
    nextStep: getNextStep(),
    allowedRoutes: getAllowedRoutes(),
  };
}

/**
 * Component that shows verification status and next steps
 */
interface VerificationStatusProps {
  showNextStep?: boolean;
  showProgress?: boolean;
  className?: string;
}

  export function VerificationStatusComponent({ 
    showNextStep = true, 
    showProgress = true,
    className = "" 
  }: VerificationStatusProps) {
    const routing = useVerificationRouting();
    const navigate = useNavigate();

    if (!routing.verificationStatus) {
      return null;
    }

  const getStatusColor = () => {
    switch (routing.verificationStatus) {
      case VerificationStatus.VERIFIED:
        return "text-green-600 bg-green-50";

      case VerificationStatus.PENDING_DETAILS_REVIEW:
      case VerificationStatus.PENDING_DOCUMENTS_REVIEW:
      case VerificationStatus.PENDING_ROLE_ASSIGNMENT:
      case VerificationStatus.PENDING_FINAL_APPROVAL:
        return "text-yellow-600 bg-yellow-50";

      case VerificationStatus.REJECTED:
        return "text-red-600 bg-red-50";

      default:
        return "text-blue-600 bg-blue-50";
    }
  };


  const getStatusIcon = () => {
    switch (routing.verificationStatus) {
      case VerificationStatus.VERIFIED:
        return "✅";

      case VerificationStatus.PENDING_DETAILS_REVIEW:
      case VerificationStatus.PENDING_DOCUMENTS_REVIEW:
      case VerificationStatus.PENDING_ROLE_ASSIGNMENT:
      case VerificationStatus.PENDING_FINAL_APPROVAL:
        return "⏳";

      case VerificationStatus.REJECTED:
        return "❌";

      default:
        return "📝";
    }
  };


  return (
    <div className={`p-4 rounded-lg ${getStatusColor()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{getStatusIcon()}</span>
          <div>
            <h3 className="font-semibold">
              {routing.verificationStatus.replace('_', ' ').toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              }
            </h3>
            <p className="text-sm opacity-90">
              {routing.nextStep.message}
            </p>
          </div>
        </div>

        {showNextStep && (
          <button
            onClick={() => navigate(routing.nextStep.route)}
            className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
          >
            {routing.nextStep.action}
          </button>
        )}
      </div>

      {showProgress && routing.needsProfileCompletion && (
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Profile Completion</span>
            <span>{routing.profileCompletionPercentage}%</span>
          </div>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${routing.profileCompletionPercentage}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Route guard based on verification status
 */
interface VerificationGuardProps {
  children: React.ReactNode;
  allowedStatuses?: VerificationStatus[];
  redirectOnFail?: string;
}

export function VerificationGuard({
  children,
  allowedStatuses = [],
  redirectOnFail
}: VerificationGuardProps) {
  const { userProfile } = useAuth();
  const routing = useVerificationRouting();

  if (!userProfile || !routing.verificationStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if current verification status is allowed
  if (allowedStatuses.length > 0 && !allowedStatuses.includes(routing.verificationStatus)) {
    const redirectPath = redirectOnFail || routing.nextStep.route;
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

export { VerificationStatus };
