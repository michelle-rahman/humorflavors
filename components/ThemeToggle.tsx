"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const options = [
    { value: "light", label: "☀️" },
    { value: "dark", label: "🌙" },
    { value: "system", label: "💻" },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.value}
          className={`px-2 py-1 rounded-md text-sm transition-colors ${
            theme === opt.value
              ? "bg-white dark:bg-zinc-700 shadow-sm"
              : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
