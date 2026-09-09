import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteLoading } from "@/components/ui/route-loading";

export default function DashboardLoading() {
  return (
    <RouteLoading
      skeleton={
        <div className="flex flex-col gap-8">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>

          <div className="flex flex-wrap gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="w-full max-w-sm">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-9 w-36" />
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-4 w-28" />
                  <Skeleton className="mt-3 h-6 w-24" />
                </Card>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
