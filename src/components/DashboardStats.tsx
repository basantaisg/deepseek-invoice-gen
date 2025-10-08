import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, DollarSign, CheckCircle, Clock } from "lucide-react";

export const DashboardStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    revenue: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase.from("invoices").select("*");

    if (data) {
      const total = data.length;
      const paid = data.filter((inv) => inv.status === "paid").length;
      const pending = data.filter((inv) => inv.status === "sent").length;
      const revenue = data
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + Number(inv.grand_total), 0);

      setStats({ total, paid, pending, revenue });
    }
  };

  const statCards = [
    {
      title: "Total Invoices",
      value: stats.total,
      icon: FileText,
      description: "All time",
    },
    {
      title: "Paid Invoices",
      value: stats.paid,
      icon: CheckCircle,
      description: "Completed",
    },
    {
      title: "Pending",
      value: stats.pending,
      icon: Clock,
      description: "Awaiting payment",
    },
    {
      title: "Total Revenue",
      value: `NPR ${stats.revenue.toLocaleString()}`,
      icon: DollarSign,
      description: "Paid invoices",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
