// GlossyButton.jsx — the signature button.
// Glossy sweep on hover; transparent over a colored ground.
// Variants: "green-on-black" (the production btn-glossy.btn-black.inverse),
// "ghost" (1px white outline). Pass `as="a"` to render an anchor.
function GlossyButton({
  children,
  variant = 'green-on-black',
  as = 'button',
  href,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) {
  const cls = `sk-btn sk-btn--${variant} ${className}`.trim();
  if (as === 'a') {
    return (
      <a href={href} className={cls} onClick={onClick} {...rest}>
        <span>{children}</span>
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} {...rest}>
      <span>{children}</span>
    </button>
  );
}

window.GlossyButton = GlossyButton;
