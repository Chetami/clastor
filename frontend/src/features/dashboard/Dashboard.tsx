import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are logged in as{" "}
            <span className="font-medium text-foreground">{user?.role}</span>
          </p>
          <div className="rounded-md border bg-muted/50 p-4">
            <p className="mb-2 font-medium">User Information</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">UID:</span>{" "}
                {user?.uid}
              </li>
              <li>
                <span className="font-medium text-foreground">Email:</span>{" "}
                {user?.email}
              </li>
              <li>
                <span className="font-medium text-foreground">Role:</span>{" "}
                {user?.role}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
