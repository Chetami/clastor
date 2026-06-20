import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Payments() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          View and manage your payments here.
        </p>
      </CardContent>
    </Card>
  );
}
