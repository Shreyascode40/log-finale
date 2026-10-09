import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Digital BE Project Log Book</h1>
      <p className="text-sm text-muted-foreground">
        APCOE&amp;R Project Diary — Record No. ACA/D/003B, Revision 00, DoI 01/02/2025.
      </p>
      <p className="text-sm">
        F1 scaffold is in place: schema migrated, paper-page shell ready. Authentication and
        dashboards arrive with F2.
      </p>
      <Link className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm text-white" href="/demo/paper">
        Open the paper-page demo
      </Link>
    </main>
  );
}
