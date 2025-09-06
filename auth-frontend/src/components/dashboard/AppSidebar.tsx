import { NavLink, useLocation } from "react-router-dom";
import {
  Users,
  BarChart3,
  FileText,
  Settings,
  User,
  Shield,
  Building2,
  ClipboardList,
  UserPlus,
  BookOpen,
  Activity,
  Home,
  CheckSquare,
  PlusSquare,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAccess } from "@/hooks/useAccessControl";
import { ROUTE_PATHS } from "@/config/routes";
import { AccessLevel } from "@/types/auth";

interface NavigationItem {
  title: string;
  url: string;
  icon: any;
  group?: string;
}

const getNavigationItems = (navigation: ReturnType<typeof useNavigationAccess>): NavigationItem[] => {
  const items: NavigationItem[] = [];

  // Always show dashboard and profile
  items.push(
    { title: "Dashboard", url: ROUTE_PATHS.DASHBOARD, icon: Home, group: "main" },
  );

  if (navigation.showProfile) {
    items.push(
      { title: "Profile", url: ROUTE_PATHS.PROFILE, icon: User, group: "main" }
    );
  }

  // Profile completion for newcomers
  if (navigation.showProfileCompletion) {
    items.push(
      { title: "Complete Profile", url: ROUTE_PATHS.PROFILE_COMPLETION, icon: UserPlus, group: "main" }
    );
  }

  // Onboarding for newcomers
  if (navigation.showOnboarding) {
    items.push(
      { title: "Onboarding", url: ROUTE_PATHS.NEWCOMER_DASHBOARD, icon: BookOpen, group: "main" }
    );
  }

  // Task Management - Show for all verified users
  if (navigation.showProfile) { // Using showProfile as proxy for verified user
    items.push(
      { title: "Tasks", url: ROUTE_PATHS.TASKS, icon: CheckSquare, group: "work" }
    );
  }

  // Documents
  if (navigation.showDocuments) {
    items.push(
      { title: "Documents", url: ROUTE_PATHS.DOCUMENTS, icon: FileText, group: "work" }
    );
  }

  // Employee features
  if (navigation.showPersonalDocuments) {
    items.push(
      { title: "Documents", url: ROUTE_PATHS.DOCUMENTS, icon: FileText, group: "work" }
    );
  }

  // Team management
  if (navigation.showTeam) {
    items.push(
      { title: "Team", url: ROUTE_PATHS.TEAM, icon: Users, group: "management" }
    );
  }

  if (navigation.showEmployees) {
    items.push(
      { title: "Employees", url: ROUTE_PATHS.EMPLOYEES, icon: Users, group: "management" }
    );
  }

  // Remove Manager Tools for admin users as it's duplicate of dashboard functionality
  // if (navigation.showManagerTools) {
  //   items.push(
  //     { title: "Manager Tools", url: ROUTE_PATHS.MANAGER_DASHBOARD, icon: ClipboardList, group: "management" }
  //   );
  // }

  // Manager Task Management
  if (navigation.showManagerTools) {
    items.push(
      { title: "Task Management", url: ROUTE_PATHS.MANAGER_TASKS, icon: ClipboardList, group: "management" },
      { title: "Create Task", url: ROUTE_PATHS.MANAGER_TASK_CREATE, icon: PlusSquare, group: "management" }
    );
  }

  // Manager departments
  if (navigation.showManagerDepartments) {
    items.push(
      { title: "My Departments", url: ROUTE_PATHS.MANAGER_DEPARTMENTS, icon: Building2, group: "management" }
    );
  }

  if (navigation.showApprovals) {
    items.push(
      { title: "Approvals", url: ROUTE_PATHS.DOCUMENT_REVIEW, icon: ClipboardList, group: "management" }
    );
  }

  // Admin features
  if (navigation.showAdminPanel) {
    items.push(
      { title: "Admin Panel", url: ROUTE_PATHS.ADMIN_PANEL, icon: Shield, group: "main" }
    );
  }

  if (navigation.showUserManagement) {
    items.push(
      { title: "User Management", url: ROUTE_PATHS.USER_MANAGEMENT, icon: Shield, group: "admin" }
    );
  }

  if (navigation.showSystemSettings) {
    items.push(
      { title: "System Settings", url: ROUTE_PATHS.SYSTEM_SETTINGS, icon: Settings, group: "admin" }
    );
  }

  if (navigation.showDepartments) {
    items.push(
      { title: "Departments", url: ROUTE_PATHS.DEPARTMENTS, icon: Building2, group: "admin" }
    );
  }

  if (navigation.showReports) {
    items.push(
      { title: "Reports", url: ROUTE_PATHS.REPORTS, icon: BarChart3, group: "admin" }
    );
  }

  if (navigation.showAuditLogs) {
    items.push(
      { title: "Audit Logs", url: ROUTE_PATHS.AUDIT_LOGS, icon: Activity, group: "admin" }
    );
  }

  return items;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { accessLevel, userProfile } = useAuth();
  const navigation = useNavigationAccess();
  
  const currentPath = location.pathname;
  const navigationItems = getNavigationItems(navigation);
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === ROUTE_PATHS.DASHBOARD) return currentPath === ROUTE_PATHS.DASHBOARD;
    return currentPath.startsWith(path);
  };

  // Group navigation items
  const groupedItems = navigationItems.reduce((acc, item) => {
    const group = item.group || 'main';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  const getGroupLabel = (group: string) => {
    switch (group) {
      case 'main': return 'Main';
      case 'work': return 'Work';
      case 'management': return 'Management';
      case 'admin': return 'Administration';
      default: return 'Other';
    }
  };

  return (
    <Sidebar collapsible="none">
      <SidebarContent className="bg-card border-r border-border">
        {/* Company Logo/Title */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-semibold text-lg text-foreground">HRMS</h1>
                {userProfile && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {accessLevel.replace('_', ' ').toLowerCase()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        {Object.entries(groupedItems).map(([group, items]) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{getGroupLabel(group)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* User Status Indicator */}
        {!isCollapsed && userProfile && (
          <div className="mt-auto p-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                accessLevel === AccessLevel.ADMIN ? 'bg-green-500' :
                accessLevel === AccessLevel.VERIFIED ? 'bg-blue-500' :
                accessLevel === AccessLevel.NEWCOMER ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-muted-foreground">
                {userProfile.employee?.first_name || 'User'}
              </span>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}