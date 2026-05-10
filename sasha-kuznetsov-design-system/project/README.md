# Sasha Kuznetsov — Design System

> *"Personal site of Sasha Kuznetsov — software engineer, physicist, and hacker."*

A design system distilled from [skz.dev](https://skz.dev), Sasha's personal landing page. It is **intentionally tiny** — the source product is one screen — so this system codifies a *style of restraint* more than a sprawling component library.

If you're prototyping for Sasha, lean into the same restraint: one screen, one accent, one weight, deep black behind everything.

---

## What this brand is (and isn't)

**Is:**
- A single hero landing page at [skz.dev](https://skz.dev) — Jekyll static site, no framework.
- A name card centered over a full-bleed, mouse-reactive **3D particle wave** rendered with Three.js.
- A links hub: email, blog ([blog.skz.dev](https://blog.skz.dev)), LinkedIn, Medium, GitHub, Twitter, Instagram.
- Personal-bio adjacent to a serious technical résumé — *physicist, engineer, hacker*.

**Isn't:**
- A product. There is no app, no signup, no marketing funnel.
- A dark *theme* — the dark IS the brand. There is no light mode.
- A heavy visual system. There are no illustrations, no patterns, no gradients in the production page. The only "visual" is the WebGL field.

---

## Sources

This system was built from the following authoritative sources:

| Source | Path | Notes |
|---|---|---|
| Repo: [`skzv/my-site`](https://github.com/skzv/my-site) | `_source/` | Imported HTML, CSS, social PNGs, banner. The full Jekyll layout, button system, and Three.js setup all live here verbatim. |
| Production site | https://skz.dev | The deployed result. |
| Blog (separate) | https://blog.skz.dev | A different repo (`skzv/my-plain-blog`). Not styled here. |

Imported files sit under `_source/` for reference and are **not** intended to be edited from this project.

---

## Index

```
.
├── README.md                  ← you are here
├── SKILL.md                   ← skill manifest (so this folder works as a Claude Skill)
├── colors_and_type.css        ← all tokens: color, type, spacing, radii, motion
├── _source/                   ← raw imports from skzv/my-site (read-only reference)
├── assets/
│   ├── brand/                 ← favicon, og-banner, preview image
│   └── icons/social/          ← LinkedIn, Medium, GitHub, Twitter, Instagram, Stack Overflow (dark PNGs)
├── fonts/                     ← (none — Montserrat is loaded from Google Fonts)
├── preview/                   ← Design System tab cards (registered as assets)
└── ui_kits/
    └── portfolio-site/        ← React recreation of skz.dev (the only product)
        ├── README.md
        ├── index.html
        └── *.jsx              ← NameCard, GlossyButton, SocialRow, ParticleWave, …
```

The `preview/` folder is for the **Design System tab** — small specimen cards. You shouldn't edit them by hand; they're built off `colors_and_type.css` and the UI kit components.

---

## CONTENT FUNDAMENTALS

This is a one-person personal brand. The voice is **first-person, dry, factual, low-key**. Not playful, not corporate, not branded.

### Voice

- **First-person** when speaking about himself (`"my CV"`, `"my blog"`, `"my background in physics"`). The site never addresses the reader as "you" — there are no marketing pronouns.
- **Direct verbs, imperative for CTAs.** `"Get in touch."` `"Check out my blog."` `"Download my CV."` Each one is 3–4 words.
- **Quietly self-assured.** The descriptor "software engineer, physicist, and hacker" is stated once, in a meta tag, never bragged about.
- **Lowercase, no exclamation.** No `!`, no `?`. Periods only if needed; CTAs are often unpunctuated.
- **No marketing hyperbole.** No "amazing", "incredible", "unlock", "supercharge", "revolutionize". The README states the design goal plainly: "The aim is to keep things simple."

### Casing

- **Title Case** for the name and headings (`"Sasha Kuznetsov"`).
- **Sentence case** for buttons and links (`"Get in touch"`, not `"Get In Touch"` or `"GET IN TOUCH"`).
- The CSS *has* a commented-out `text-transform: uppercase` on buttons — meaning he tried it and rejected it. Don't use ALL-CAPS for UI labels.

### Tone examples

- Hero name: `Sasha Kuznetsov`
- Hero CTAs: `Get in touch` · `Check out my blog` · (legacy) `Download my CV` · `See my resume`
- Meta description: *"Personal site of Sasha Kuznetsov — software engineer, physicist, and hacker."*
- Repo blurb: *"My main homepage."*
- README rationale: *"The aim is to keep things simple. An email link and a link to my blog, above a row of social media links."*
- Animation rationale: *"a sea of oscillating particles, generated with three.js — provides a slick backdrop while alluding to my background in physics."*

### Emoji & symbols

- **No emoji.** None on the site, none in the README, none in commit messages of substance.
- **No decorative unicode.** No `→`, `•`, `★`. The em-dash (`—`) appears in prose only.
- **Punctuation as separator** in metadata strings (e.g. `software engineer, physicist, and hacker`).

### The vibe in one line

> Minimalist hacker portfolio. A name, a way to reach me, a few links, and a quiet piece of math running in the background.

---

## VISUAL FOUNDATIONS

### The page, in one sentence

A fixed-position translucent-white capsule, centered ~40% from the top of the viewport, sitting over a full-bleed pure-black canvas filled with a slowly oscillating grid of ~40,000 white particles that follows the cursor.

### Colors

| Token | Value | Where it's used |
|---|---|---|
| `--bg` / `--color-black` | `#000000` | Page background. Always. There is no light mode. |
| `--fg` / `--color-white` | `#ffffff` | Particle color. All text on the dark background. |
| `--surface-glass` | `rgba(255,255,255,0.60)` | The name-card surface. The site's one piece of "chrome." |
| `--fg-on-glass` | `#000000` | Heading and label text on the glass card. |
| `--accent-green` | `#03af60` | **The only brand accent.** Button text on dark, button hover fill on light, the glossy sweep. |
| `--color-dark` | `#292929` | The black-button hover bg. Reads as "lifted black." |
| `--accent-tan` | `#a99261` | A secondary "btn-lighter" accent, defined but barely used. Treat as legacy. |
| `--color-outline` | `#464646` | Border on the `btn-outline` style. |
| `--accent-link-yellow` | `#ffff00` | Old `<a>` color from the global stylesheet. Only relevant inside blog markdown — **don't use it for UI links.** |

**Vibe of imagery:** the only "imagery" in production is the WebGL particle field, which is cool, monochrome, geometric, and infinite. Photographic imagery is not part of the brand. If you need to add a photograph, push it heavily toward **monochrome / desaturated / cool grain** so it sits alongside the particle field without fighting it.

### Type

- **Family:** `Montserrat`. Loaded from Google Fonts. No fallback brand font.
- **Weight:** `300` (Light). One weight, everywhere. Heavier weights are explicitly *not* loaded in production (the 100/200 import is commented out — only 300 ships).
- **Hierarchy comes from size and letter-spacing**, never from boldness. A heading is a *bigger* Montserrat Light, not a heavier one.
- **Body size is small** (13px, `line-height: 24px`) — appropriate for a site that has almost no body copy.
- **Button text is tracked open** (~`0.08em` / 1.2px on 14px) to feel deliberate without going all-caps.
- **No italics.** No `<em>`-heavy prose styling.

### Layout rules

- **Single fixed centered element.** The name-card uses `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);` then nudges `top: 40%` so the card sits slightly above optical center. The card is the *only* layout primitive in production.
- **Full-bleed black canvas behind everything**, with `body { overflow: hidden; }` — the page is non-scrolling. No header. No footer. No nav.
- **No grid.** The card is intrinsic-sized; buttons are fixed `width: 300px` (250px under 400px viewport).
- **One narrow breakpoint** at 400px (button shrinks) and a soft 1000px breakpoint (kept at 40% top). Nothing fancier.

### Backgrounds, patterns, illustration

- **Background:** pure black + WebGL particle field. No textures, no noise, no gradient washes.
- **Patterns / repeating motifs:** none in production.
- **Illustrations:** none. The brand explicitly has no illustration style.
- **Photography:** none in production. If introduced, see "vibe of imagery" above.
- **Use of imagery in marketing artifacts** (e.g. open-graph banner): a simple flat-color preview with the name and three socials. See `assets/brand/preview-banner.png`.

### Borders

- Buttons in the outline state use a **1px solid** border in the button's color (or `transparent` on `btn-glossy.inverse`).
- The name-card has **no border** — depth comes from the translucent fill, not a stroke.
- Border radius scale is two-step: `3px` (buttons, near-sharp) and `25px` (the card capsule). There is no "medium" radius.

### Shadows & elevation

- **Production uses no shadows at all.** Depth comes entirely from the WebGL field behind the card.
- Reserved tokens (`--shadow-card`, `--shadow-glow`) exist for new surfaces but should be used sparingly.

### Transparency & blur

- The name-card is `rgba(255,255,255,0.60)` — 60% white over black. It reads as **frosted glass**, but importantly there is **no `backdrop-filter: blur()`** in the production CSS. The translucency is honest — you can see particles through it. (You may *add* a subtle blur for UI clarity in new screens, but document it as a deviation.)
- Transparency is used in exactly **one** place: this card. Don't bolt translucency onto every surface.

### Animation

- **Continuous, ambient motion** in the particle field. Z and scale oscillate via stacked sines (`sin(ix * 0.3) + sin(iy * 0.5)`). It never stops, never crescendos.
- **Camera follows cursor** with eased lerp (`+0.05` per frame) — slow, dreamy, never snappy.
- **Hover transitions are long.** Buttons transition `.6s ease` — color and background fade in unhurriedly. Resist the urge to make them snappy.
- **The signature interaction:** the **glossy sweep** on every button. A diagonal bar (`skew(-20deg)`) of the button's accent color slides in from the left on hover (`.5s ease`), wiping behind the label. The label color crossfades from white to green (or green to white in the inverse). This sweep is *the* brand motion.
- **No bounces, no springs, no overshoot.** Everything is `ease`, never `cubic-bezier` with overshoot.
- **No entrance animations.** The page loads, the particles start oscillating, that's it.

### Hover states

- **Buttons:** glossy sweep (see above). Color and bg crossfade `.6s`.
- **Social icons:** `transform: scale(1.5)` — a notable exception to the "slow and quiet" rule. Quick, no transition curve specified (so it snaps). This is intentional — feels playful.
- **Links in body copy (legacy/blog only):** `text-decoration: underline` on hover. No color change.
- **No `:active` press state** is defined. Buttons don't shrink or darken on press.
- **No focus-visible ring** is defined either — be aware this is an accessibility gap to address in any production extension of the system.

### Cards

There is exactly one card pattern: the **name-card**.

- Fill: `rgba(255,255,255,0.60)`
- Radius: `25px`
- Padding: `30px` around children
- No border, no shadow, no backdrop blur
- Children: an `h1`, a vertical stack of buttons (each 300px wide, `30px` top margin), then a horizontal row of social icons (40px, `30px` vertical margin, space-between).

### Spacing

A loose 4px grid extracted from observed values. Common values that recur:

- `4 · 8 · 12 · 16 · 20 · 24 · 30 · 40 · 60 · 80`
- The dominant rhythm is **`30px`** — card padding, button vertical spacing, button horizontal margin. Use it as the "default gap."

### Density & rhythm

- **Generous vertical breathing room.** Buttons have `22-23px` vertical padding (tall) and `35px` horizontal padding.
- **Tight horizontal rhythm** within rows: social icons sit `space-between` inside the card width.
- **One element per row.** Multi-button rows are stacked vertically, not laid side-by-side.

### What the brand explicitly is NOT

When extending the system, *avoid* these — they would break the voice immediately:

- Gradients (especially purple/blue).
- Drop shadows on cards.
- Rounded-corner cards with colored left borders.
- Emoji decoration.
- More than one accent color.
- Bold/semibold weights as a hierarchy tool.
- Hand-drawn illustrations, sticker art, glassmorphism stacks.
- Hero photography of a person.

---

## ICONOGRAPHY

The site uses **a small set of dark monochrome PNG social icons** and nothing else. There is no icon font, no SVG sprite, no Heroicons / Lucide / Phosphor / Feather dependency.

### What's shipped

| Icon | File | Use |
|---|---|---|
| LinkedIn | `assets/icons/social/linkedin.png` | hero row |
| Medium | `assets/icons/social/medium.png` | hero row |
| GitHub | `assets/icons/social/github.png` | hero row |
| Twitter (legacy bird) | `assets/icons/social/twitter.png` | hero row |
| Instagram | `assets/icons/social/instagram.png` | hero row |
| Stack Overflow | `assets/icons/social/stack-overflow.png` | imported but **not used** (commented out in `_source/index.html`) |

All are dark/black PNGs sized to render at **40×40 px**. They are flat, single-color, no outline rings.

### Usage rules

- **Always 40px wide** in the hero card. Don't resize down to 24px in this design language — they're not legible.
- **Hover state:** `transform: scale(1.5)` on the `<img>` itself. No tooltip, no color change.
- **Spacing:** the row uses `display: flex; justify-content: space-between` and consumes the full card width. First and last have an extra `30px` outer margin.
- **No labels.** Brand recognition does all the work. Don't add `aria-hidden` though — keep the `alt` text (`"LinkedIn"`, `"Medium"`, etc.) for screen readers, matching the original markup.

### When you need a non-social icon

The brand has **no opinion** on this — it has never needed one. If a new screen requires a UI icon (search, close, chevron, etc.), the recommendation is:

1. **Use [Lucide](https://lucide.dev) at `stroke-width: 1`** — 1px strokes match the Montserrat 300 weight better than the more common 1.5/2. Treat this as a **flagged substitution** and document it.
2. Color them with `currentColor` so they pick up `--fg` or `--accent-green` depending on context.
3. Size at **20px or 24px** for inline UI. The 40px social icons are a hero-only treatment.
4. Never use emoji as icons. Never use unicode chars (`✓`, `→`, `★`) as icons.

> ⚠️ **Substitution flag:** The original site does not use Lucide. Recommending it as the icon family of choice is a *new decision* introduced here for any non-social UI work. Sasha should confirm or replace this choice.

### Font

> ⚠️ **Substitution note:** No `.ttf`/`.woff` files were committed to the source repo — Montserrat is loaded from Google Fonts via `@import` in `css/main.css`. This design system follows the same approach (Google Fonts import in `colors_and_type.css`). If you need offline font files, please supply the official Montserrat 300 / 400 / 500 weights and drop them into `fonts/`.

---

## How to use this system

1. **Read this README.** It captures the *spirit* — the system is small enough that the spirit matters more than the spec.
2. **Link `colors_and_type.css`** at the top of any new design.
3. **Reuse the `ui_kits/portfolio-site/` components** (`NameCard`, `GlossyButton`, `SocialRow`, `ParticleWave`) directly. They are the canonical implementations.
4. **When in doubt, take something away.** This brand removes more than it adds.

---

## Open questions for Sasha

Areas where the source product didn't tell us enough — please confirm before shipping anything new:

1. **Light mode?** The system assumes no light mode exists. Confirm.
2. **Form inputs?** None exist in the source. If a new screen needs an input, what's the look — a translucent-glass field on dark? A flat black field with a green caret?
3. **Long-form text style?** Body copy on this site is essentially absent. The blog ([blog.skz.dev](https://blog.skz.dev)) is a separate repo with a different theme.
4. **Icon family** — see flagged substitution above.
5. **Stack Overflow icon** — kept in assets (it's imported, just commented out). Should it be re-enabled?
