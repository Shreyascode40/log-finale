import "server-only";

import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

export type SignoffActor = { id: string; role: Role };

export function acknowledgeRules(_actor: SignoffActor, memberId: string) {
  return backendApi<{ acknowledgedAt: string }>("/v1/signoff/rules", {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}

export function acceptUndertaking(_actor: SignoffActor, memberId: string) {
  return backendApi<{ acceptedAt: string }>("/v1/signoff/undertaking", {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
}
