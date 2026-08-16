import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Shared skeleton building blocks for page-level loading states. Pages compose
 * these to mirror their resolved layout (tab bars, bordered tables, avatar
 * list rows, timelines, detail grids) so first paint matches final paint.
 */

/** One column of a {@link SkeletonTable}: `w` sizes the inner skeleton line,
 * `cell` carries th/td classes (e.g. responsive `hidden md:table-cell`). */
export type SkeletonColumn = string | { w: string; cell?: string };

function columnW(col: SkeletonColumn) {
  return typeof col === "string" ? col : col.w;
}

function columnCell(col: SkeletonColumn) {
  return typeof col === "string" ? undefined : col.cell;
}

/** Pill-group skeleton matching the rounded tab-filter bars on list pages. */
export function SkeletonTabGroup({
  widths = ["w-14", "w-12", "w-12"],
  className,
}: {
  widths?: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit items-center gap-1 rounded-md border bg-muted/40 p-1",
        className,
      )}
    >
      {widths.map((w, i) => (
        <Skeleton key={i} className={cn("h-4 rounded-sm", w)} />
      ))}
    </div>
  );
}

/**
 * Bordered table skeleton — muted header row + body rows, one entry per
 * column. `firstCellAvatar` renders the first cell as an avatar circle with
 * two text lines (tutor/user tables).
 */
export function SkeletonTable({
  columns,
  rows = 8,
  firstCellAvatar = false,
  className,
}: {
  columns: SkeletonColumn[];
  rows?: number;
  firstCellAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                className={cn(i === 0 && "pl-4", columnCell(col))}
              >
                <Skeleton className={cn("h-3.5", columnW(col))} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {columns.map((col, i) => (
                <TableCell
                  key={i}
                  className={cn(i === 0 && "pl-4", columnCell(col))}
                >
                  {i === 0 && firstCellAvatar ? (
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-40" />
                      </div>
                    </div>
                  ) : (
                    <Skeleton className={cn("h-3.5", columnW(col))} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * divide-y list rows with a leading avatar circle (students / lessons lists).
 * Bleeds to the card edges (-mx-6 px-6) like the real list rows rendered
 * inside a CardContent.
 */
export function SkeletonAvatarList({
  rows = 6,
  avatarClass = "size-10",
  trailingWidth = "w-24",
  withIndex = false,
}: {
  rows?: number;
  avatarClass?: string;
  /** Width of the right-aligned trailing cell (amount, badge...). */
  trailingWidth?: string;
  /** Leading rank-number column (leaderboard-style lists). */
  withIndex?: boolean;
}) {
  return (
    <ul className="-mx-6 divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-6 py-3">
          {withIndex && <Skeleton className="h-4 w-4" />}
          <Skeleton className={cn("shrink-0 rounded-full", avatarClass)} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-44" />
          </div>
          <Skeleton className={cn("h-4", trailingWidth)} />
        </li>
      ))}
    </ul>
  );
}

/** Vertical timeline rows — dot + two lines (invoice activity / email history). */
export function SkeletonTimeline({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card shell with a title skeleton and text-line skeletons (last one short). */
export function SkeletonCard({
  titleWidth = "w-24",
  lines = 3,
  className,
  contentClassName,
}: {
  titleWidth?: string;
  lines?: number;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className={cn("h-5", titleWidth)} />
      </CardHeader>
      <CardContent className={cn("space-y-3", contentClassName)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** Detail-page header: back button + title/subtitle + action buttons. */
export function SkeletonPageHeader({
  actions = 2,
  className,
}: {
  /** Number of trailing action buttons (0 hides the cluster). */
  actions?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      )}
    </div>
  );
}
