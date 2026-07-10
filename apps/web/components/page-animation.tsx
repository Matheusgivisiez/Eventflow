"use client";

import { type ReactNode } from "react";

interface PageAnimationProps {
  children: ReactNode;
  className?: string;
}

export function PageAnimation({ children, className = "" }: PageAnimationProps) {
  return (
    <div className={`animate-in fade-in slide-in-from-bottom-1 duration-500 ${className}`}>
      {children}
    </div>
  );
}
