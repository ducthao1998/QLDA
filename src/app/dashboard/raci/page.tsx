import { Suspense } from "react"
import { InfoIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RaciMatrixContainer } from "@/components/raci/raci-matrix-container"

export default function RaciPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ma Trận RACI</h1>
            <p className="text-muted-foreground">Quản lý và theo dõi vai trò, trách nhiệm trong các dự án</p>
          </div>
        </div>

        {/* RACI Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <InfoIcon className="h-5 w-5" />
              Giải thích vai trò RACI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">R</Badge>
                <div>
                  <p className="font-semibold text-sm">Responsible</p>
                  <p className="text-xs text-muted-foreground">Người thực hiện</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-300">A</Badge>
                <div>
                  <p className="font-semibold text-sm">Accountable</p>
                  <p className="text-xs text-muted-foreground">Người chịu trách nhiệm</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">C</Badge>
                <div>
                  <p className="font-semibold text-sm">Consulted</p>
                  <p className="text-xs text-muted-foreground">Người tư vấn</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gray-100 text-gray-800 border-gray-300">I</Badge>
                <div>
                  <p className="font-semibold text-sm">Informed</p>
                  <p className="text-xs text-muted-foreground">Người được thông báo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Suspense fallback={<div>Đang tải...</div>}>
        <RaciMatrixContainer />
      </Suspense>
    </div>
  )
}
