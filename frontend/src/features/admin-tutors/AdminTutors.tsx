import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  Users,
} from "lucide-react";
import type { AdminTutorSummary } from "@examify-tms/interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useUserCurrency } from "@/lib/use-currency";
import { formatCurrency } from "@/features/dashboard/lib";
import { useListAdminTutors } from "./api";

type SortField = "name" | "studentCount" | "outstandingAmount" | "googleConnected" | "lastActive" | "createdAt";
type SortOrder = "asc" | "desc";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminTutors() {
  const currency = useUserCurrency();
  const { data: tutors = [], isLoading, error } = useListAdminTutors();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = tutors.filter((t) => {
      if (query.length === 0) return true;
      return (
        t.name.toLowerCase().includes(query) ||
        (t.email?.toLowerCase().includes(query) ?? false)
      );
    });

    const accessor = (t: AdminTutorSummary): string | number => {
      switch (sortField) {
        case "name":
          return t.name.toLowerCase();
        case "studentCount":
          return t.studentCount;
        case "outstandingAmount":
          return t.outstandingAmount;
        case "googleConnected":
          return t.googleConnected ? 1 : 0;
        case "lastActive":
          return t.lastActive ? new Date(t.lastActive).getTime() : 0;
        case "createdAt":
          return new Date(t.createdAt).getTime();
      }
    };

    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortOrder === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortOrder === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [tutors, search, sortField, sortOrder]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        {active ? (
          sortOrder === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading tutors…</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load tutors. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tutors…"
                className="pl-8"
              />
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "No tutors match your search."
                    : "No tutors have signed up yet."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4">
                        <SortHeader field="name" label="Tutor" />
                      </TableHead>
                      <TableHead>
                        <SortHeader field="studentCount" label="Students" />
                      </TableHead>
                      <TableHead>
                        <SortHeader field="outstandingAmount" label="Outstanding" />
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        <SortHeader field="googleConnected" label="Google" />
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        <SortHeader field="lastActive" label="Last active" />
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <SortHeader field="createdAt" label="Joined" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((t) => (
                      <TableRow key={t.tutorId}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              {t.avatarUrl && (
                                <AvatarImage src={t.avatarUrl} alt={t.name} />
                              )}
                              <AvatarFallback>
                                {initials(t.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{t.name}</span>
                              {t.email && (
                                <span className="text-xs text-muted-foreground">
                                  {t.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{t.studentCount}</TableCell>
                        <TableCell
                          className={
                            t.outstandingAmount > 0
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {formatCurrency(t.outstandingAmount, currency)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {t.googleConnected ? (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              <span>
                                Connected
                                {t.googleEmail ? (
                                  <span className="block text-xs text-muted-foreground">
                                    {t.googleEmail}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                              Not connected
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {formatDate(t.lastActive)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDate(t.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center text-xs text-muted-foreground">
              <span>
                {visible.length} {visible.length === 1 ? "tutor" : "tutors"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
