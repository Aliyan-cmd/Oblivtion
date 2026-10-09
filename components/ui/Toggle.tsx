"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  className,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex items-start gap-3 text-left transition-opacity hover:opacity-90 focus:outline-none",
        className
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? "bg-gradient-to-r from-neutral-500 to-neutral-200" : "bg-neutral-800 border-white/10"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-neutral-300 group-hover:text-white">
          {label}
        </span>
        {description && (
          <span className="text-[11px] text-neutral-500">{description}</span>
        )}
      </div>
    </button>
  );
};
