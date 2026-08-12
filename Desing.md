---
version: "alpha"
name: "Taskora SaaS Hero"
description: "Dark SaaS hero with background video at opacity-50 and gradient overlay fading to background color. Ideal for produtos saas, plataformas de gestão de projetos, ferramentas de produtividade, dashboards analíticos. AI-ready template."
colors:
  primary: "#050505"
  secondary: "#FFFFFF"
  tertiary: "#9CA3AF"
  neutral: "#3B82F6"
  surface: "#F9F9FA"
  accent: "#22C55E"
typography:
  h1:
    fontFamily: Manrope
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: 400
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    padding: 12px
---

## Overview

Dark SaaS hero with background video at opacity-50 and gradient overlay fading to background color. Ideal for produtos saas, plataformas de gestão de projetos, ferramentas de produtividade, dashboards analíticos. AI-ready template. The dark-mode SaaS hero with a floating dashboard mockup didn't appear out of nowhere — it was a slow convergence of several forces. Around 2018-2019, tools like Linear, Notion, and Vercel started shipping dark interfaces as their primary brand expression, not as an accessibility toggle. The message was clear: dark means professional, focused, built for people who actually use software all day. The dashboard mockup sitting at an angle below the headline became the visual proof that replaced generic stock photography.

By 2021, this pattern had calcified into the default B2B SaaS hero. Every productivity tool, every dev platform, every analytics dashboard adopted the same formula: bold sans-serif headline, one-liner value prop, CTA button with a subtle glow, and a perspective-shifted screenshot floating on a dark gradient. It works because it answers the buyer's first question — "what does this thing actually look like?" — without requiring them to sign up.

The pattern persists because it's honest. Unlike lifestyle imagery or abstract illustrations, a real product screenshot signals confidence. You're showing the work. The dark background creates natural contrast hierarchy and makes the UI feel premium, even when the product itself is still rough around the edges.

- Density: 8/10 — Dense
- Variance: 4/10 — Moderate
- Motion: 8/10 — Cinematic

- **Style:** SaaS, Dark Mode, Dashboard Preview, Staggered Animations
- **Keywords:** SaaS, dark mode, dashboard mockup, staggered animations, Framer Motion, glassmorphism navbar, Instrument Serif italic, product shot, badge com estrela
- **Era:** 2024-2026 SaaS Product-Led
- **Light/Dark:** ✗ Not Recommended / ✓ Full

## Colors

- **Preto Base** (#050505) — Primary background surface
- **Branco** (#FFFFFF) — Light surface, card backgrounds
- **Cinza Texto** (#9CA3AF) — Primary text color
- **Azul Gradiente** (#3B82F6) — Accent highlight, links and focus states
- **Dashboard Claro** (#F9F9FA) — Extended palette, decorative use
- **Verde Trend** (#22C55E) — Success states, positive indicators
- **Vermelho Trend** (#EF4444) — Error states, destructive actions
- **Vidro Navbar** (rgba(255,255,255,0.1)) — Extended palette, decorative use


## Typography

- **Display / Hero:** Manrope — Weight 700, tight tracking, used for headline impact
- **Accent:** Instrument Serif — Used for decorative or emphasis text
- **Body:** Manrope — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Manrope — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem


## Layout

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).


## Elevation & Depth

VÍDEO: Vídeo abstrato escuro com partículas luminosas ou formas geométricas flutuantes em tons de azul e roxo sobre fundo preto. Movimento sutil e orgânico criando atmosfera tecnológica e sofisticada. Exibido com opacity 50% e gradient overlay (black/60 para #050505) que funde suavemente o vídeo no fundo escuro da página. | EFEITOS CSS: Vídeo de fundo com opacity-50 e gradient overlay (black/60 para #050505), navbar flutuante pill glassmorphism (bg-white/10, backdrop-blur-md), animações staggered de entrada (fade-up + slide) via Framer Motion, headline massiva com palavra em Instrument Serif italic, dashboard mockup light mode contrastando com hero dark, badge pill com ícone estrela gradiente azul

- **Physics:** Spring — stiffness 120, damping 20. Confident, weighted transitions.
- **Entry animations:** Fade + translate-Y (16px → 0) over 540ms ease-out. Staggered cascades for lists: 120ms between items.
- **Hover states:** Scale(1.03) + shadow lift over 200ms.
- **Page transitions:** Fade + slide (300ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.


## Shapes

Base corner radius: 8px. See rounded tokens in front matter for the full scale.


## Components

- **Primary Button:** Subtly rounded (0.5rem) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Subtly rounded (0.5rem) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.


## Do's and Don'ts

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No pure white (#FFFFFF) backgrounds — use off-white or dark surfaces
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

- Do Vídeo de fundo opacity-50 com gradient overlay
- Do Navbar flutuante pill glassmorphism
- Do Badge pill com estrela gradiente
- Do Headline massiva com palavra em serif italic
- Do Animações staggered de entrada
- Do Dashboard mockup light mode
- Do Mobile hamburger glassmorphism
- Do Responsivo


## Use Case

Products SaaS, Platforms de gestão de projects, Tools de produtividade, Dashboards analíticos
