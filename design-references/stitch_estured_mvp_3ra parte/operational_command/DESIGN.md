---
name: Operational Command
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434654'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fc'
  on-secondary-container: '#57657a'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d5e3fc'
  secondary-fixed-dim: '#b9c7df'
  on-secondary-fixed: '#0d1c2e'
  on-secondary-fixed-variant: '#3a485b'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 24px
  density-compact: 8px
  density-normal: 12px
---

## Brand & Style

The design system is engineered for high-stakes operational environments where data clarity and rapid decision-making are paramount. The brand personality is **precise, reliable, and authoritative**, evoking the feeling of a "Command Center." 

The visual style is **Corporate Modern with a High-Density focus**. It prioritizes information architecture over decorative elements, using a structured layout and a disciplined color palette to guide the user's eye through complex datasets. The interface remains "light" to reduce cognitive load during long sessions, while utilizing surgical precision in its alignment and iconography to reinforce a sense of professional oversight.

## Colors

The palette is anchored by **Command Blue**, a professional, high-trust primary hue that signifies action and primary navigation. Supporting this is a sophisticated range of **Slate Grays** used for secondary information and structural borders.

To support operational oversight, the design system employs a strict functional color logic:
- **Pending (Amber):** Signals "in-progress" states requiring attention but not immediate panic.
- **Approved (Emerald):** Confirms successful actions and "safe" system states.
- **Rejected (Rose):** Marks errors, denials, or stopped processes.
- **Urgent (Violet):** A distinct, high-contrast hue reserved for critical system alerts or high-priority escalations that must stand out from standard warnings.

Background surfaces utilize subtle off-whites and cool grays to differentiate "work areas" from "navigation areas."

## Typography

This design system utilizes **Plus Jakarta Sans** across all levels to maintain a clean, contemporary, and highly legible aesthetic. The typography is optimized for density; body sizes are slightly smaller than standard consumer apps (14px base) to allow more data to be visible on-screen simultaneously.

- **Headlines:** Use tighter letter spacing and heavier weights to create clear entry points into sections.
- **Data Mono:** While not a true monospace, specific tokens are provided for numerical data within tables to ensure maximum readability during scanning.
- **Label Caps:** Used for table headers and small metadata tags to provide hierarchy without consuming vertical space.

## Layout & Spacing

The layout follows a **12-column fluid grid** with a fixed-width sidebar for primary navigation. To achieve a high-density "Command Center" feel, the spacing rhythm is based on a **4px base unit**.

- **Gutters:** Standardized at 16px to maintain separation between dense data cards while maximizing horizontal space.
- **Density Toggles:** The system supports "Compact" and "Normal" views. In Compact mode, vertical padding in tables and lists drops to 8px, whereas Normal mode sits at 12px.
- **Sidebars:** Collapsible to 64px (icons only) or expanded to 240px to maximize the central workspace during data-intensive tasks.

## Elevation & Depth

To maintain a "clean" and "uncluttered" interface, this design system moves away from heavy shadows in favor of **Tonal Layering and Low-Contrast Outlines**.

- **Surface 0 (Background):** The primary page background (#F8FAFC).
- **Surface 1 (Cards/Containers):** Pure white surfaces with a 1px border (#E2E8F0) to define boundaries.
- **Surface 2 (Active/Hover):** Subtly tinted surfaces or very soft, diffused shadows (0px 2px 4px rgba(0,0,0,0.05)) used only for interactive elements or modals to indicate they sit above the primary plane.
- **Backdrop Blurs:** Used exclusively for modal overlays to keep the user's focus on the task at hand without losing the context of the dashboard behind it.

## Shapes

The design system adopts a **Soft (4px)** roundedness philosophy. This "precision" radius is chosen to feel modern and approachable while remaining structured enough for professional data environments. 

- **Standard Elements (Buttons, Inputs, Cards):** 4px (0.25rem).
- **Large Elements (Modals, Large Containers):** 8px (0.5rem).
- **Status Pills:** Utilize a slightly higher radius (12px) to distinguish them from interactive buttons and indicate their status as "read-only" tags.

## Components

### Data Tables
Tables are the heart of the system. They feature:
- Sticky headers with a 1px bottom border.
- Alternating row zebra-striping (optional) using a very light slate tint.
- Inline status badges for "Pending", "Approved", "Rejected", and "Urgent."

### Buttons
- **Primary:** Solid Command Blue with white text.
- **Secondary:** Slate outline with slate text.
- **Ghost:** No border, used for utility actions in tables to reduce visual noise.

### Status Badges
Small, non-interactive tags with low-opacity background tints and high-contrast text of the respective status color.

### Input Fields
Strict, rectangular (4px radius) fields with a 1px Slate-200 border. Focused states utilize a 2px Command Blue outline for high visibility.

### Metric Cards
Simple containers with a large Headline-MD value and a Label-Caps descriptor. Includes a small trend indicator (sparkline or percentage) to show operational health at a glance.