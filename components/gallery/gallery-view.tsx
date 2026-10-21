"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, ImageOff, Search } from "lucide-react";

import type { GalleryData, GalleryItem, GalleryKind } from "@/lib/services/gallery";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KIND_COPY = {
  CERTIFICATE: {
    title: "Certificates",
    description: "Every competition certificate uploaded by the groups.",
    missingOne: "competition entry has no certificate uploaded",
    missingMany: "competition entries have no certificate uploaded",
  },
  PAPER: {
    title: "Papers",
    description: "Every paper publication upload across the groups.",
    missingOne: "paper has no paper file uploaded",
    missingMany: "papers have no paper file uploaded",
  },
} as const;

const TABS: { kind: GalleryKind; href: string; label: string }[] = [
  { kind: "CERTIFICATE", href: "/hod/gallery/certificates", label: "Certificates" },
  { kind: "PAPER", href: "/hod/gallery/papers", label: "Papers" },
];

/** Thumbnail: the image itself, a PDF tile, or a fallback when the image fails. */
function Thumb({ item }: { item: GalleryItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.isImage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-500">
        <FileText className="h-10 w-10" aria-hidden />
        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
          PDF
        </span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-500">
        <ImageOff className="h-10 w-10" aria-hidden />
        <span className="text-xs">Preview unavailable</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.fileUrl}
      alt={item.title}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      onError={() => setFailed(true)}
    />
  );
}

function GalleryCard({ item, onOpen }: { item: GalleryItem; onOpen: (item: GalleryItem) => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className="group cursor-pointer overflow-hidden transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b bg-neutral-50">
        <Thumb item={item} />
        <Badge className="absolute left-2 top-2" variant="secondary">
          {item.kind === "CERTIFICATE" ? "Certificate" : "Paper"}
        </Badge>
      </div>
      <CardContent className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.groupLabel}
          {item.projectTitle ? ` · ${item.projectTitle}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.guideName ? `Guide: ${item.guideName}` : "Guide not assigned"}
        </p>
        {item.meta ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{item.meta}</p>
        ) : null}
        <p className="pt-1 text-[11px] text-muted-foreground">Uploaded {item.uploadedOn}</p>
      </CardContent>
    </Card>
  );
}

/**
 * HOD media gallery (read-only): image thumbnails and PDF previews of every
 * certificate/paper upload, with group filter, search and a lightbox. It is an
 * app screen, not a logbook sheet, so it uses the shadcn dashboard components.
 */
export function GalleryView({ data }: { data: GalleryData }) {
  const copy = KIND_COPY[data.kind];
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data.items) map.set(item.groupId, item.groupLabel);
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [data.items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (groupFilter !== "ALL" && item.groupId !== groupFilter) return false;
      if (!query) return true;
      return [item.title, item.groupLabel, item.projectTitle, item.guideName, item.meta]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [data.items, groupFilter, search]);

  const selectedIndex = selectedId
    ? filtered.findIndex((item) => item.id === selectedId)
    : -1;
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!selectedId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const index = filtered.findIndex((item) => item.id === selectedId);
      if (index < 0 || filtered.length < 2) return;
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + offset + filtered.length) % filtered.length;
      setSelectedId(filtered[next].id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, selectedId]);

  function move(offset: number) {
    if (selectedIndex < 0 || filtered.length < 2) return;
    const next = (selectedIndex + offset + filtered.length) % filtered.length;
    setSelectedId(filtered[next].id);
  }

  const missing =
    data.kind === "CERTIFICATE"
      ? data.summary.missingCertificates
      : data.summary.missingPapers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/hod/gallery">‹ Gallery overview</Link>
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const active = tab.kind === data.kind;
          const count =
            tab.kind === "CERTIFICATE"
              ? data.summary.certificates
              : data.summary.papers;
          return (
            <Link
              key={tab.kind}
              href={tab.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-neutral-900 font-medium text-neutral-900"
                  : "border-transparent text-muted-foreground hover:text-neutral-900"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs text-muted-foreground">({count})</span>
            </Link>
          );
        })}
      </div>

      {missing > 0 ? (
        <Alert>
          <AlertTitle>Missing uploads</AlertTitle>
          <AlertDescription>
            {missing} {missing === 1 ? copy.missingOne : copy.missingMany}.{" "}
            <Link className="underline underline-offset-2" href="/hod/records">
              Review group records
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, group or guide"
            className="pl-8"
            aria-label="Search gallery"
          />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filter by group">
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All groups</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "file" : "files"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {data.items.length === 0
              ? `No ${copy.title.toLowerCase()} have been uploaded yet.`
              : "No files match the current search or group filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <GalleryCard key={item.id} item={item} onOpen={(entry) => setSelectedId(entry.id)} />
          ))}
        </div>
      )}

      {selected ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="pr-8">{selected.title}</DialogTitle>
              <DialogDescription>
                {selected.groupLabel}
                {selected.projectTitle ? ` · ${selected.projectTitle}` : ""}
                {selected.guideName ? ` · Guide: ${selected.guideName}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-hidden rounded border bg-neutral-100">
              {selected.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.fileUrl}
                  alt={selected.title}
                  className="mx-auto max-h-[65vh] w-auto object-contain"
                />
              ) : (
                <iframe
                  src={selected.fileUrl}
                  title={selected.title}
                  className="h-[65vh] w-full bg-white"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => move(-1)}
                  disabled={filtered.length < 2}
                >
                  ‹ Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => move(1)}
                  disabled={filtered.length < 2}
                >
                  Next ›
                </Button>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/hod/records/${selected.groupId}`}>View group records</Link>
                </Button>
                <Button asChild size="sm">
                  <a href={selected.fileUrl} target="_blank" rel="noreferrer">
                    Open original
                  </a>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {selected.meta ? `${selected.meta} · ` : ""}Uploaded {selected.uploadedOn}
            </p>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
