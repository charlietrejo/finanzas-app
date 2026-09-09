import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteLoading } from "@/components/ui/route-loading";

export default function AccountsLoading() {
  return (
    <RouteLoading
      skeleton={
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-11 w-36 rounded-pill" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-7 w-7 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-7 w-32" />
              </Card>
            ))}
          </div>
        </div>
      }
    />
  );
}
