import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Schedule() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          View and manage your schedule here.
        </p>
      </CardContent>
    </Card>
  );
}
