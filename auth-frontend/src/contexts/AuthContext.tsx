import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { 
  type AuthContextType, 
  type LoginCredentials, 
  type RegisterData, 
  type UserProfile,
  type EmployeeData,
  type MeResponse,
  type RoleAssignment,
  AccessLevel,
  RoleCode,
  VerificationStatus} from '../types/auth';
import { getDefaultDashboardRoute } from '../config/routes';
import AuthService from '../services/authService';
import EmployeeService from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { taskService } from '../services/serviceFactory';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(AccessLevel.PROFILE_COMPLETION);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start with true to show loading during initialization
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [api] = useState(() => new AuthService());
  const [employeeApi] = useState(() => new EmployeeService());

  // Helper functions for role checking
  const isAdmin = userProfile?.roles?.some(role => 
    role.role_code === RoleCode.ADMIN 
  ) || false;
  const isManager = userProfile?.roles?.some(role => 
    role.role_code === RoleCode.MANAGER 
  ) || false;
  const isEmployee = userProfile?.roles?.some(role => 
    role.role_code === RoleCode.EMPLOYEE 
  ) || false;
  const isNewcomer = userProfile?.roles?.some(role => 
    role.role_code === RoleCode.NEWCOMER 
  ) || false;

  const checkPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  // Helper function to convert RoleWithPermissions to RoleAssignment
  const convertRoleWithPermissions = (roleWithPermissions: any): RoleAssignment => {
    return {
      id: roleWithPermissions.id,
      role_id: roleWithPermissions.role_id,
      role_code: roleWithPermissions.role_code,
      role_name: roleWithPermissions.role_name,
      scope: typeof roleWithPermissions.scope === 'string' 
        ? JSON.parse(roleWithPermissions.scope || '{}') 
        : (roleWithPermissions.scope || {}),
      created_at: roleWithPermissions.created_at,
      assigned_by: roleWithPermissions.assigned_by,
      is_active: roleWithPermissions.is_active
    };
  };

  // Helper function to consistently determine access level - MATCHES BACKEND LOGIC
  const determineAccessLevel = (employee: any, roles: any[]): AccessLevel => {

    
    if (!employee) return AccessLevel.PROFILE_COMPLETION;
    
    const verificationStatus = employee.verification_status;
    const hasAdminRole = roles.some(r => r.role_code === 'ADMIN' && (r.is_active !== false));
    const hasManagerRole = roles.some(r => r.role_code === 'MANAGER' && (r.is_active !== false));
    

    
    // ✅ ADMIN EXCEPTION: Admin gets admin access regardless of verification status
    if (hasAdminRole) {

      return AccessLevel.ADMIN;  // Admin is the only role that bypasses verification
    }
    
    // For all other roles, verification status matters first
    if (verificationStatus === 'VERIFIED') {
      // Only verified users can use their assigned roles
      if (hasManagerRole) {

        return AccessLevel.MANAGER;
      } else {

        return AccessLevel.VERIFIED;  // Regular verified employee
      }
    } else if (verificationStatus === 'NOT_SUBMITTED' || verificationStatus === 'NOT_STARTED') {

      return AccessLevel.PROFILE_COMPLETION;  // Needs to submit profile
    } else {

      return AccessLevel.NEWCOMER;  // In verification process
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      // Use Employee Service /me/ endpoint to get updated profile data
      const { employeeService } = await import('../services/serviceFactory');
      const meResponse = await employeeService.get('/me/') as MeResponse;
      
      if (meResponse.employee) {
        const rawRoles = meResponse.roles || [];
        const roles = rawRoles.map(convertRoleWithPermissions);
        const accessLevel = determineAccessLevel(meResponse.employee, rawRoles);
        const allPermissions = rawRoles
          .filter(r => r.is_active)
          .map(r => r.permissions || [])
          .flat();
          
        setUserProfile({
          id: meResponse.user_id,
          email: meResponse.email,
          firstName: meResponse.employee?.first_name || '',
          lastName: meResponse.employee?.last_name || '',
          isEmailVerified: true,
          employee: meResponse.employee,
          roles: roles,
          access_level: accessLevel,
          verification_status: meResponse.employee?.verification_status || VerificationStatus.NOT_STARTED,
          permissions: allPermissions,
          employee_profile_status: meResponse.employee?.verification_status || 'NOT_STARTED'
        });
        setAccessLevel(accessLevel);
        setPermissions(allPermissions);
      } else {
        // Still no employee profile
        setUserProfile(null);
        setAccessLevel(AccessLevel.PROFILE_COMPLETION);
        setPermissions(['profile:complete', 'profile:write', 'documents:upload']);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const updateProfile = async (data: Partial<EmployeeData>): Promise<void> => {
    if (!user?.id) throw new Error('No user logged in');
    
    try {
      await employeeApi.updateEmployeeProfile(user.id, data);
      await refreshProfile();
    } catch (error) {
      throw error;
    }
  };


  // Initialize authentication state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we have stored tokens
        const storedToken = api.getAccessToken();
        
        if (storedToken) {

          setAccessToken(storedToken);
          employeeApi.setAccessToken(storedToken);
          departmentService.setAccessToken(storedToken);
          taskService.setAccessToken(storedToken);
          
          // Also set token for any global services that might exist
          try {
            const serviceFactory = await import('../services/serviceFactory');
            serviceFactory.setGlobalAccessToken(storedToken);

          } catch (error) {
            console.warn('Service factory not available or failed to set global token on restore:', error);
          }
          
          try {
            // Use Employee Service /me/ endpoint for validation instead of Auth Service
            // This avoids CORS issues and validates against the working service
            const { employeeService } = await import('../services/serviceFactory');
            employeeService.setAccessToken(storedToken);
            const meResponse = await employeeService.get('/me/') as MeResponse;
            
            // Set user data from Employee Service response
            setUser({
              id: meResponse.user_id,
              email: meResponse.email,
              firstName: meResponse.employee?.first_name || '',
              lastName: meResponse.employee?.last_name || '',
              isEmailVerified: true
            });
            
            if (meResponse.employee) {
              // Employee profile exists - determine access level using consistent logic
              const rawRoles = meResponse.roles || [];
              const roles = rawRoles.map(convertRoleWithPermissions);
              const accessLevel = determineAccessLevel(meResponse.employee, rawRoles);
              
              // Get all permissions from roles
              const allPermissions = rawRoles
                .filter(r => r.is_active)
                .map(r => r.permissions || [])
                .flat();
              
              setUserProfile({
                id: meResponse.user_id,
                email: meResponse.email,
                firstName: meResponse.employee?.first_name || '',
                lastName: meResponse.employee?.last_name || '',
                isEmailVerified: true,
                employee: meResponse.employee,
                roles: roles,
                access_level: accessLevel,
                verification_status: meResponse.employee?.verification_status || VerificationStatus.NOT_STARTED,
                permissions: allPermissions,
                employee_profile_status: meResponse.employee?.verification_status || 'NOT_STARTED'
              });
              
              setAccessLevel(accessLevel);
              setPermissions(allPermissions);
              
            } else {
              // No employee profile yet - needs profile completion
              setUserProfile(null);
              setAccessLevel(AccessLevel.PROFILE_COMPLETION);
              setPermissions(['profile:complete', 'profile:write', 'documents:upload']);
            }
            

          } catch (error) {
            console.error('❌ Token validation failed, clearing stored tokens:', error);
            // Clear invalid tokens
            api.clearTokens();
            employeeApi.setAccessToken(null);
            departmentService.setAccessToken(null);
            taskService.setAccessToken(null);
            setAccessToken(null);
            setUser(null);
            setUserProfile(null);
            setAccessLevel(AccessLevel.PROFILE_COMPLETION);
            setPermissions(['profile:complete', 'profile:write', 'documents:upload']);
            
            // Clear global tokens too
            try {
              const serviceFactory = await import('../services/serviceFactory');
              serviceFactory.setGlobalAccessToken(null);
            } catch (error) {
              console.warn('Failed to clear global tokens:', error);
            }
          }
        } else {

        }
        
        // Check for email verification token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const verificationToken = urlParams.get('token');
        const isVerificationPage = window.location.pathname === '/verify-email';
        
        if (verificationToken && isVerificationPage) {
          await handleEmailVerification(verificationToken);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const handleEmailVerification = async (token: string) => {
    setLoading(true);
    try {
      await api.verifyEmail(token);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      alert("Email verified successfully! You can now log in.");
    } catch (error) {
      alert("Email verification failed, Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const { user, tokens } = await api.login(credentials);
      setUser(user);
      setAccessToken(tokens.accessToken);
      
      // Set the access token for employee service
      employeeApi.setAccessToken(tokens.accessToken);
      departmentService.setAccessToken(tokens.accessToken);
      taskService.setAccessToken(tokens.accessToken);
      
      // Also set token for any global services that might exist
      try {
        // Import and set global token if service factory exists
        const serviceFactory = await import('../services/serviceFactory');
        serviceFactory.setGlobalAccessToken(tokens.accessToken);

      } catch (error) {
        console.warn('Service factory not available or failed to set global token:', error);
      }
      
      // Fetch employee profile and permissions using /me/ endpoint
      try {
        const { employeeService } = await import('../services/serviceFactory');
        employeeService.setAccessToken(tokens.accessToken);
        const meResponse = await employeeService.get('/me/') as MeResponse;
        
        if (meResponse.employee) {

          
          const rawRoles = meResponse.roles || [];
          const roles = rawRoles.map(convertRoleWithPermissions);
          const accessLevel = determineAccessLevel(meResponse.employee, rawRoles);
          const allPermissions = rawRoles
            .filter(r => r.is_active)
            .map(r => r.permissions || [])
            .flat();
            

          
          setUserProfile({
            id: meResponse.user_id,
            email: meResponse.email,
            firstName: meResponse.employee?.first_name || '',
            lastName: meResponse.employee?.last_name || '',
            isEmailVerified: true,
            employee: meResponse.employee,
            roles: roles,
            access_level: accessLevel,
            verification_status: meResponse.employee?.verification_status || VerificationStatus.NOT_STARTED,
            permissions: allPermissions,
            employee_profile_status: meResponse.employee?.verification_status || 'NOT_STARTED'
          });
          setAccessLevel(accessLevel);
          setPermissions(allPermissions);

        } else {
          setUserProfile(null);
          setAccessLevel(AccessLevel.PROFILE_COMPLETION);
          setPermissions(['profile:complete', 'profile:write', 'documents:upload']);

        }
      } catch (profileError) {
        console.error('Failed to fetch user profile:', profileError);
        // If backend is unreachable, set fallback state
        setUserProfile(null);
        setAccessLevel(AccessLevel.NEWCOMER);
        setPermissions(['profile:complete', 'documents:upload']);
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const result = await api.register(data);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    setLoading(true);
    try {
      await api.verifyEmail(token);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    api.clearTokens();
    employeeApi.setAccessToken(null);
    departmentService.setAccessToken(null);
    taskService.setAccessToken(null);
    setUser(null);
    setUserProfile(null);
    setAccessToken(null);
    setAccessLevel(AccessLevel.PROFILE_COMPLETION);
    setPermissions(['profile:complete', 'profile:write', 'documents:upload']);
    
    // Clear global tokens too
    try {
      const serviceFactory = await import('../services/serviceFactory');
      serviceFactory.setGlobalAccessToken(null);

    } catch (error) {
      console.warn('Failed to clear global tokens on logout:', error);
    }
  };

  const refreshToken = async () => {
    try {
      const tokens = await api.refreshTokens();
      const user = await api.getCurrentUser();
      setUser(user);
      setAccessToken(tokens.accessToken);
      
      // Update employee service token and refresh profile
      employeeApi.setAccessToken(tokens.accessToken);
      departmentService.setAccessToken(tokens.accessToken);
      taskService.setAccessToken(tokens.accessToken);
      
      // Update global tokens
      try {
        const serviceFactory = await import('../services/serviceFactory');
        serviceFactory.setGlobalAccessToken(tokens.accessToken);

      } catch (error) {
        console.warn('Failed to set global tokens on refresh:', error);
      }
      
      await refreshProfile();
    } catch (error) {
      await logout();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        // Base auth functionality
        user,
        loading,
        accessToken,
        login,
        register,
        logout,
        refreshToken,
        verifyEmail,
        
        // HRMS enhanced functionality
        userProfile,
        accessLevel,
        permissions,
        isAdmin,
        isManager,
        isEmployee,
        isNewcomer,
        
        // Methods
        refreshProfile,
        checkPermission,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
