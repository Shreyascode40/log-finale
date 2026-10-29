"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approveGroupAction, rejectGroupAction, setGroupSponsoredAction } from "@/lib/actions/admin";

export type GroupRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  area: string | null;
  status: string;
  rejectReason: string | null;
  isSponsored: boolean;
  guideName: string | null;
  creatorName: string;
  members: { id: string; name: string; rollNo: string | null }[];
};

export type GuideOption = { id: string; name: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  ACTIVE: "default",
  READY_FOR_PDF: "default",
  PDF_ALLOWED: "default",
  PDF_GENERATED: "default",
};

export function GroupsManager({
  groups,
  guides,
}: {
  groups: GroupRow[];
  guides: GuideOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [approving, setApproving] = useState<GroupRow | null>(null);
  const [approveGuide, setApproveGuide] = useState("");

  const [rejecting, setRejecting] = useState<GroupRow | null>(null);
  const [reason, setReason] = useState("");

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onApprove() {
    if (!approving) return;
    setError(null);
    const result = await approveGroupAction({ groupId: approving.id, guideId: approveGuide });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setApproving(null);
    setApproveGuide("");
    refresh();
  }

  async function onReject() {
    if (!rejecting) return;
    setError(null);
    const result = await rejectGroupAction({ groupId: rejecting.id, reason });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRejecting(null);
    setReason("");
    refresh();
  }

  async function onToggleSponsored(group: GroupRow) {
    setError(null);
    const result = await setGroupSponsoredAction({ groupId: group.id, isSponsored: !group.isSponsored });
    if (!result.success) {
      setError(result.error);
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">
          Approve a group and assign its one guide. A group is ACTIVE only after both are done.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Guide</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No groups have been created yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    {group.groupNo ?? "—"}
                    <div className="text-xs text-muted-foreground">by {group.creatorName}</div>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    {group.projectTitle ?? "—"}
                    {group.area ? (
                      <div className="text-xs text-muted-foreground">{group.area}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {group.members.length === 0
                        ? "—"
                        : group.members.map((member) => member.name).join(", ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {group.members.length} / 4 members
                    </div>
                  </TableCell>
                  <TableCell>{group.guideName ?? "Not assigned"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[group.status] ?? "secondary"}>
                      {group.status.replaceAll("_", " ")}
                    </Badge>
                    {group.isSponsored ? (
                      <div className="mt-1">
                        <Badge variant="outline">Sponsored</Badge>
                      </div>
                    ) : null}
                    {group.rejectReason ? (
                      <div className="mt-1 max-w-[14rem] text-xs text-destructive">
                        {group.rejectReason}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onToggleSponsored(group)}
                    >
                      {group.isSponsored ? "Unmark sponsored" : "Mark sponsored"}
                    </Button>
                    {group.status === "SUBMITTED" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setApproving(group);
                            setApproveGuide("");
                          }}
                        >
                          Approve…
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setRejecting(group);
                            setReason("");
                          }}
                        >
                          Reject…
                        </Button>
                      </>
                    ) : group.status === "DRAFT" ? (
                      <span className="text-xs text-muted-foreground">Waiting for students</span>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/hod/assignments">Manage guide</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Approve + assign */}
      <Dialog open={Boolean(approving)} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve group &amp; assign guide</DialogTitle>
            <DialogDescription>
              {approving?.groupNo ? `Group ${approving.groupNo}. ` : ""}
              The chosen guide becomes the guide and the reviewer for this group. The group becomes
              ACTIVE.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Guide</Label>
            <Select value={approveGuide} onValueChange={setApproveGuide}>
              <SelectTrigger>
                <SelectValue placeholder="Select a guide" />
              </SelectTrigger>
              <SelectContent>
                {guides.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No guide accounts yet
                  </SelectItem>
                ) : (
                  guides.map((guide) => (
                    <SelectItem key={guide.id} value={guide.id}>
                      {guide.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button onClick={onApprove} disabled={pending || !approveGuide}>
              Approve &amp; assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject group</DialogTitle>
            <DialogDescription>
              The group returns to DRAFT and the students see your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reject-reason">Reason (required)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What must the students fix before resubmitting?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={pending || reason.trim().length < 5}>
              Reject group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
