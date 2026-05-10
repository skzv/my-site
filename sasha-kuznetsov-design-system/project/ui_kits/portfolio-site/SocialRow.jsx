// SocialRow.jsx — the flex row of 40px dark PNG icons under the buttons.
// Pass items as { href, src, alt }. Order is preserved.
function SocialRow({ items, className = '' }) {
  return (
    <div className={`sk-social ${className}`.trim()}>
      {items.map((it) => (
        <a key={it.alt} href={it.href} target="_blank" rel="noopener noreferrer">
          <img src={it.src} alt={it.alt} />
        </a>
      ))}
    </div>
  );
}

// Default social set from skz.dev (in production order).
SocialRow.DEFAULT_ITEMS = [
  { href: 'https://www.linkedin.com/in/skzv',  src: '../../assets/icons/social/linkedin.png',  alt: 'LinkedIn'  },
  { href: 'https://skzv.medium.com',           src: '../../assets/icons/social/medium.png',    alt: 'Medium'    },
  { href: 'https://github.com/skzv',           src: '../../assets/icons/social/github.png',    alt: 'GitHub'    },
  { href: 'https://twitter.com/_skzv',         src: '../../assets/icons/social/twitter.png',   alt: 'Twitter'   },
  { href: 'https://instagram.com/_skzv7',      src: '../../assets/icons/social/instagram.png', alt: 'Instagram' },
];

window.SocialRow = SocialRow;
