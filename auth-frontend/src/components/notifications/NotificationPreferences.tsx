import React, { useState } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  Users,
  FileText,
  Shield,
  Settings,
  Smartphone,
  Monitor,
  Volume2,
  VolumeX,
  Save,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NotificationSetting {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'team' | 'system' | 'personal';
  icon: any;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  enabled: boolean;
}

interface NotificationPreferencesProps {
  className?: string;
}

const defaultNotificationSettings: NotificationSetting[] = [
  {
    id: 'profile-updates',
    name: 'Profile Updates',
    description: 'Updates to your employee profile or verification status',
    category: 'personal',
    icon: Users,
    channels: { inApp: true, email: true, push: false },
    frequency: 'immediate',
    enabled: true
  },
  {
    id: 'document-status',
    name: 'Document Status',
    description: 'Updates on document approval or rejection',
    category: 'personal',
    icon: FileText,
    channels: { inApp: true, email: true, push: true },
    frequency: 'immediate',
    enabled: true
  },
  {
    id: 'team-updates',
    name: 'Team Updates',
    description: 'New team members, role changes, and team announcements',
    category: 'team',
    icon: Users,
    channels: { inApp: true, email: false, push: false },
    frequency: 'daily',
    enabled: true
  },
  {
    id: 'meeting-reminders',
    name: 'Meeting Reminders',
    description: 'Upcoming meetings and calendar events',
    category: 'personal',
    icon: Calendar,
    channels: { inApp: true, email: true, push: true },
    frequency: 'immediate',
    enabled: true
  },
  {
    id: 'security-alerts',
    name: 'Security Alerts',
    description: 'Login attempts, password changes, and security updates',
    category: 'security',
    icon: Shield,
    channels: { inApp: true, email: true, push: true },
    frequency: 'immediate',
    enabled: true
  },
  {
    id: 'system-maintenance',
    name: 'System Maintenance',
    description: 'Scheduled maintenance and system updates',
    category: 'system',
    icon: Settings,
    channels: { inApp: true, email: false, push: false },
    frequency: 'immediate',
    enabled: false
  },
  {
    id: 'messages',
    name: 'Direct Messages',
    description: 'Messages from colleagues and managers',
    category: 'team',
    icon: MessageSquare,
    channels: { inApp: true, email: false, push: true },
    frequency: 'immediate',
    enabled: true
  }
];

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ className }) => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultNotificationSettings);
  const [globalSettings, setGlobalSettings] = useState({
    doNotDisturb: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    sound: true,
    desktop: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const updateSetting = (id: string, updates: Partial<NotificationSetting>) => {
    setSettings(prev => prev.map(setting => 
      setting.id === id ? { ...setting, ...updates } : setting
    ));
  };

  const updateChannel = (id: string, channel: keyof NotificationSetting['channels'], value: boolean) => {
    setSettings(prev => prev.map(setting => 
      setting.id === id 
        ? { ...setting, channels: { ...setting.channels, [channel]: value } }
        : setting
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Preferences Saved',
        description: 'Your notification preferences have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save notification preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultNotificationSettings);
    setGlobalSettings({
      doNotDisturb: false,
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      sound: true,
      desktop: true
    });
    
    toast({
      title: 'Preferences Reset',
      description: 'All notification preferences have been reset to defaults.',
    });
  };

  const categorizedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, NotificationSetting[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return Shield;
      case 'team': return Users;
      case 'system': return Settings;
      case 'personal': return Bell;
      default: return Bell;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security': return 'text-red-600 bg-red-50 border-red-200';
      case 'team': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'system': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'personal': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notification Preferences</h1>
          <p className="text-muted-foreground">
            Customize how and when you receive notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="global">Global Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          {Object.entries(categorizedSettings).map(([category, categorySettings]) => {
            const CategoryIcon = getCategoryIcon(category);
            
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className={`p-1 rounded-full border ${getCategoryColor(category)}`}>
                      <CategoryIcon className="w-4 h-4" />
                    </div>
                    {category.charAt(0).toUpperCase() + category.slice(1)} Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categorySettings.map((setting) => (
                    <div key={setting.id} className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <setting.icon className="w-5 h-5 text-muted-foreground mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{setting.name}</h3>
                              {setting.category === 'security' && (
                                <Badge variant="secondary" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {setting.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={setting.enabled}
                          onCheckedChange={(enabled) => updateSetting(setting.id, { enabled })}
                          disabled={setting.category === 'security'}
                        />
                      </div>

                      {setting.enabled && (
                        <div className="ml-8 space-y-3">
                          {/* Delivery Channels */}
                          <div>
                            <Label className="text-sm font-medium">Delivery Methods</Label>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`${setting.id}-inapp`}
                                  checked={setting.channels.inApp}
                                  onCheckedChange={(value) => updateChannel(setting.id, 'inApp', value)}
                                />
                                <Label htmlFor={`${setting.id}-inapp`} className="text-sm flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  In-App
                                </Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`${setting.id}-email`}
                                  checked={setting.channels.email}
                                  onCheckedChange={(value) => updateChannel(setting.id, 'email', value)}
                                />
                                <Label htmlFor={`${setting.id}-email`} className="text-sm flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  Email
                                </Label>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`${setting.id}-push`}
                                  checked={setting.channels.push}
                                  onCheckedChange={(value) => updateChannel(setting.id, 'push', value)}
                                />
                                <Label htmlFor={`${setting.id}-push`} className="text-sm flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" />
                                  Push
                                </Label>
                              </div>
                            </div>
                          </div>

                          {/* Frequency */}
                          <div>
                            <Label className="text-sm font-medium">Frequency</Label>
                            <Select 
                              value={setting.frequency} 
                              onValueChange={(frequency: NotificationSetting['frequency']) => 
                                updateSetting(setting.id, { frequency })
                              }
                            >
                              <SelectTrigger className="w-32 mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="immediate">Immediate</SelectItem>
                                <SelectItem value="daily">Daily Digest</SelectItem>
                                <SelectItem value="weekly">Weekly Summary</SelectItem>
                                <SelectItem value="never">Never</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {setting !== categorySettings[categorySettings.length - 1] && <Separator />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="global" className="space-y-6">
          {/* Global Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Global Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Do Not Disturb */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Do Not Disturb</h3>
                  <p className="text-sm text-muted-foreground">
                    Temporarily pause all notifications
                  </p>
                </div>
                <Switch
                  checked={globalSettings.doNotDisturb}
                  onCheckedChange={(doNotDisturb) => 
                    setGlobalSettings(prev => ({ ...prev, doNotDisturb }))
                  }
                />
              </div>

              <Separator />

              {/* Quiet Hours */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">Quiet Hours</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically pause notifications during specific hours
                    </p>
                  </div>
                  <Switch
                    checked={globalSettings.quietHours.enabled}
                    onCheckedChange={(enabled) => 
                      setGlobalSettings(prev => ({ 
                        ...prev, 
                        quietHours: { ...prev.quietHours, enabled }
                      }))
                    }
                  />
                </div>

                {globalSettings.quietHours.enabled && (
                  <div className="flex items-center gap-4 ml-4">
                    <div>
                      <Label className="text-sm">From</Label>
                      <Select 
                        value={globalSettings.quietHours.start}
                        onValueChange={(start) => 
                          setGlobalSettings(prev => ({ 
                            ...prev, 
                            quietHours: { ...prev.quietHours, start }
                          }))
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0') + ':00';
                            return (
                              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">To</Label>
                      <Select 
                        value={globalSettings.quietHours.end}
                        onValueChange={(end) => 
                          setGlobalSettings(prev => ({ 
                            ...prev, 
                            quietHours: { ...prev.quietHours, end }
                          }))
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0') + ':00';
                            return (
                              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Sound Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {globalSettings.sound ? (
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-medium">Notification Sounds</h3>
                    <p className="text-sm text-muted-foreground">
                      Play sound for notifications
                    </p>
                  </div>
                </div>
                <Switch
                  checked={globalSettings.sound}
                  onCheckedChange={(sound) => 
                    setGlobalSettings(prev => ({ ...prev, sound }))
                  }
                />
              </div>

              <Separator />

              {/* Desktop Notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">Desktop Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Show system notifications on desktop
                    </p>
                  </div>
                </div>
                <Switch
                  checked={globalSettings.desktop}
                  onCheckedChange={(desktop) => 
                    setGlobalSettings(prev => ({ ...prev, desktop }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationPreferences;