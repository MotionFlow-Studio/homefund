import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, disabled, children, className = "", ...rest }: Props) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
