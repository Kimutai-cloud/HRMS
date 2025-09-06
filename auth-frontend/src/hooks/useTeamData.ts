import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeService from '@/services/employeeService';
import { type EmployeeData } from '@/types/auth';

export interface TeamData {
  members: EmployeeData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useTeamData = (): TeamData => {
  const { user, userProfile, isManager, accessToken } = useAuth();
  const [members, setMembers] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const employeeService = new EmployeeService();

  const fetchTeamData = async () => {
    if (!user || !userProfile || !isManager || !accessToken) return;

    try {
      setLoading(true);
      setError(null);

      // Set access token before making API call
      employeeService.setAccessToken(accessToken);
      
      // Fetch team members for this manager
      const teamMembers = await employeeService.getTeamMembers(user.id);
      setMembers(teamMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team data');
      console.error('Team data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [user, userProfile, isManager, accessToken]);

  return {
    members,
    loading,
    error,
    refresh: fetchTeamData,
  };
};

export default useTeamData;