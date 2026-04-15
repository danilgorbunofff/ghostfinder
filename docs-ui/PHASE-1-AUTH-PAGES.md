# Phase 1 — Auth Pages (Login & Signup)

> **Priority:** High — first user touchpoint  
> **Estimated scope:** 2 files modified, 1 new file created  
> **Dependencies:** Phase 0 (brand tokens, animation keyframes)

---

## Objective

Transform the login and signup pages from bare centered cards on white backgrounds into branded, polished entry points that communicate trust and product identity. The auth flow is the first impression — it must feel premium.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Background | Plain white `flex min-h-screen items-center justify-center` | Looks like a default template; no brand presence |
| Logo | None — just card title text "Sign in to Ghost Finder" | No visual brand recognition; inconsistent naming (space in "Ghost Finder") |
| Google button | Plain `Button variant="outline"` with text only | Looks identical to email submit; users hesitate — no Google logo = lower trust |
| Divider | `border-t` with "or" text | Functional but visually thin |
| Password field | No strength indication on signup | Users don't know if their password meets requirements |
| Error display | `<p className="text-sm text-red-500">` | Plain text, no icon, easy to miss |
| Success state | Text-only "Check your email" card | No delight; no animated feedback |

---

## Implementation Steps

### Step 1 — Create Auth Background Component

**New file:** `src/components/auth/auth-background.tsx`

This creates a reusable branded background with subtle grid pattern used by both login and signup.

```tsx
export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-muted via-background to-background" />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--brand) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-background/50 to-background" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  )
}
```

Add the radial gradient utility to `globals.css`:

```css
.bg-gradient-radial {
  background: radial-gradient(circle at center, var(--tw-gradient-stops));
}
```

### Step 2 — Add Logo Lockup Above Cards

Add an SVG-free logo lockup using the existing `Ghost` lucide icon + text. Place above the `<Card>` on both pages.

```tsx
import { Ghost } from 'lucide-react'

{/* Logo lockup — above <Card> */}
<div className="flex flex-col items-center mb-8">
  <div className="flex items-center gap-2.5 mb-2">
    <div className="rounded-xl bg-foreground p-2">
      <Ghost className="h-7 w-7 text-background" />
    </div>
    <span className="text-2xl font-bold tracking-tight">GhostFinder</span>
  </div>
  <p className="text-sm text-muted-foreground">
    Find what you&apos;re not using.
  </p>
</div>
```

### Step 3 — Upgrade Google OAuth Button

Replace the plain text-only button with a properly branded Google button:

```tsx
<Button
  variant="outline"
  className="w-full h-11 gap-3 font-medium"
  onClick={handleGoogleLogin}
>
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
  Continue with Google
</Button>
```

### Step 4 — Improve Divider Styling

Replace the existing divider with a better-spaced version:

```tsx
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t border-border" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-card px-3 text-muted-foreground tracking-wider">
      or continue with email
    </span>
  </div>
</div>
```

### Step 5 — Add Password Strength Indicator (Signup Only)

**File:** `src/app/(auth)/signup/page.tsx`

Add a strength calculator and visual bar below the password input:

```tsx
function getPasswordStrength(password: string): {
  score: number; label: string; color: string
} {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-destructive' }
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-warning' }
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-brand' }
  return { score: 4, label: 'Strong', color: 'bg-success' }
}
```

Render below the password `<Input>`:

```tsx
{password.length > 0 && (
  <div className="space-y-1.5">
    <div className="flex gap-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= strength.score ? strength.color : 'bg-muted'
          }`}
        />
      ))}
    </div>
    <p className="text-xs text-muted-foreground">
      Password strength: <span className="font-medium">{strength.label}</span>
    </p>
  </div>
)}
```

### Step 6 — Replace Error Text with Alert Component

Replace `<p className="text-sm text-red-500">{error}</p>` on both pages:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### Step 7 — Animate Email Confirmation Success State

**File:** `src/app/(auth)/signup/page.tsx`

Upgrade the success screen with animation and better hierarchy:

```tsx
if (success) {
  return (
    <AuthBackground>
      {/* Logo lockup */}
      <div className="flex flex-col items-center mb-8">
        {/* ... same logo lockup as above ... */}
      </div>

      <Card className="animate-fade-in-up">
        <CardContent className="flex flex-col items-center py-8">
          <div className="relative mb-6">
            <div className="rounded-full bg-success/10 p-4 animate-pulse-brand">
              <Ghost className="h-10 w-10 text-success animate-bounce" />
            </div>
          </div>
          <CardTitle className="text-xl mb-2">Check your email</CardTitle>
          <CardDescription className="text-center mb-6">
            We&apos;ve sent a confirmation link to{' '}
            <span className="font-semibold text-foreground">{email}</span>.
            <br />
            Click the link to activate your account.
          </CardDescription>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
```

### Step 8 — Add Card Animations

Add entry animation to both auth cards:

```tsx
<Card className="animate-fade-in-up">
  {/* existing card content */}
</Card>
```

### Step 9 — Fix Brand Name Consistency

Replace all instances of "Ghost Finder" (with space) → "GhostFinder" (one word). Currently the login card title says "Sign in to Ghost Finder".

```tsx
// Login
<CardTitle>Sign in to GhostFinder</CardTitle>

// Signup
<CardTitle>Create your account</CardTitle>
```

---

## Complete Login Page Structure (After)

```
AuthBackground
├── Logo lockup (Ghost icon + "GhostFinder" + tagline)
└── Card (animate-fade-in-up)
    ├── CardHeader
    │   ├── CardTitle: "Sign in to GhostFinder"
    │   └── CardDescription
    ├── Google button (with SVG logo)
    ├── Divider ("or continue with email")
    ├── Email input
    ├── Password input
    ├── Error Alert (conditional)
    ├── Submit button
    └── Sign up link
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(auth)/login/page.tsx` | Modified | AuthBackground, logo lockup, Google SVG, Alert errors, card animation |
| `src/app/(auth)/signup/page.tsx` | Modified | Same as login + password strength bar + animated success state |
| `src/components/auth/auth-background.tsx` | Created | Branded background with gradient + dot grid pattern |

---

## Verification Checklist

- [ ] Login page shows gradient background with dot grid pattern
- [ ] GhostFinder logo + tagline appears above login card
- [ ] Google button shows the full-color "G" logo SVG
- [ ] Typing a password on signup shows strength bar filling 1–4 segments
- [ ] Invalid login shows error in a red Alert component with icon
- [ ] After signup, email confirmation screen shows bouncing Ghost icon
- [ ] Card fades in on page load (0.4s ease-out)
- [ ] Both pages are fully responsive on mobile (test at 375px width)
- [ ] All focus states are accessible (Tab through form, Enter to submit)
- [ ] Brand name reads "GhostFinder" (no space) everywhere

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Dot grid over abstract SVG art | Lightweight (CSS-only), renders at any resolution, thematic ("finding hidden things") |
| Google SVG inline over icon font | Loads immediately with page; no external dependency; official brand colors |
| 4-segment strength bar over text-only | Visual, scannable at a glance; matches industry standard (1Password, GitHub) |
| Alert component for errors | Already exists in the project (`alert.tsx`); consistent with shadcn design system |
| Bouncing Ghost on success | Product-themed micro-delight; uses existing Lucide icon — zero asset cost |
