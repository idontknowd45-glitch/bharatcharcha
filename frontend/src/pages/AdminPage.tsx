import { useState } from 'react';
import { useIsCallerAdmin, useGetReports, useGetAuditLogs, useUpdateReportStatus, useTakedownPost, useSuspendUser, useUnsuspendUser } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Shield, AlertTriangle, FileText } from 'lucide-react';
import { Report, AuditLog, Variant_pending_reviewed_actioned } from '../backend';

export default function AdminPage() {
  const { data: isAdmin, isLoading: adminLoading } = useIsCallerAdmin();
  const { data: reports } = useGetReports();
  const { data: auditLogs } = useGetAuditLogs();
  const updateReportStatus = useUpdateReportStatus();
  const takedownPost = useTakedownPost();
  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();

  const handleUpdateReportStatus = async (reportId: bigint, status: Variant_pending_reviewed_actioned) => {
    try {
      await updateReportStatus.mutateAsync({ reportId, status });
      toast.success('Report status updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update report status');
    }
  };

  const handleTakedown = async (postId: bigint) => {
    try {
      await takedownPost.mutateAsync(postId);
      toast.success('Post taken down');
    } catch (error: any) {
      toast.error(error.message || 'Failed to takedown post');
    }
  };

  if (adminLoading) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-6">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <img src="/assets/generated/admin-icon.dim_64x64.png" alt="Access Denied" className="h-24 mx-auto opacity-50" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage content moderation and system administration</p>
          </div>
        </div>

        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="audit">
              <FileText className="h-4 w-4 mr-2" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Content Reports</CardTitle>
              </CardHeader>
              <CardContent>
                {!reports || reports.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No reports to review</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Post ID</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reported</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={Number(report.id)}>
                          <TableCell>{Number(report.postId)}</TableCell>
                          <TableCell className="max-w-xs truncate">{report.reason}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                report.status === Variant_pending_reviewed_actioned.pending
                                  ? 'default'
                                  : report.status === Variant_pending_reviewed_actioned.reviewed
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(Number(report.timestamp) / 1000000), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {report.status === Variant_pending_reviewed_actioned.pending && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateReportStatus(report.id, Variant_pending_reviewed_actioned.reviewed)}
                                >
                                  Review
                                </Button>
                              )}
                              {report.status === Variant_pending_reviewed_actioned.reviewed && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleTakedown(report.postId)}
                                  >
                                    Takedown
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateReportStatus(report.id, Variant_pending_reviewed_actioned.actioned)}
                                  >
                                    Mark Actioned
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {!auditLogs || auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No audit logs yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Post ID</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={Number(log.id)}>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell className="font-mono text-xs">{log.performedBy.toString().slice(0, 10)}...</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.target ? `${log.target.toString().slice(0, 10)}...` : '-'}
                          </TableCell>
                          <TableCell>{log.postId ? Number(log.postId) : '-'}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(Number(log.timestamp) / 1000000), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
