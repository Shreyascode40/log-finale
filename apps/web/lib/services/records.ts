import "server-only";

import type { Competition, ContentPage, PaperPublication, Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

export type RecordsActor = { id: string; role: Role };

// ---------------------------------------------------------------- competitions

export function listCompetitions(groupId: string) {
  return backendApi<Competition[]>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/competitions`,
  );
}

export function saveCompetition(_actor: RecordsActor, input: unknown) {
  return backendApi<Competition>("/v1/records/competitions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteCompetition(_actor: RecordsActor, input: unknown) {
  return backendApi<{ success: true }>("/v1/records/competitions/delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadCertificate(_actor: RecordsActor, file: File, id: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await backendApi<{ url: string }>(
    `/v1/records/competitions/${encodeURIComponent(id)}/certificate`,
    {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    },
  );
  return res.url;
}

// ---------------------------------------------------------------- papers

export function listPapers(groupId: string) {
  return backendApi<PaperPublication[]>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/papers`,
  );
}

export function savePaper(_actor: RecordsActor, input: unknown) {
  return backendApi<PaperPublication>("/v1/records/papers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePaper(_actor: RecordsActor, input: unknown) {
  return backendApi<{ success: true }>("/v1/records/papers/delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadPaperFile(_actor: RecordsActor, file: File, id: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await backendApi<{ url: string }>(
    `/v1/records/papers/${encodeURIComponent(id)}/file`,
    {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    },
  );
  return res.url;
}

// ---------------------------------------------------------------- checklists

export type ChecklistData = { term: string; items: { text: string; checked: boolean }[] };

export function getChecklist(groupId: string, term: string) {
  return backendApi<ChecklistData>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/checklists/${encodeURIComponent(term)}`,
  );
}

export function setChecklist(_actor: RecordsActor, input: unknown) {
  return backendApi<{ text: string; checked: boolean }[]>("/v1/records/checklists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------- RTM / cost pages

export function getContentPage(groupId: string, type: "RTM" | "COST") {
  return backendApi<ContentPage>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/content/${encodeURIComponent(type)}`,
  );
}

export function saveContent(_actor: RecordsActor, input: unknown) {
  return backendApi<ContentPage>("/v1/records/content", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadContentFile(
  _actor: RecordsActor,
  file: File,
  type: "RTM" | "COST",
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await backendApi<{ url: string }>(
    `/v1/records/content/${encodeURIComponent(type)}/file`,
    {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    },
  );
  return res.url;
}

// ---------------------------------------------------------------- notes

export function listNotes(groupId: string) {
  return backendApi<ContentPage[]>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/notes`,
  );
}

export function saveNote(_actor: RecordsActor, input: unknown) {
  return backendApi<ContentPage>("/v1/records/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteNote(_actor: RecordsActor, input: unknown) {
  return backendApi<{ success: true }>("/v1/records/notes/delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------- HOD bundle

export type GroupRecords = {
  group: { id: string; groupNo: string | null; projectTitle: string | null; status: string };
  competitions: Competition[];
  papers: PaperPublication[];
  checklists: ChecklistData[];
  rtm: ContentPage;
  cost: ContentPage;
  notes: ContentPage[];
};

export function getGroupRecords(groupId: string) {
  return backendApi<GroupRecords>(
    `/v1/records/groups/${encodeURIComponent(groupId)}/bundle`,
  );
}

const QUEUE_RECORDS_ARGS = {
  include: {
    guide: { select: { name: true } },
    _count: { select: { competitions: true, papers: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
type RecordsQueueGroup = Prisma.GroupGetPayload<typeof QUEUE_RECORDS_ARGS>;

export function listRecordsQueue() {
  return backendApi<RecordsQueueGroup[]>("/v1/records/hod-queue");
}
