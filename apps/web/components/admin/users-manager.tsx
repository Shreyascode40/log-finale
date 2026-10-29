"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createGuideAction,
  setUserActiveAction,
  updateGuideAction,
} from "@/lib/actions/admin";

export type GuideRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  active: boolean;
  groups: number;
};

type FormState = { name: string; email: string; mobile: string; password: string };
const EMPTY: FormState = { name: "", email: "", mobile: "", password: "" };

export function UsersManager({ guides }: { guides: GuideRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY);

  const [editing, setEditing] = useState<GuideRow | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onCreate() {
    setError(null);
    const result = await createGuideAction(createForm);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCreateOpen(false);
    setCreateForm(EMPTY);
    refresh();
  }

  async function onUpdate() {
    if (!editing) return;
    setError(null);
    const result = await updateGuideAction({
      userId: editing.id,
      name: editForm.name,
      email: editForm.email,
      mobile: editForm.mobile,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditing(null);
    refresh();
  }

  async function toggleActive(row: GuideRow) {
    setError(null);
    const result = await setUserActiveAction({ userId: row.id, active: !row.active });
    if (!result.success) {
      setError(result.error);
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Guide accounts</h1>
          <p className="text-sm text-muted-foreground">
            Guides also act as reviewers. They are created here — never self-registered.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setCreateForm(EMPTY);
            setCreateOpen(true);
          }}
        >
          Add guide
        </Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guides.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No guide accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              guides.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.mobile ?? "—"}</TableCell>
                  <TableCell>{row.groups}</TableCell>
                  <TableCell>
                    <Badge variant={row.active ? "default" : "secondary"}>
                      {row.active ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setEditing(row);
                        setEditForm({
                          name: row.name,
                          email: row.email,
                          mobile: row.mobile ?? "",
                          password: "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant={row.active ? "destructive" : "secondary"}
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleActive(row)}
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create guide */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add guide account</DialogTitle>
            <DialogDescription>
              The account is ready to sign in immediately and acts as the reviewer for its groups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="g-name">Full name</Label>
              <Input
                id="g-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-email">College email</Label>
              <Input
                id="g-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-mobile">Mobile (optional)</Label>
              <Input
                id="g-mobile"
                value={createForm.mobile}
                onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-password">Initial password</Label>
              <Input
                id="g-password"
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters. Share it with the guide; they can change it later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={pending}>
              Create guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit guide */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit guide</DialogTitle>
            <DialogDescription>Update the guide&apos;s details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="e-name">Full name</Label>
              <Input
                id="e-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-email">College email</Label>
              <Input
                id="e-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-mobile">Mobile (optional)</Label>
              <Input
                id="e-mobile"
                value={editForm.mobile}
                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={onUpdate} disabled={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
