import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagerTaskDashboard as ManagerTaskDashboardComponent } from '@/components/tasks/ManagerTaskDashboard';
import { ROUTE_PATHS } from '@/config/routes';

/**
 * Manager Task Dashboard Page - Full page wrapper for manager task management
 */
const ManagerTaskDashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateTask = () => {
    navigate(ROUTE_PATHS.MANAGER_TASK_CREATE);
  };

  const handleViewTask = (taskId: string) => {
    navigate(ROUTE_PATHS.TASK_DETAILS.replace(':id', taskId));
  };

  const handleFilterChange = (filters: any) => {
    // Filter functionality is now handled within TaskListView component
    console.log('Filter changed:', filters);
  };

  return (
    <ManagerTaskDashboardComponent
      onCreateTask={handleCreateTask}
      onViewTask={handleViewTask}
      onFilterChange={handleFilterChange}
    />
  );
};

export default ManagerTaskDashboard;