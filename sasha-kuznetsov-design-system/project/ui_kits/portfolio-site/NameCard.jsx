// NameCard.jsx — the translucent-white capsule at the heart of the site.
// Composes heading + vertical button stack + horizontal social row.
function NameCard({ name, ctas = [], socials }) {
  return (
    <div className="sk-namecard">
      <h1>{name}</h1>
      <div className="sk-button-stack">
        {ctas.map((c, i) => (
          <GlossyButton key={i} as="a" href={c.href} variant={c.variant || 'green-on-black'}>
            {c.label}
          </GlossyButton>
        ))}
      </div>
      <SocialRow items={socials || SocialRow.DEFAULT_ITEMS} />
    </div>
  );
}

window.NameCard = NameCard;
