import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccessLevel } from '@/types/auth';
import { ManagerTaskDashboard } from '@/components/tasks/ManagerTaskDashboard';
import { EmployeeTaskDashboard } from '@/components/tasks/EmployeeTaskDashboard';

/**
 * Smart Task Dashboard that routes users to appropriate task interface
 * based on their access level and roles
 */
const TaskDashboard: React.FC = () => {
  const { accessLevel, userProfile } = useAuth();

  // Route to appropriate task dashboard based on access level
  if (accessLevel === AccessLevel.ADMIN || accessLevel === AccessLevel.MANAGER) {
    return <ManagerTaskDashboard />;
  }

  return <EmployeeTaskDashboard />;
};

export default TaskDashboard;