import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Lessons() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lessons</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          View and manage your lessons here.
        </p>
      </CardContent>
    </Card>
  );
}
