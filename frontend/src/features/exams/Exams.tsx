import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Exams() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exams</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Manage your exams here.
        </p>
      </CardContent>
    </Card>
  );
}
