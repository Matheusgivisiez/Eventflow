"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" disabled title="Alternar tema">
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(nextTheme)} title="Alternar tema" className="relative overflow-hidden">
      <span className="transition-transform duration-500 rotate-0 scale-100 dark:-rotate-90 dark:scale-0">
        <Sun className="h-4 w-4" />
      </span>
      <span className="absolute transition-transform duration-500 rotate-90 scale-0 dark:rotate-0 dark:scale-100">
        <Moon className="h-4 w-4" />
      </span>
    </Button>
  );
}
