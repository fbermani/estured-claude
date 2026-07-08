---
name: EstuRED Core
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#bcc7de'
  on-tertiary: '#263143'
  tertiary-container: '#8691a7'
  on-tertiary-container: '#1f2a3c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-xl:
    fontFamily: EB Garamond
    fontSize: 72px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  button-text:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 32px
  margin-desktop: 80px
  margin-mobile: 20px
  mosaic-gap: 16px
---

## Brand & Style
The design system is rooted in the concept of "Organic Professionalism." It balances the high-stakes trust required for student housing and education with a fluid, human-centric aesthetic that feels alive rather than institutional. The target audience—students seeking independence and parents seeking security—is met with an interface that feels like a premium editorial magazine crossed with a high-end architectural portfolio.

The style is a hybrid of **Minimalism** and **Glassmorphism**, utilizing asymmetrical layouts to break the monotony of standard SaaS grids. It evokes a sense of "Structured Fluidity"—where information is organized with military precision but presented with artistic flair. The UI should feel like a physical space: deep, layered, and tactile.

## Colors
This design system utilizes a "Midnight Luxe" palette. The foundation is **Deep Charcoal (#121212)**, providing a void-like depth that allows vibrant accents to pop without causing eye strain. 

- **Primary (Electric Blue):** Used for primary actions and "pathfinding" elements (active states, progress bars).
- **Secondary (Emerald):** Reserved for high-trust indicators, success states, and "Premium/Verified" housing badges.
- **Surface (Slate Blue):** Used for elevated containers and glassmorphic backgrounds to create separation from the base layer.
- **Gradients:** Use subtle mesh gradients combining Slate Blue and Electric Blue for background blurs to reinforce the organic, fluid feel.

## Typography
The typography strategy employs a "High-Contrast Pairing" to signal both tradition and innovation. 

- **Headlines:** **EB Garamond** provides an editorial, prestigious feel. Use it for storytelling, student testimonials, and large section headers. It should always be set with tight tracking to maintain a modern look.
- **Body & UI:** **Hanken Grotesk** offers a sharp, technical counterpoint. Its high legibility is essential for complex data like lease terms, pricing, and amenities.
- **Special Case:** Use `label-caps` for small metadata, like "Available Now" or "Verified Residence," to provide a technical, architectural feel.

## Layout & Spacing
The layout ignores standard symmetrical grids in favor of a **Fluid Mosaic Model**. 

- **Mosaic Layouts:** Instead of standard cards, use a 12-column grid where items span asymmetrical proportions (e.g., 7 columns for a featured image, 5 columns for text, followed by 4/4/4 for small details).
- **Timeline Visuals:** Use a vertical "thread" (1px Electric Blue line) to connect modular sections for "Process" steps (e.g., Application -> Approval -> Move-in).
- **Asymmetry:** Every second section should be horizontally flipped or offset by one grid unit to keep the user engaged while scrolling.
- **Safe Areas:** Large margins (80px+) are required on desktop to allow the background glassmorphism and blurs to "breathe."

## Elevation & Depth
This design system uses **Tonal Glassmorphism** rather than traditional drop shadows. 

- **Base Layer:** Deep Charcoal (#121212).
- **Surface Layer:** Slate Blue (#1E293B) at 40-60% opacity with a 20px backdrop blur.
- **Interactive Layer:** Elements that are clickable should have a 1px "inner glow" border (white at 10% opacity) on the top and left sides to simulate a light source from the top-left.
- **Depth Hierarchy:** Higher elevation is communicated through increased background blur and slightly lighter fill color, never through heavy black shadows.

## Shapes
Shapes are "Organic but Controlled." While the system uses a base roundedness of 0.5rem (8px), it heavily features **Custom Asymmetric Radii**. 

For example, a featured "Residence Card" might have a `32px` radius on the top-left and bottom-right, with `8px` on the others. This creates a "leaf" or "organic shard" shape that feels unique to the brand. Interactive buttons use pill shapes to contrast against the more angular, shard-like containers.

## Components
- **Buttons:** Primary buttons are pill-shaped with an Electric Blue to Emerald gradient. On hover, the gradient should "breathe" (expand via scale). Secondary buttons are "Ghost" style with a glass background and thin border.
- **Mosaic Cards:** These are the primary content drivers. They never use icons in the top-left. Instead, they use large typography overlapping a portion of a high-quality architectural image. Content is layered using z-index—text might bleed over an image's edge.
- **Timeline Nodes:** Used for the student journey. Each node is a small glass orb that glows when the user reaches that step in the scroll.
- **Input Fields:** Minimalist. Only a bottom border that transforms into a full Electric Blue glow when focused. Labels use the `label-caps` style for a technical look.
- **Chips/Badges:** Small, high-contrast pills (Emerald background with black text) for "Immediate Occupancy" or "Parent-Verified."
- **Residence Scrollers:** Horizontal carousels that use a "Peek" effect, where the next card is partially visible to encourage exploration.