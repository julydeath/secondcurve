"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type InkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
  loading?: boolean;
  children: ReactNode;
};

export default function InkButton({
  variant = "outline",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: InkButtonProps) {
  const base =
    "ink-button inline-flex items-center justify-center px-4 py-3 text-xs uppercase tracking-widest transition gap-2";
  const styles =
    variant === "solid"
      ? "bg-black text-white border-2 border-black"
      : "border-2 border-black";

  return (
    <button
      {...props}
      className={`${base} ${styles} ${className ?? ""}`}
      disabled={disabled || loading}
      type={props.type ?? "button"}
    >
      {loading && <span className="ink-spinner" aria-hidden="true" />}
      <span>{loading ? "Loading..." : children}</span>
    </button>
  );
}
