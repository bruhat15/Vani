# Vani Frontend Spec Gap Audit (Task 1)

Date: 2026-04-14

## 1) Stack and Core Dependencies

- React + Vite + Tailwind: Present
- React Router v6: Present
- Supabase Auth: Present
- Framer Motion: Missing (not installed, no usages)
- Zustand: Missing (not installed, no store files/usages)
- Web Audio API voice visualization pipeline: Missing

Required action:
- Add `framer-motion` and `zustand` dependencies.
- Introduce global store slices for session, notebook UI state, voice state, and citation highlight events.

## 2) Global Design Tokens

Current state:
- `src/index.css` uses shadcn HSL token set.
- Spec token names (`--color-navy`, `--color-paper`, etc.) are missing.
- Font tokens and animation tokens from spec are missing.

Required action:
- Add full spec token set as CSS custom properties.
- Preserve compatibility with existing shadcn variables during migration.

## 3) Route Architecture

Current state in `src/App.tsx`:
- `/` is protected and renders Dashboard/Auth fallback.
- `/auth` exists.
- `/notebook/:id` exists and is protected.
- `/notebook` also exists (extra route not in new spec).
- `/contact` missing.
- `LandingPage` missing.

Required action:
- Set `/` to public landing page.
- Add `/dashboard` protected route.
- Keep `/notebook/:id` protected.
- Add `/contact` public route.
- Keep `*` not found route.

## 4) Auth Guard and Session Source

Current state:
- `ProtectedRoute` uses AuthContext and fallback rendering, not redirect behavior.
- Session is managed in `AuthContext` local React state, not Zustand.

Required action:
- Replace fallback-style guard with redirect-to-`/auth` guard.
- Move auth/session source of truth to Zustand (can bridge from AuthContext during migration).

## 5) Global Navigation

Current state:
- No fixed frosted global navbar matching spec.
- Dashboard has a page-local header component.

Required action:
- Build shared fixed navbar with auth-conditional right side.
- Add mobile full-screen menu animation behavior.

## 6) Landing Experience

Current state:
- No landing page implementation.
- No hero waveform engine, no scroll morph, no panel reveal sequence.

Required action:
- Build landing sections as isolated components.
- Implement waveform path generation and animation loop.
- Add mouse-follow phase offset and scroll-based morph to navbar logo.

## 7) Reusable Motion Components

Current state:
- No ripple CTA button component.
- No motion primitives or shared variants.

Required action:
- Introduce reusable ripple button and motion helper variants.

## 8) Auth Page

Current state:
- Basic sign-in card only.
- No animated login/sign-up mode switch.
- No frosted glass spec treatment.

Required action:
- Implement unified auth page with `isLogin` toggle and AnimatePresence transitions.

## 9) Dashboard Page

Current state:
- Functional notebook listing exists.
- Does not match required visual language and motion behavior.
- Greeting is static "Welcome to Vani" (no time-of-day greeting).
- No staggered card entrance.
- No spec-compliant "New Notebook" modal behavior.

Required action:
- Refactor to paper theme, dynamic greeting, staggered cards, and animated create modal.

## 10) Notebook Page

Current state:
- Existing desktop/mobile split exists, but not spec grid `240px 1fr 320px`.
- Mobile breakpoint helper currently uses 1100px.
- No Zustand tab index.
- Citation click path exists but no store event bus and no pulse highlight animation contract.
- No voice button state machine with real-time analyser-driven waveform.

Required action:
- Align desktop grid and mobile threshold (<768px).
- Move active tab state to Zustand.
- Implement citation highlight event bridge and pulse animation.
- Implement voice button + Web Audio API driven amplitude visualization + page overlay dim.

## 11) Contact Page

Current state:
- Missing.

Required action:
- Build full viewport contact page with two-column layout, submission flow, and success transition.

## 12) NotFound

Current state:
- Exists, but visual style does not align to new brand tokens.

Required action:
- Restyle to minimal spec-consistent not-found page.

## 13) Validation Baseline

Current state:
- No task-by-task implementation validation checklist in repo.

Required action:
- Validate each completed task with focused diagnostics before advancing.

## Task 1 Exit Status

Task 1 completed: the current codebase has been audited and mapped to explicit implementation deltas for all major spec areas.
