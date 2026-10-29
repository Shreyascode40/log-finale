"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  acceptInviteAction,
  createGroupAction,
  declineInviteAction,
  inviteMemberAction,
  joinByCodeAction,
  removeMemberAction,
  submitGroupAction,
} from "@/lib/actions/group";

export type MemberView = {
  id: string;
  userId: string;
  name: string;
  rollNo: string | null;
  email: string | null;
  memberType: string;
};

export type SentInvite = {
  id: string;
  invitedEmail: string | null;
  invitedRollNo: string | null;
  expiresAt: string;
};

export type GroupView = {
  id: string;
  code: string;
  groupNo: string | null;
  projectTitle: string | null;
  area: string | null;
  academicYear: string | null;
  department: string | null;
  status: string;
  rejectReason: string | null;
  guideName: string | null;
  creatorId: string;
  myUserId: string;
  members: MemberView[];
  invites: SentInvite[];
};

export type ReceivedInvite = {
  id: string;
  groupLabel: string;
  code: string;
  expiresAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — awaiting HOD approval",
  ACTIVE: "Active",
  READY_FOR_PDF: "Ready for PDF",
  PDF_ALLOWED: "PDF allowed",
  PDF_GENERATED: "PDF generated",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  ACTIVE: "default",
};

export function GroupOnboarding({
  group,
  receivedInvites,
}: {
  group: GroupView | null;
  receivedInvites: ReceivedInvite[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
  ) {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong");
      return false;
    }
    setNotice(successMessage);
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">My group</h1>
        <p className="text-sm text-muted-foreground">
          A group has at most 4 students and one guide (assigned by the HOD). Only the creator can
          invite members and submit the group.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {group ? (
        <GroupPanel group={group} busy={busy} run={run} />
      ) : (
        <>
          {receivedInvites.length > 0 ? (
            <ReceivedInvites busy={busy} run={run} invites={receivedInvites} />
          ) : null}
          <CreateGroupCard busy={busy} run={run} />
          <JoinByCodeCard busy={busy} run={run} />
        </>
      )}
    </div>
  );
}

type RunFn = (
  action: () => Promise<{ success: boolean; error?: string }>,
  successMessage: string,
) => Promise<boolean>;

function ReceivedInvites({
  invites,
  busy,
  run,
}: {
  invites: ReceivedInvite[];
  busy: boolean;
  run: RunFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invitations for you</CardTitle>
        <CardDescription>Accepting adds you to the group as a member.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="text-sm">
              <div className="font-medium">{invite.groupLabel}</div>
              <div className="text-xs text-muted-foreground">
                Code {invite.code} · expires {new Date(invite.expiresAt).toLocaleDateString("en-GB")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(() => acceptInviteAction({ inviteId: invite.id }), "You joined the group.")
                }
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => declineInviteAction({ inviteId: invite.id }),
                    "Invitation declined.",
                  )
                }
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreateGroupCard({ busy, run }: { busy: boolean; run: RunFn }) {
  const [form, setForm] = useState({
    groupNo: "",
    academicYear: "2025-26",
    department: "Computer Engineering",
    projectTitle: "",
    area: "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a group</CardTitle>
        <CardDescription>You become the creator and first member.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="c-groupNo">Group number (optional)</Label>
            <Input
              id="c-groupNo"
              value={form.groupNo}
              onChange={(e) => setForm({ ...form, groupNo: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-year">Academic year</Label>
            <Input
              id="c-year"
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="c-title">Project title (optional, can be set later)</Label>
            <Input
              id="c-title"
              value={form.projectTitle}
              onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-area">Area of project (optional)</Label>
            <Input
              id="c-area"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-dept">Department</Label>
            <Input
              id="c-dept"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
        </div>
        <Button
          disabled={busy}
          onClick={() => run(() => createGroupAction(form), "Group created. Invite your classmates.")}
        >
          Create group
        </Button>
      </CardContent>
    </Card>
  );
}

function JoinByCodeCard({ busy, run }: { busy: boolean; run: RunFn }) {
  const [code, setCode] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join with a group code</CardTitle>
        <CardDescription>
          Enter the code your classmate shared. You can belong to only one group.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="join-code">Group code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. GX7K2P"
            className="max-w-[12rem] font-mono tracking-widest"
          />
        </div>
        <Button
          variant="outline"
          disabled={busy || code.trim().length < 3}
          onClick={() => run(() => joinByCodeAction({ code }), "You joined the group.")}
        >
          Join group
        </Button>
      </CardContent>
    </Card>
  );
}

function GroupPanel({ group, busy, run }: { group: GroupView; busy: boolean; run: RunFn }) {
  const isCreator = group.creatorId === group.myUserId;
  const isDraft = group.status === "DRAFT";
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {group.groupNo ? `Group ${group.groupNo}` : "Your group"}
          </CardTitle>
          <CardDescription>{group.projectTitle ?? "No project title yet"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[group.status] ?? "secondary"}>
              {STATUS_LABEL[group.status] ?? group.status}
            </Badge>
            <span className="text-muted-foreground">
              Guide: {group.guideName ?? "not assigned yet"}
            </span>
            <span className="text-muted-foreground">
              {group.department ?? "—"} · {group.academicYear ?? "—"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Group code:</span>
            <span className="font-mono tracking-widest">{group.code}</span>
            <Button variant="ghost" size="sm" onClick={copyCode}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {group.rejectReason ? (
            <Alert variant="destructive">
              <AlertDescription>
                The HOD sent this group back: {group.rejectReason}
              </AlertDescription>
            </Alert>
          ) : null}

          {group.status === "SUBMITTED" ? (
            <p className="text-muted-foreground">
              Waiting for the HOD to approve the group and assign a guide.
            </p>
          ) : null}
          {group.status === "ACTIVE" ? (
            <p className="text-muted-foreground">
              Approved. The activity charts, topics and reviews unlock now — those sheets arrive in
              the next features.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({group.members.length} / 4)</CardTitle>
          <CardDescription>Maximum four students per group.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roll no</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isCreator && isDraft ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.rollNo ?? "—"}</TableCell>
                  <TableCell>{member.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.memberType === "creator" ? "Creator" : "Member"}
                  </TableCell>
                  {isCreator && isDraft ? (
                    <TableCell className="text-right">
                      {member.userId === group.myUserId ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => removeMemberAction({ memberId: member.id }),
                              "Member removed.",
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isCreator && isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite classmates</CardTitle>
            <CardDescription>
              Invite by college email or roll number (up to 3, so the group never exceeds 4).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="invite-id">Email or roll number</Label>
                <Input
                  id="invite-id"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="te2106@apcoer.edu.in or TE2106"
                  className="w-72"
                  disabled={group.members.length >= 4}
                />
              </div>
              <Button
                disabled={busy || group.members.length >= 4 || invite.trim().length < 3}
                onClick={async () => {
                  const ok = await run(
                    () => inviteMemberAction({ identifier: invite }),
                    "Invitation sent.",
                  );
                  if (ok) setInvite("");
                }}
              >
                Send invite
              </Button>
            </div>

            {group.members.length >= 4 ? (
              <p className="text-xs text-muted-foreground">The group is full.</p>
            ) : null}

            {group.invites.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Pending invitations</p>
                <ul className="space-y-1 text-sm">
                  {group.invites.map((sent) => (
                    <li key={sent.id} className="flex items-center justify-between gap-3">
                      <span>{sent.invitedEmail ?? sent.invitedRollNo}</span>
                      <span className="text-xs text-muted-foreground">
                        expires {new Date(sent.expiresAt).toLocaleDateString("en-GB")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isCreator && isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit for approval</CardTitle>
            <CardDescription>
              Sends the group to the HOD. They approve it and assign your guide. You can no longer
              change members after this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy}
              onClick={() =>
                run(() => submitGroupAction({ groupId: group.id }), "Group submitted to the HOD.")
              }
            >
              Submit group
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isCreator && isDraft ? (
        <p className="text-sm text-muted-foreground">
          Only the group creator can invite members or submit the group.
        </p>
      ) : null}
    </>
  );
}
