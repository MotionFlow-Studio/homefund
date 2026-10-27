import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={32} height={32} />
          HomeFund
        </Link>
        <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
        {children}
        <p className="mt-6 text-center text-sm opacity-80">{footer}</p>
      </div>
    </main>
  );
}
