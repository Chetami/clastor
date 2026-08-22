import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, MapPin, Search } from "lucide-react";
import { usePublicTutors, getInitials } from "@examify-tms/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BrandMark } from "@/features/auth/BrandMark";
import { RatingStars } from "../templates/blocks/RatingStars";
import { SubjectChips } from "../templates/blocks/SubjectChips";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function TutorCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Public tutor directory — searchable cards of published profiles. Filters
 * run server-side (the API does in-memory matching over published
 * profiles); search is debounced to keep request volume sane.
 */
export default function TutorsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [maxRate, setMaxRate] = useState("");
  const [sort, setSort] = useState<"recent" | "rating">("recent");

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedMaxRate = useDebouncedValue(maxRate, 300);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Find a tutor | Clastor";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const query = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      online: onlineOnly || undefined,
      maxRate: debouncedMaxRate ? Number(debouncedMaxRate) : undefined,
      sort,
      limit: 48,
    }),
    [debouncedSearch, onlineOnly, debouncedMaxRate, sort],
  );

  const { data, isLoading, isFetching } = usePublicTutors(query);
  const tutors = data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4">
          <Link to="/tutors" className="flex items-center gap-2">
            <BrandMark size={28} />
          </Link>
          <Link
            to="/signup"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Are you a tutor?
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Find a tutor</h1>
          <p className="text-muted-foreground">
            Browse independent tutors for one-on-one lessons, online or in
            person.
          </p>
        </div>

        <form
          className="mt-6 grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tutor-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tutor-search"
                className="pl-9"
                placeholder="Name, subject or keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tutor-max-rate">Max rate / hr</Label>
            <Input
              id="tutor-max-rate"
              type="number"
              min="0"
              placeholder="Any"
              value={maxRate}
              onChange={(e) => setMaxRate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tutor-sort">Sort by</Label>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as "recent" | "rating")}
            >
              <SelectTrigger id="tutor-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Switch
              id="tutor-online"
              checked={onlineOnly}
              onCheckedChange={setOnlineOnly}
            />
            <Label htmlFor="tutor-online" className="font-normal">
              Online lessons only
            </Label>
          </div>
        </form>

        <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
          {isLoading
            ? "Searching…"
            : data
              ? `${data.total} ${data.total === 1 ? "tutor" : "tutors"} found`
              : ""}
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(isLoading || isFetching) &&
            tutors.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => <TutorCardSkeleton key={i} />)}

          {!isLoading &&
            tutors.length === 0 &&
            data != null && (
              <div className="rounded-xl border border-dashed p-10 text-center sm:col-span-2 lg:col-span-3">
                <p className="font-medium">No tutors match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try clearing the search or raising the max rate.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setOnlineOnly(false);
                    setMaxRate("");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}

          {tutors.map((tutor) => (
            <Link
              key={tutor.slug}
              to={`/t/${tutor.slug}`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  {tutor.avatarUrl && (
                    <AvatarImage src={tutor.avatarUrl} alt={tutor.name} />
                  )}
                  <AvatarFallback>
                    {getInitials(tutor.name) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:underline group-focus-visible:underline">
                    {tutor.name}
                  </p>
                  {tutor.headline && (
                    <p className="truncate text-sm text-muted-foreground">
                      {tutor.headline}
                    </p>
                  )}
                </div>
              </div>

              {(tutor.ratingAvg != null || tutor.hourlyRate != null) && (
                <div className="flex items-center justify-between gap-2">
                  <RatingStars
                    ratingAvg={tutor.ratingAvg}
                    reviewCount={tutor.reviewCount}
                  />
                  {tutor.hourlyRate != null && (
                    <span className="text-sm font-medium">
                      {tutor.currency} {tutor.hourlyRate.toFixed(0)}/hr
                    </span>
                  )}
                </div>
              )}

              {tutor.subjects.length > 0 && (
                <SubjectChips
                  subjects={tutor.subjects}
                  max={3}
                  chipClassName="border border-input bg-muted/40 text-xs"
                />
              )}

              {(tutor.location || tutor.teachesOnline) && (
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {tutor.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {tutor.location}
                    </span>
                  )}
                  {tutor.teachesOnline && (
                    <span className="inline-flex items-center gap-1">
                      <Globe className="size-3.5" />
                      Online
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Tutoring with Clastor?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
