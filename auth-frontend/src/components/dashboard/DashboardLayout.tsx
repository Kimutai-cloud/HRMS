import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { NavigationGuard } from "../navigation/NavigationGuard";
import { VerificationStatusComponent } from "../routing/VerificationRedirect";
import { useAuth } from "@/contexts/AuthContext";
import { AccessLevel } from "@/types/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { accessLevel, userProfile } = useAuth();
  
  return (
    <NavigationGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardHeader />
            

            
            <div className="flex-1 p-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarProvider>
    </NavigationGuard>
  );
}