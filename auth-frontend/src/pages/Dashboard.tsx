import { Users, FileCheck, Clock, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back, John!</h1>
        <p className="text-muted-foreground">Here's what's happening with your team today.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Employees"
          value="234"
          description="Active workforce"
          icon={Users}
          trend={{ value: 5, label: "from last month" }}
          variant="info"
        />
        <MetricCard
          title="Pending Requests"
          value="12"
          description="Awaiting approval"
          icon={Clock}
          trend={{ value: -15, label: "from yesterday" }}
          variant="warning"
        />
        <MetricCard
          title="Completed Tasks"
          value="89%"
          description="This month"
          icon={FileCheck}
          trend={{ value: 8, label: "vs last month" }}
          variant="success"
        />
        <MetricCard
          title="Performance Score"
          value="4.2"
          description="Team average"
          icon={TrendingUp}
          trend={{ value: 3, label: "improvement" }}
          variant="default"
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Sarah Wilson", type: "Leave Request", date: "Today", status: "urgent" },
              { name: "Mike Chen", type: "Expense Report", date: "Yesterday", status: "normal" },
              { name: "Emma Davis", type: "Time Off", date: "2 days ago", status: "normal" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.type}</p>
                </div>
                <div className="text-right">
                  <Badge variant={item.status === "urgent" ? "destructive" : "secondary"}>
                    {item.date}
                  </Badge>
                </div>
              </div>
            ))}
            <Button className="w-full mt-4" variant="outline">
              View All Approvals
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-info" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { event: "Team Meeting", time: "10:00 AM", date: "Today", participants: 8 },
              { event: "Performance Reviews", time: "2:00 PM", date: "Tomorrow", participants: 5 },
              { event: "All Hands", time: "9:00 AM", date: "Friday", participants: 234 },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium">{item.event}</p>
                  <p className="text-sm text-muted-foreground">{item.time} • {item.date}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">
                    {item.participants} people
                  </Badge>
                </div>
              </div>
            ))}
            <Button className="w-full mt-4" variant="outline">
              View Calendar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}