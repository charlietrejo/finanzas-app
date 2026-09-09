import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-20 rounded-pill" />
          <Skeleton className="h-8 w-20 rounded-pill" />
          <Skeleton className="h-8 w-20 rounded-pill" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-36 rounded-pill" />
        <Skeleton className="h-11 w-36 rounded-pill" />
        <Skeleton className="h-11 w-36 rounded-pill" />
      </div>

      {[0, 1, 2].map((i) => (
        <section key={i}>
          <Skeleton className="mb-3 h-5 w-40" />
          <Card>
            <Skeleton className="h-[280px] w-full" />
          </Card>
        </section>
      ))}
    </div>
  );
}
