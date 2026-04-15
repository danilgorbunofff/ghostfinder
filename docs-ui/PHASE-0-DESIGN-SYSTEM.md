# Phase 0 — Design System Foundations

> **Priority:** Critical — all other phases depend on this  
> **Estimated scope:** 5 files modified, 2 new files created  
> **Dependencies:** None (first phase)

---

## Objective

Establish the visual foundation for the entire GhostFinder application: brand color palette, dark mode infrastructure, typography scale, global utilities, and toast notification wiring. Every subsequent phase builds on these tokens and components.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Color palette | Pure achromatic (black/white/gray OKLCH) | No brand identity; all cards, buttons, and badges look identical |
| Dark mode | `.dark` CSS block exists in `globals.css` but no toggle or ThemeProvider | Users cannot switch themes; dark tokens are dead code |
| Typography | `Geist` + `Geist_Mono` loaded, single heading weight | No visual hierarchy between KPI numbers, section heads, and body text |
| Toasts | `sonner` installed in `package.json` | `<Toaster />` never mounted — zero user feedback on mutations |
| Charts | Not installed | Dashboard and Reports pages need trend visualizations |

---

## Implementation Steps

### Step 1 — Define Brand Color Tokens

**File:** `src/app/globals.css`

Add brand color variables to both `:root` and `.dark` blocks. We use violet/indigo — the "ghost" palette — as the primary brand accent.

```css
/* Add to :root block after existing variables */
--brand: oklch(0.488 0.243 264.376);          /* Violet 600 */
--brand-foreground: oklch(0.985 0 0);          /* White */
--brand-muted: oklch(0.488 0.243 264.376 / 10%); /* Violet at 10% opacity */
--brand-hover: oklch(0.432 0.232 265.2);       /* Violet 700 — darker hover */

--success: oklch(0.527 0.154 150.069);         /* Green 600 */
--success-foreground: oklch(0.985 0 0);
--warning: oklch(0.681 0.162 75.834);          /* Amber 500 */
--warning-foreground: oklch(0.145 0 0);
```

```css
/* Add to .dark block after existing variables */
--brand: oklch(0.627 0.265 263.0);             /* Violet 400 — brighter in dark */
--brand-foreground: oklch(0.145 0 0);
--brand-muted: oklch(0.627 0.265 263.0 / 15%);
--brand-hover: oklch(0.701 0.248 262.0);       /* Violet 300 */

--success: oklch(0.627 0.194 149.214);
--success-foreground: oklch(0.145 0 0);
--warning: oklch(0.769 0.189 70.08);
--warning-foreground: oklch(0.145 0 0);
```

Then register them in the `@theme inline` block:

```css
--color-brand: var(--brand);
--color-brand-foreground: var(--brand-foreground);
--color-brand-muted: var(--brand-muted);
--color-brand-hover: var(--brand-hover);
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
```

Update chart colors to use brand spectrum instead of pure gray:

```css
/* :root */
--chart-1: oklch(0.488 0.243 264.376);  /* Brand violet */
--chart-2: oklch(0.527 0.154 150.069);  /* Green */
--chart-3: oklch(0.681 0.162 75.834);   /* Amber */
--chart-4: oklch(0.577 0.245 27.325);   /* Red (destructive) */
--chart-5: oklch(0.439 0 0);            /* Neutral gray */
```

### Step 2 — Add Typography Utilities

**File:** `src/app/globals.css`

Add to the `@layer base` block:

```css
@layer base {
  /* Gradient text utility for KPI numbers */
  .gradient-text {
    background: linear-gradient(135deg, var(--brand) 0%, var(--foreground) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Metric number sizing */
  .text-metric {
    font-size: 2rem;
    line-height: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }

  .text-metric-lg {
    font-size: 3rem;
    line-height: 3.25rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
}
```

### Step 3 — Add Animation Keyframes

**File:** `src/app/globals.css`

```css
@layer base {
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes count-up {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes pulse-brand {
    0%, 100% { box-shadow: 0 0 0 0 var(--brand-muted); }
    50% { box-shadow: 0 0 0 8px transparent; }
  }

  .animate-fade-in-up {
    animation: fade-in-up 0.4s ease-out both;
  }

  .animate-count-up {
    animation: count-up 0.6s ease-out both;
  }

  .animate-pulse-brand {
    animation: pulse-brand 2s ease-in-out infinite;
  }
}
```

### Step 4 — Enable Dark Mode with next-themes

**File:** `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GhostFinder — Find Unused SaaS Subscriptions",
  description:
    "Discover ghost subscriptions, eliminate wasted SaaS spend, and optimize your software stack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Step 5 — Create Theme Toggle Component

**New file:** `src/components/ui/theme-toggle.tsx`

```tsx
'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-8 w-8" disabled />
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
```

### Step 6 — Install Recharts

```bash
npm install recharts
```

### Step 7 — Create Reusable Empty State Component

**New file:** `src/components/ui/empty-state.tsx`

```tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      <div className="rounded-full bg-brand-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-brand" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {description}
      </p>
      {action}
    </div>
  )
}
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/globals.css` | Modified | Brand tokens, typography utilities, keyframes, updated chart colors |
| `src/app/layout.tsx` | Modified | ThemeProvider wrapper, Toaster mount, suppressHydrationWarning |
| `src/components/ui/theme-toggle.tsx` | Created | Dark/light mode toggle button |
| `src/components/ui/empty-state.tsx` | Created | Reusable empty state component |
| `package.json` | Modified | `recharts` added to dependencies |

---

## Verification Checklist

- [ ] `npm run build` passes with zero errors
- [ ] `globals.css` compiles — no invalid OKLCH syntax
- [ ] Dark mode toggle switches `<html>` class between `light`/`dark`
- [ ] `Toaster` renders toasts — test with `toast('Hello')` in any client component
- [ ] Brand color is visible: import `ThemeToggle` temporarily into sidebar to verify the violet token renders
- [ ] `recharts` resolves — `import { PieChart } from 'recharts'` does not error
- [ ] Empty state component renders with icon, title, and description

---

## Design Decisions

| Decision | Rationale |
|---|---|
| OKLCH color space | Consistent with existing shadcn/Tailwind v4 setup — perceptually uniform |
| Violet/indigo brand | "Ghost" personality; uncommon in B2B SaaS (most use blue); high contrast on both light/dark backgrounds |
| `next-themes` (already installed) | Zero-config dark mode with system preference detection |
| Sonner over custom toasts | Already a dependency; rich colors, close button, and stacking built in |
| Recharts over visx/chart.js | React-native components; RSC-compatible; matches existing React 19 stack |
