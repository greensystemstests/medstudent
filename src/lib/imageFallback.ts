/**
 * If a photo can't load (the host is down, the link expired, or a network blocks it), swap in a
 * clean placeholder instead of the browser's broken-image icon: initials for small avatars, a
 * brand-coloured panel for larger photos. The alt text stays, so screen readers are unaffected.
 */
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const avatar = (name: string) =>
  svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ecfdf5"/>` +
      `<text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="40" fill="#006644">${initials(name) || '?'}</text></svg>`,
  );

const photo = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1e36"/><stop offset="1" stop-color="#064e3b"/></linearGradient></defs>` +
    `<rect width="400" height="240" fill="url(#g)"/>` +
    `<g fill="none" stroke="#34d399" stroke-opacity=".35" stroke-width="4" stroke-linejoin="round"><path d="M150 150h100M160 150v-40M186 150v-40M214 150v-40M240 150v-40M150 110h100l-50-28z"/></g></svg>`,
);

export function installImageFallback() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback || !/^https?:/.test(img.currentSrc || img.src)) return;
      img.dataset.fallback = 'true';
      img.src = img.getBoundingClientRect().width < 120 ? avatar(img.alt) : photo;
    },
    true,
  );
}
