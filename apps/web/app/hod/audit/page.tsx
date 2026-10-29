import { requireRole } from "@/lib/permissions";
import { listAuditLogs } from "@/lib/services/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Audit log — Digital BE Log Book" };

type SearchParams = { entity?: string; action?: string; user?: string };

export default async function HodAuditPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireRole("HOD");

  const entity = searchParams?.entity?.trim() || undefined;
  const action = searchParams?.action?.trim() || undefined;
  const user = searchParams?.user?.trim() || undefined;

  const { logs, entities, actions } = await listAuditLogs({ entity, action, user });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every create, update, approve, unlock, assignment and PDF event. Newest first (max 200).
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-3" method="get">
        <label className="flex flex-col gap-1 text-xs">
          Entity
          <select
            name="entity"
            defaultValue={entity ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {entities.map((row) => (
              <option key={row.entity} value={row.entity}>
                {row.entity}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Action contains
          <select
            name="action"
            defaultValue={action ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {actions.map((row) => (
              <option key={row.action} value={row.action}>
                {row.action}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          User email contains
          <input
            name="user"
            defaultValue={user ?? ""}
            placeholder="e.g. hod@apcoer.edu.in"
            className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No audit entries match these filters.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(log.timestamp).toLocaleString("en-GB")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user ? (
                      <>
                        <div className="font-medium">{log.user.name}</div>
                        <div className="text-xs text-muted-foreground">{log.user.email}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">system</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.entity}
                    {log.entityId ? (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {log.entityId}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[26rem] text-xs text-muted-foreground">
                    {log.after ?? log.before ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
