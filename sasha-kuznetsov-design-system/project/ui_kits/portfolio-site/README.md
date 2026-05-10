# Portfolio Site — UI Kit

A faithful React recreation of [skz.dev](https://skz.dev). This is *the* product Sasha ships, so this is the only UI kit in the system.

It is a recreation, not a rewrite. Components mirror the original DOM and CSS one-for-one; the only "new" thing here is that the buttons and social row are factored out so you can reuse them.

## What's in the box

| File | What it does |
|---|---|
| `index.html` | A click-through demo. Default mode = exactly what ships. Two alternate modes (`With CV`, `With résumé`) toggle the commented-out CTAs from the source. |
| `styles.css` | Component CSS, scoped under `.sk-*` classes. Imports `colors_and_type.css`. |
| `ParticleWave.jsx` | The Three.js field. Verbatim port of the script in `_source/index.html`. Loads `three@0.128.0` from Skypack at runtime. |
| `NameCard.jsx` | The translucent capsule. Composes heading + button stack + social row. |
| `GlossyButton.jsx` | The signature button with its sliding `:before` sweep. Variants: `green-on-black` (default), `ghost`. |
| `SocialRow.jsx` | The 40px PNG row. Exposes `SocialRow.DEFAULT_ITEMS` (LinkedIn, Medium, GitHub, Twitter, Instagram). |

## What's faithful vs. what's new

- **Faithful:** layout, sizing, colors, the particle simulation (same `sin(ix * 0.3) + sin(iy * 0.5)` displacement, same mouse-eased camera, same 200×200 grid).
- **Faithful:** button glossy sweep, including the `.5s ease`, `skew(-20deg)`, and the white/green crossfade.
- **Faithful:** social row spacing (`space-between` inside the card), 40px icons, `scale(1.5)` hover.
- **New / cosmetic:**
  - The mode switcher in the bottom-left corner is *only* part of this demo — it is not brand.
  - The `name-card` heading uses 32px here instead of the source's default `h1` size, to keep the card sized predictably across viewports. The original tightly inherits from a global `h1`.
  - Three.js is dynamically imported inside a React effect; the source's IIFE was inlined.

## Usage from outside this kit

```jsx
import './ui_kits/portfolio-site/styles.css';

<NameCard
  name="Sasha Kuznetsov"
  ctas={[
    { label: 'Get in touch',      href: 'mailto:me@skz.dev' },
    { label: 'Check out my blog', href: 'https://blog.skz.dev' },
  ]}
/>
```

Put a `<ParticleWave />` first if you want the full hero. The card is `position: fixed` and will pin itself centered, so it works regardless of what else is on the page.

## Caveats

- The hover crossfade on the glossy sweep uses a `<span>` over a colored background; some CSS edits to `.sk-btn` will silently break it. Edit through the variant classes when possible.
- The particle field consumes a noticeable amount of GPU. For preview cards we render a stripped-down version (or omit it entirely).
- Touch input is supported but slightly less smooth than the desktop mouse path.
