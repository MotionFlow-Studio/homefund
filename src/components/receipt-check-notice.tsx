import { CircleAlert, Info } from "lucide-react";
import { warningText, type ReceiptCheck } from "@/lib/receipt-check";

/**
 * Tells the user what to look at before saving a read receipt. Problems that
 * may make the amounts wrong are shown in amber; plain notes in grey.
 */
export function ReceiptCheckNotice({ check, currency }: { check: ReceiptCheck; currency: string }) {
  if (check.warnings.length === 0) return null;

  const problems = check.warnings.filter((warning) => warning.code !== "no_date" && warning.code !== "other_currency");
  const notes = check.warnings.filter((warning) => warning.code === "no_date" || warning.code === "other_currency");

  return (
    <div className="space-y-2">
      {problems.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            Please check before saving
          </p>
          <ul className="mt-1.5 space-y-1 pl-6">
            {problems.map((warning) => (
              <li key={warning.code + ("line" in warning ? warning.line : "")}>{warningText(warning, currency)}</li>
            ))}
          </ul>
        </div>
      )}
      {notes.map((warning) => (
        <p
          key={warning.code}
          className="flex items-start gap-2 rounded-xl bg-black/[0.04] p-3 text-sm opacity-80 dark:bg-white/[0.06]"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {warningText(warning, currency)}
        </p>
      ))}
    </div>
  );
}
