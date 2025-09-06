import { Bell, Search, User, Settings, LogOut, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/useAccessControl";
import { ROUTE_PATHS } from "@/config/routes";
import { AccessLevel } from "@/types/auth";

export function DashboardHeader() {
  const navigate = useNavigate();
  const { user, userProfile, logout, accessLevel, isAdmin } = useAuth();
  const features = useFeatureAccess();

  const getUserDisplayName = () => {
    // Check userProfile directly (employee data is at root level after our context setup)
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    // Fallback to nested employee structure
    if (userProfile?.employee?.first_name && userProfile?.employee?.last_name) {
      return `${userProfile.employee.first_name} ${userProfile.employee.last_name}`;
    }
    // Fallback to user data
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return "User";
  };

  const getAccessLevelColor = () => {
    switch (accessLevel) {
      case AccessLevel.ADMIN: return "bg-green-500";
      case AccessLevel.VERIFIED: return "bg-blue-500";
      case AccessLevel.NEWCOMER: return "bg-yellow-500";
      case AccessLevel.PROFILE_COMPLETION: return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTE_PATHS.LOGIN);
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          
          {/* Search - only show for verified users */}
          {(accessLevel === AccessLevel.VERIFIED || accessLevel === AccessLevel.ADMIN) && (
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={
                  isAdmin 
                    ? "Search employees, documents, requests..."
                    : "Search documents, requests..."
                }
                className="pl-10 bg-background"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Access Level Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
            <div className={`w-2 h-2 rounded-full ${getAccessLevelColor()}`} />
            <span className="text-xs font-medium capitalize">
              {accessLevel.replace('_', ' ').toLowerCase()}
            </span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            {/* Show notification badge only for admin/manager */}
            {(isAdmin || features.canManageTeam) && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                2
              </Badge>
            )}
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getAccessLevelColor()}`}>
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:inline max-w-32 truncate">
                  {getUserDisplayName()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {features.canViewProfile && (
                <DropdownMenuItem onClick={() => navigate(ROUTE_PATHS.PROFILE)}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
              )}
              
              {features.canEditProfile && (
                <DropdownMenuItem onClick={() => navigate(ROUTE_PATHS.PROFILE_EDIT)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
              )}
              
              {features.canAccessAdminPanel && (
                <DropdownMenuItem onClick={() => navigate(ROUTE_PATHS.SYSTEM_SETTINGS)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>System Settings</span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={() => navigate('/help')}>
                <span>Help & Support</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}