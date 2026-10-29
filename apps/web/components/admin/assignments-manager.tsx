"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { assignGuideAction } from "@/lib/actions/admin";

export type AssignmentRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  guideId: string | null;
  guideName: string | null;
};

export type GuideOption = { id: string; name: string };

export function AssignmentsManager({
  groups,
  guides,
}: {
  groups: AssignmentRow[];
  guides: GuideOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Guide assignments</h1>
        <p className="text-sm text-muted-foreground">
          Exactly one guide per group. Reassigning a group is recorded in the audit log.
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
              <TableHead>Status</TableHead>
              <TableHead>Current guide</TableHead>
              <TableHead className="text-right">Assign</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No submitted or active groups yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <AssignmentRowView
                  key={group.id}
                  group={group}
                  guides={guides}
                  pending={pending}
                  onError={setError}
                  onSaved={refresh}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AssignmentRowView({
  group,
  guides,
  pending,
  onError,
  onSaved,
}: {
  group: AssignmentRow;
  guides: GuideOption[];
  pending: boolean;
  onError: (message: string) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState(group.guideId ?? "");

  async function save() {
    onError("");
    const result = await assignGuideAction({ groupId: group.id, guideId: selected });
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved();
  }

  const changed = selected !== (group.guideId ?? "");

  return (
    <TableRow>
      <TableCell className="font-medium">{group.groupNo ?? "—"}</TableCell>
      <TableCell className="max-w-[16rem]">{group.projectTitle ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={group.status === "ACTIVE" ? "default" : "secondary"}>{group.status}</Badge>
      </TableCell>
      <TableCell>{group.guideName ?? "Not assigned"}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a guide" />
            </SelectTrigger>
            <SelectContent>
              {guides.map((guide) => (
                <SelectItem key={guide.id} value={guide.id}>
                  {guide.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={save} disabled={pending || !selected || !changed}>
            {group.guideId ? "Reassign" : "Assign"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
