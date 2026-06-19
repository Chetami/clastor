import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@/features/auth/api";

export default function Dashboard() {
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-lg font-semibold">Examify TMS</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email} ({user?.role})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
      </main>
    </div>
  );
}
