---
name: Bot Combinator
description: A calm, evidence-first fundraising operating system for founders.
colors:
  paper: '#ffffff'
  fog: '#f3f8fa'
  fog-strong: '#e5eff3'
  selected-sky: '#d1edfb'
  ink: '#06131b'
  ink-strong: '#02070b'
  muted-ink: '#3d5360'
  soft-ink: '#64747e'
  divider: '#cdd8dd'
  divider-strong: '#95afbd'
  marine: '#006d95'
  marine-hover: '#005982'
  marine-soft: '#c0ecff'
  on-marine: '#ffffff'
  on-marine-muted: '#deeef6'
  mint-signal: '#97e4c2'
  mint-ink: '#002519'
  success: '#00723b'
  success-soft: '#daf3e1'
  success-ink: '#003715'
  warning: '#a36a00'
  warning-soft: '#ffeccd'
  warning-ink: '#512c00'
  danger: '#ba1f1c'
  danger-soft: '#ffe6e2'
  danger-ink: '#6c0a09'
  info: '#316ca5'
  info-soft: '#e2f0ff'
  info-ink: '#073964'
typography:
  display:
    fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2.125rem'
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.625rem'
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 630
    lineHeight: 1.4
  data:
    fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: '4px'
  sm: '6px'
  md: '10px'
  lg: '14px'
  brand-sm: '9px'
  brand-lg: '13px'
  pill: '999px'
spacing:
  1: '0.25rem'
  2: '0.5rem'
  3: '0.75rem'
  4: '1rem'
  5: '1.25rem'
  6: '1.5rem'
  8: '2rem'
  10: '2.5rem'
  12: '3rem'
components:
  button-primary:
    backgroundColor: '{colors.marine}'
    textColor: '{colors.paper}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '7px 12px'
    height: '36px'
  button-primary-hover:
    backgroundColor: '{colors.marine-hover}'
    textColor: '{colors.paper}'
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '7px 12px'
    height: '36px'
  input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink-strong}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '8px 10px'
    height: '40px'
  badge:
    backgroundColor: '{colors.fog-strong}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '2px 7px'
    height: '22px'
  nav-active:
    backgroundColor: '{colors.selected-sky}'
    textColor: '{colors.ink-strong}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '6px 9px'
    height: '34px'
  pipeline-card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '10px'
---

# Design System: Bot Combinator

## Overview

**Creative North Star: “The Morning Brief.”** A founder opens Bot Combinator before the day’s first investor call and finds a prepared briefing desk: clear, exact, calm, and already arranged around the decisions that matter. The interface is a working instrument, not a performance of productivity.

**The Decision-First Rule.** Each page exposes the next safe action while keeping the evidence, uncertainty, and consequence in view. Familiar tables, queues, detail panes, and dialogs disappear into the work.

**The Compact Rhythm Rule.** The product is information-dense without becoming cramped. A four-point spacing base, stable 72-character reading measure, and restrained headings let records carry more visual weight than dashboard furniture.

**Key Characteristics:**

- Bright paper and cool fog surfaces anchored by marine blue.
- Compact records with generous reading rhythm and stable information architecture.
- Evidence, freshness, privacy, and safety states visible at the point of action.
- State transitions that are responsive, never choreographed.
- A complete light theme, dark theme, and system-following theme with identical hierarchy.

The shell is optimized for desktop work from a practical 720-pixel minimum width upward. At narrow widths, controls wrap and dense collections scroll; no critical action may disappear. Keyboard focus, 200% zoom, reduced motion, and non-color status indicators are part of the visual system, not later accommodations.

## Colors

**The Restrained Signal Rule.** Paper, fog, ink, and dividers carry almost the entire product. Marine marks primary action and selection. Mint is a small acknowledgement signal. Success, warning, danger, and info colors communicate state and must always travel with text or iconography.

**The Evidence Has No Glow Rule.** Sourced facts and uncertainty are separated through labels, hierarchy, and metadata—not decorative gradients or luminous effects. A page with more than one saturated focal area has failed the system.

The canonical implementation uses OKLCH for perceptual consistency; frontmatter contains its sRGB export for DESIGN.md tooling. Dark mode remaps surface and semantic roles rather than inverting pixels. White text is reserved for saturated primary and destructive buttons.

## Typography

**The Quiet Authority Rule.** Inter Variable is the single product voice. Weight and spacing, rather than decorative typefaces, establish hierarchy. Page titles are compact; body copy stays at the product scale; control labels are terse and confident.

**The Numbers Are Records Rule.** IBM Plex Mono is reserved for money, dates, counts, identifiers, checksums, shortcuts, and similarly scan-sensitive values. It is forbidden for explanatory prose or entire tables.

Use sentence case everywhere. Headings never become marketing display copy. Tabular numerals are required where vertically compared amounts or dates would otherwise shift.

## Elevation

**The Flat-by-Default Rule.** Structure comes from tonal layers, one-pixel dividers, and space. Sections do not become floating cards merely to create hierarchy.

**The Consequence Floats Rule.** Shadows belong only to dialogs, command surfaces, menus, toasts, and active drag states. The canonical dialog uses a short, dark structural shadow and a lightly blurred backdrop; ordinary records remain flat.

Focus elevation is a three-pixel marine-tinted ring outside the control border. It must remain visible in both themes and must never be replaced by a color-only border change.

## Components

**Buttons.** Primary buttons are marine with white labels and are reserved for one dominant commit action per region. Secondary buttons are paper with a strong divider. Quiet buttons reveal secondary commands without adding furniture. Destructive buttons use the danger role and always name the consequence. Every button supports hover, focus-visible, pressed, disabled, and loading states; pressed movement is a single pixel.

**Fields.** Inputs, textareas, and selects use paper, a strong divider, gently curved corners, and a minimum 40-pixel height. Labels precede controls; hints and errors remain associated in the accessibility tree. Focus adds the canonical ring. Error copy accompanies the danger border.

**Navigation.** Sidebar rows are compact, left-aligned, and icon-led. Hover uses strong fog; the active row uses selected sky, stronger ink, and weight—never a lone colored rail. The collapsed shell preserves tooltips or accessible names for every icon.

**Badges and state dots.** Pills are metadata, never calls to action. Their text names the state so color is redundant. State dots always appear with a label.

**Sections and tables.** A section is a titled reading group separated by a divider, not a generic card. Tables preserve semantic headers, readable row focus, stable money/date alignment, and a direct record link in the first cell.

**Pipeline cards.** Cards may appear inside the kanban because the record itself is draggable. They remain flat, compact, and bordered; check amounts use the data face, and the next action is separated at the bottom.

**Dialogs.** Native modal dialogs contain a fixed header, scrollable body, and consequence-ordered footer. Focus is trapped by the platform, Escape is supported unless an irreversible operation requires typed confirmation, and the opener regains focus on close.

**The Exact Approval Rule.** Any external send review must show the frozen recipient, subject, body, attachments, connector, suppression state, and approval boundary together. Success styling is prohibited before the durable send ledger records the result.

## Do's and Don'ts

### Do:

- **Do** keep the founder’s next safe action visible without hiding evidence or context.
- **Do** distinguish sourced facts, founder-entered facts, inferences, unknowns, and stale claims.
- **Do** make send approval, suppression, connector access, agent disclosure, and local-storage status unmistakable.
- **Do** preserve semantic HTML, keyboard completion, visible focus, reduced-motion behavior, and WCAG 2.2 AA contrast.
- **Do** use stable spatial structure and progressive disclosure for dense investor records.

### Don't:

- **Don't** reproduce generic CRM dashboards that turn every fact into a card and every workflow into configuration.
- **Don't** use AI-purple gradients, neon accents, glassmorphism, decorative agent theater, or chat-first interfaces that hide records.
- **Don't** use finance-terminal cosplay, navy-and-gold prestige styling, or dark-mode-only density.
- **Don't** borrow growth-hacking or bulk-email patterns that reward volume, vanity metrics, or unattended sequences.
- **Don't** make consequential outreach feel casual through consumer-playful styling.
- **Don't** use color alone, hover-only controls, placeholder-only labels, inaccessible drag-only actions, or invisible focus.
