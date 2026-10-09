"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setPdfPermissionAction } from "@/lib/actions/admin";

/**
 * HOD PDF permission toggle (F15). Allowing requires every mandatory section
 * complete — the server refuses with the missing list otherwise.
 */
export function PdfToggle({ groupId, allowed }: { groupId: string; allowed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const result = await setPdfPermissionAction({ groupId, allowed: !allowed });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={allowed ? "outline" : "default"}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {allowed ? "Revoke PDF" : "Allow PDF"}
      </Button>
      {error ? <span className="max-w-[18rem] text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
