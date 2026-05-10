---
name: sasha-kuznetsov-design
description: Use this skill to generate well-branded interfaces and assets for Sasha Kuznetsov (skz.dev), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping in Sasha's brand language — minimal hacker portfolio, pure black + white + a single accent green, Montserrat Light, full-bleed Three.js particle field.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

Start with these files:
- `README.md` — voice, visual foundations, iconography, open questions.
- `colors_and_type.css` — every color, type, spacing, radius, and motion token. Always include this stylesheet in any artifact you produce.
- `ui_kits/portfolio-site/` — canonical React recreations: `NameCard`, `GlossyButton`, `SocialRow`, `ParticleWave`. Copy these directly rather than rebuilding them.
- `assets/icons/social/` — the dark social PNGs used in the hero row.
- `assets/brand/` — favicon, og-banner, preview banner.
- `preview/` — Design System tab specimen cards (good visual reference, not for direct use).
- `_source/` — the original `skzv/my-site` files, kept for reference.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.

Key principles to embody:
- **The dark IS the brand.** Pure `#000` background, no light mode.
- **One accent.** `#03af60` green. Don't introduce a second.
- **One weight.** Montserrat Light (300) — hierarchy comes from size and letter-spacing, never weight.
- **No emoji, no decorative unicode, no marketing hyperbole.** First-person, dry, factual.
- **Slow, quiet motion.** `.5–.6s ease`. The signature is the glossy sweep on buttons.
- **Remove more than you add.** When in doubt, take something away.
