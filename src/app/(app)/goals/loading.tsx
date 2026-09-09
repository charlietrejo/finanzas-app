import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteLoading } from "@/components/ui/route-loading";

export default function GoalsLoading() {
  return (
    <RouteLoading
      skeleton={
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-11 w-32 rounded-pill" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-7 w-7 rounded-full" />
                  </div>
                </div>
                <div>
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="mt-2 h-4 w-36" />
                </div>
                <Skeleton className="h-10 w-28 rounded-pill" />
              </Card>
            ))}
          </div>
        </div>
      }
    />
  );
}
