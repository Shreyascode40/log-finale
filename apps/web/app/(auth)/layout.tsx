export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Akhil Bharatiya Maratha Shikshan Parishad&apos;s
          </p>
          <h1 className="text-lg font-semibold leading-snug">
            Anantrao Pawar College of Engineering &amp; Research
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Digital BE Project Log Book</p>
        </header>
        {children}
      </div>
    </div>
  );
}
