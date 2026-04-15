import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Copy, Ghost } from 'lucide-react'
import { NotifyButton } from '@/components/reports/notify-button'

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('waste_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (!report) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ghost className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No reports generated yet</p>
            <p className="text-muted-foreground">
              Reports are generated weekly once you connect a bank account
              and an identity provider.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ghostSeats = (report.ghost_seats as Record<string, unknown>[]) ?? []
  const duplicates = (report.duplicates as Record<string, unknown>[]) ?? []

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Generated {new Date(report.generated_at).toLocaleDateString()} ·{' '}
        {report.opportunity_count} optimization opportunities found
      </p>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Waste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              ${Number(report.total_monthly_waste ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Annual Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${Number(report.total_annual_waste ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ghost Seats Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.ghost_seat_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Detail View */}
      <Tabs defaultValue="ghost-seats">
        <TabsList>
          <TabsTrigger value="ghost-seats">
            <Ghost className="mr-2 h-4 w-4" />
            Ghost Seats ({ghostSeats.length})
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Copy className="mr-2 h-4 w-4" />
            Duplicates ({duplicates.length})
          </TabsTrigger>
        </TabsList>

        {/* Ghost Seats Tab */}
        <TabsContent value="ghost-seats" className="space-y-4">
          {ghostSeats.map((finding: Record<string, unknown>, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{finding.vendor as string}</CardTitle>
                  <div className="flex items-center gap-2">
                    <NotifyButton
                      vendor={finding.vendor as string}
                      ghostSeats={finding.ghostSeats as number}
                      monthlyWaste={finding.monthlyWaste as number}
                    />
                    <Badge variant="destructive">
                      {finding.ghostSeats as number} ghost seats
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {finding.activeSeats as number} active / {finding.totalSeats as number} total seats ·
                  Waste: ${finding.monthlyWaste as number}/mo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Days Inactive</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(finding.inactiveUsers as Record<string, unknown>[])?.map(
                      (user: Record<string, unknown>, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{user.email as string}</TableCell>
                          <TableCell>
                            {user.lastLogin
                              ? new Date(user.lastLogin as string).toLocaleDateString()
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                (user.daysSinceLogin as number) > 60
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {(user.daysSinceLogin as number) === 999
                                ? 'Never'
                                : `${user.daysSinceLogin}d`}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{user.provider as string}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-4">
          {duplicates.map((finding: Record<string, unknown>, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{finding.category as string}</CardTitle>
                  <Badge variant="secondary">
                    Save ${finding.potentialSavings as number}/mo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(finding.vendors as Record<string, unknown>[])?.map(
                    (v: Record<string, unknown>, i: number) => (
                      <div key={i} className="rounded-lg border p-3">
                        <p className="font-medium">{v.name as string}</p>
                        <p className="text-sm text-muted-foreground">
                          ${v.monthlyCost as number}/mo
                        </p>
                      </div>
                    )
                  )}
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                    <p className="text-sm">{finding.recommendation as string}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
