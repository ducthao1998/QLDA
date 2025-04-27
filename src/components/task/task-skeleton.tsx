import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function TasksSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-8 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}