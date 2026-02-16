# Changelog

All notable changes to the IRSB Protocol public site are documented here.

## [2.1.0] - 2026-01-26

### Dark Mode Theme Update

Complete color theme overhaul to match intentsolutions.io branding - converting from light mode with indigo accents to dark mode with zinc/charcoal monochrome design.

#### Changed

- **Color Scheme** - Full migration to zinc-based dark theme
  - Backgrounds: `bg-zinc-900` (primary), `bg-zinc-800` (sections), `bg-zinc-700` (cards)
  - Text: `zinc-50` (headings), `zinc-300/400` (body), `zinc-500` (secondary)
  - Borders: `border-zinc-700` throughout

- **Buttons & CTAs** - Inverted styling pattern
  - Primary: `bg-zinc-200 text-zinc-900` (light on dark)
  - Secondary: `bg-zinc-800 border-zinc-600 text-zinc-300`
  - Hover states adjusted for dark backgrounds

- **Cards & Panels** - Semi-transparent with subtle borders
  - `bg-zinc-800/60 border border-zinc-700` for cards
  - Feature cards, problem cards, contract links all updated

- **Status Badges** - Dark variants with borders
  - Active: `bg-green-900/50 text-green-300 border-green-700`
  - Jailed: `bg-red-900/50 text-red-300 border-red-700`
  - Warning: `bg-yellow-900/50 text-yellow-300 border-yellow-700`

- **Navigation** - Dark header with subtle separation
  - Banner: `bg-zinc-800` with animated green dot (preserved)
  - Logo: Inverted to `bg-zinc-200` with dark text
  - Experimental badge: Amber tones on dark background

- **Score Badges in CSS** - Updated globals.css
  - All score classes use dark variants with borders

#### Preserved

- Green animated dot in "Sepolia testnet live" banner
- Red/yellow/green status indicators (semantic colors work on dark)
- Amber "Experimental" and "Testnet" badges
- Green success/checkmarks, red error indicators

#### Technical

- Added `dark` class to HTML root in layout.tsx
- Set body background to `bg-zinc-900`
- Removed `dark:` prefixes (now dark-only)
- Updated all 10+ component files for consistency

---

## [2.0.0] - 2026-01-26

### Major Redesign: Public Site with Gated Documentation

Complete redesign of the public-facing site to present IRSB Protocol professionally
while protecting sensitive implementation details.

#### Added

- **Landing Page (`/`)** - New hero with "IRSB — Accountability for Intent Execution"
  - The Problem: 3 cards (Delegated Execution, Opaque Routing, Weak Enforcement)
  - What IRSB Adds: 4 cards (Verifiable Receipts, Solver Bonds, Deterministic Enforcement, Portable Reputation)
  - Who It's For: 3 tiles (Protocol Teams, Solver Operators, Wallets & Agents)
  - Proof of Work: Contract links + Dashboard button
  - CTA band: Request Docs + Book a Call

- **Request Docs Page (`/request-docs`)** - Gated teaser explaining why docs are request-only
  - Lists what documentation includes
  - CTAs to form and calendar
  - Email fallback option

- **Redirect Routes** - Configurable destination URLs
  - `/go/book` → Google Calendar scheduling
  - `/go/request-docs` → intentsolutions.io contact form

- **Configuration System** - `src/lib/config.ts`
  - Centralized URLs for all external links
  - Environment variable overrides (`NEXT_PUBLIC_BOOK_CALL_URL`, `NEXT_PUBLIC_REQUEST_DOCS_URL`)
  - Contract addresses in one place

- **Dashboard Improvements**
  - "Testnet" badge in header
  - "Last updated" timestamp with date
  - Improved empty state: "No registered solvers yet" with context
  - Error state handling for subgraph failures
  - "Back to Overview" link

- **Navigation Updates**
  - Animated green dot in "Sepolia testnet live" banner
  - "Experimental" badge next to logo
  - "Book a Call" as highlighted CTA button
  - Removed dead GitHub link (repo is private)

#### Changed

- **Copy Tightened** - Removed marketing fluff, focused on what IRSB does
- **Footer Simplified** - Cleaner layout, essential links only

#### Removed (Disclosure Policy)

The following details were intentionally removed from public display:

- Exact IntentScore formula, weights, and calculation parameters
- Specific slashing percentages (80% user, 15% challenger, 5% treasury)
- Specific time windows (1-hour challenge, 7-day cooldown, 24-hour evidence)
- Dispute resolution mechanics details
- Contract interaction patterns
- Integration playbooks

These details are available via documentation request.

#### Technical

- Firebase Hosting rewrites for clean URLs
- Client-side redirects for `/go/*` routes (static export compatible)
- Updated CSP headers for new routes

---

## [1.0.0] - 2026-01-25

### Initial Release

- Basic solver dashboard with stats and table
- Contract links to Sepolia Etherscan
- Subgraph integration for live data
- Demo data fallback when subgraph unavailable
