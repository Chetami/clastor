import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Students() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Students</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Manage your students here.
        </p>
      </CardContent>
    </Card>
  );
}
