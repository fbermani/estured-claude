---
name: EstuRED University Focus
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dadf'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ee'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#404752'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#717784'
  outline-variant: '#c0c7d4'
  surface-tint: '#005fac'
  primary: '#005da8'
  on-primary: '#ffffff'
  primary-container: '#0076d2'
  on-primary-container: '#fdfcff'
  inverse-primary: '#a4c9ff'
  secondary: '#446085'
  on-secondary: '#ffffff'
  secondary-container: '#b7d3fe'
  on-secondary-container: '#3f5b80'
  tertiary: '#8e4a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b25f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a4c9ff'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#004884'
  secondary-fixed: '#d3e4ff'
  secondary-fixed-dim: '#acc8f3'
  on-secondary-fixed: '#001c38'
  on-secondary-fixed-variant: '#2b486c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77e'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
  background-light: '#f6f7f8'
  background-dark: '#101922'
  accent-green: '#e6f4f1'
  success-green: '#16a34a'
  card-border: '#dbe0e6'
  text-muted: '#617589'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 60px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.033em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
  label-xs:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1120px
  section-padding-lg: 6rem
  section-padding-md: 3rem
  gutter: 1.5rem
  stack-gap: 1rem
  element-gap-sm: 0.5rem
---

## Brand & Style

The EstuRED brand identity is built on **trust, clarity, and safety**. It targets university students and their families navigating the transition to independent living. The visual style is **Corporate Modern with a Friendly Edge**, utilizing a "Fidelity" color variant that feels professional yet approachable.

The aesthetic leverages high-quality lifestyle photography paired with a clean, structured layout. It avoids the coldness of traditional real estate platforms by using soft rounded corners, subtle glassmorphism in headers and badges, and a balanced mix of professional blues and comforting accent greens. The emotional goal is to replace the "uncertainty" of distance booking with a sense of "verified security."

## Colors

The palette is anchored by **EstuRED Blue (#2b8cee)**, which signifies stability and institutional trust. 

- **Primary**: Used for key actions, brand iconography, and highlights.
- **Secondary**: A muted slate blue used for secondary information and fixed UI elements.
- **Surface & Background**: A light-grey base (#f6f7f8) provides a soft alternative to pure white, reducing eye strain. 
- **Accent Green**: Used specifically for "Context & Verification" signals, creating a semantic link between the color green and the "Verified" status of a residence.
- **Dark Mode**: The interface transitions to a deep navy-charcoal (#101922) with high-contrast white text, maintaining the same primary brand blue.

## Typography

**Plus Jakarta Sans** is the sole typeface, chosen for its modern, geometric shapes that remain highly legible at small sizes. 

- **Hierarchical Contrast**: We use extreme weight variance (from 400 to 800) to create clear information architecture. 
- **Display Type**: Hero headlines use 'Black' weight (800) and negative letter-spacing for a bold, editorial feel.
- **Scale**: On mobile devices, `display-lg` (60px) should scale down to 36px to ensure readability without excessive scrolling.
- **Semantic Usage**: Labels and "Next Steps" utilize the boldest weights to guide the user's eye toward calls to action.

## Layout & Spacing

The system uses a **Fixed Grid** approach for desktop content, centered with a maximum width of 1120px to maintain comfortable line lengths for reading.

- **Vertical Rhythm**: Large sections are separated by significant whitespace (80px to 96px) to define distinct phases of the user journey.
- **Responsive Behavior**:
  - **Desktop**: 12-column grid with 24px gutters.
  - **Tablet**: 8-column grid with 20px margins.
  - **Mobile**: Single column with 16px side margins and stacked components.
- **Search Component**: Special 3-column split for the search bar on desktop, reflowing to a vertical stack on mobile to maintain touch-target accessibility.

## Elevation & Depth

The design utilizes **Ambient Depth** rather than traditional skeuomorphism. 

1.  **Surface Tiers**: The primary background is neutral (#f6f7f8). White (#ffffff) is used for "Elevated" cards and containers to create a natural lift.
2.  **Shadows**: We use a multi-tiered shadow system:
    - `shadow-sm`: Used for small interactive elements like buttons.
    - `shadow-md`: Used for standard cards.
    - `shadow-xl`: Reserved for the primary search bar and hover states to denote high interactivity.
3.  **Glassmorphism**: Backdrop blurs (10px - 12px) are used on the sticky header and decorative badges over imagery to maintain legibility while preserving the sense of background context.

## Shapes

The shape language is **Rounded and Friendly**. 

- **Standard Elements**: Buttons and inputs use `0.5rem` (rounded-lg) for a modern, soft feel.
- **Large Containers**: Section cards and featured containers use `1rem` (rounded-xl) or `1.5rem` (rounded-3xl) to enclose complex information within a soft frame.
- **Badges**: Status indicators and small tags use `full` (pill-shaped) rounding to distinguish them from interactive buttons.
- **Icons**: Icons are enclosed in rounded-lg squares or full-circles with background tints to create "Stamps of quality."

## Components

### Buttons
- **Primary**: Solid #2b8cee with white text. Bold weight. 0.5rem radius.
- **Secondary/Ghost**: White background with 1px gray-200 border. Subtle hover transition to gray-50.

### Input Fields
- **Search Style**: Minimalist, borderless inputs inside a parent container with 1px dividers. Uses Material Symbols as leading icons in gray-400.

### Cards
- **Residence Cards**: Image-heavy with a fixed height aspect ratio. Information is bottom-aligned with a distinct price highlight in Primary Blue. Includes a tag-tray for "Signal" attributes (e.g., "Ambiente tranquilo").
- **Feature Cards**: Icon-led with background-tinted circles. Title in Bold, Body in Muted Text (#617589).

### Badges & Tags
- **Verification Badge**: White or black translucent background with Primary Blue text, positioned in the top-left of images.
- **Context Tags**: Low-saturation background tints (Green, Blue, Orange) with high-saturation text for categorized metadata.

### Accordions
- **Details Component**: Clean, border-led containers with `expand_more` icons. Internal content uses a subtle top-border to separate the summary from the detail.