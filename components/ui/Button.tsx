"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 select-none active:scale-[0.98]";

  const variants = {
    primary:
      "bg-gradient-to-r from-neutral-500 via-zinc-500 to-neutral-200 text-white shadow-lg shadow-neutral-500/25 hover:brightness-110 hover:shadow-neutral-500/40 border border-white/20 focus:ring-neutral-500",
    secondary:
      "bg-white/10 text-white hover:bg-white/15 border border-white/10 focus:ring-neutral-500",
    outline:
      "border border-white/15 bg-transparent text-neutral-200 hover:bg-white/5 hover:border-white/30 focus:ring-neutral-500",
    ghost:
      "bg-transparent text-neutral-300 hover:bg-white/5 hover:text-white focus:ring-neutral-500",
    danger:
      "bg-neutral-500/20 text-neutral-300 border border-neutral-500/30 hover:bg-neutral-500/30 focus:ring-neutral-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-6 py-3.5 text-base rounded-xl gap-2.5 font-semibold",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
