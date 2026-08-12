import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CardShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <Card className={cn("flex flex-col", className)}>{children}</Card>;
}

function HeaderSkeleton() {
  return (
    <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-28" />
    </CardHeader>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

export function NextLessonSkeleton() {
  return (
    <CardShell>
      <HeaderSkeleton />
      <CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>
    </CardShell>
  );
}

export function ChartSkeleton() {
  return (
    <CardShell>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </CardHeader>
      <CardContent className="flex-1 p-6 pt-0">
        <Skeleton className="h-[200px] w-full" />
      </CardContent>
    </CardShell>
  );
}

export function UpcomingLessonsSkeleton({ fill }: { fill?: boolean }) {
  return (
    <CardShell className={fill ? "min-h-0 flex-1" : undefined}>
      <HeaderSkeleton />
      <CardContent className={cn("flex-1 p-4 pt-0", fill && "flex min-h-0 flex-col")}>
        <ul className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i}>
              <RowSkeleton />
            </li>
          ))}
        </ul>
      </CardContent>
    </CardShell>
  );
}

export function TodoLessonsSkeleton() {
  return (
    <CardShell className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-8 rounded-full" />
      </CardHeader>
      <CardContent className="flex-1 p-6 pt-0">
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </li>
          ))}
        </ul>
      </CardContent>
    </CardShell>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] rounded-xl" />
      ))}
    </div>
  );
}
