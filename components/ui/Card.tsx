"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/20",
        glow && "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-r before:from-neutral-500/10 before:to-neutral-200/10 before:blur-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
