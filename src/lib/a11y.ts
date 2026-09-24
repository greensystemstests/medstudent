/**
 * Visitor accessibility preferences. Stored only on this device (localStorage) and applied as
 * data attributes on <html>, which src/index.css turns into the actual adjustments.
 * index.html applies the saved values before the app renders, so there's no flash of the defaults.
 */
export interface A11ySettings {
  textSize: 100 | 115 | 130 | 150;
  highContrast: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  textSpacing: boolean;
  reduceMotion: boolean;
  largeCursor: boolean;
}

export const A11Y_STORAGE_KEY = 'studybg.a11y';

export const DEFAULT_A11Y: A11ySettings = {
  textSize: 100,
  highContrast: false,
  highlightLinks: false,
  readableFont: false,
  textSpacing: false,
  reduceMotion: false,
  largeCursor: false,
};

export function loadA11y(): A11ySettings {
  try {
    const saved = JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) || '{}');
    const settings = { ...DEFAULT_A11Y, ...saved };
    if (![100, 115, 130, 150].includes(settings.textSize)) settings.textSize = 100;
    return settings;
  } catch {
    return { ...DEFAULT_A11Y };
  }
}

export function saveA11y(settings: A11ySettings) {
  try {
    const isDefault = (Object.keys(DEFAULT_A11Y) as (keyof A11ySettings)[]).every((k) => settings[k] === DEFAULT_A11Y[k]);
    if (isDefault) localStorage.removeItem(A11Y_STORAGE_KEY);
    else localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: the settings still apply for this visit.
  }
}

export function applyA11y(settings: A11ySettings) {
  const root = document.documentElement;
  root.style.fontSize = settings.textSize === 100 ? '' : `${settings.textSize}%`;
  const set = (name: string, value: string | false) => (value ? root.setAttribute(name, value) : root.removeAttribute(name));
  set('data-a11y-text', settings.textSize >= 130 && 'large');
  set('data-a11y-contrast', settings.highContrast && 'high');
  set('data-a11y-links', settings.highlightLinks && 'on');
  set('data-a11y-font', settings.readableFont && 'readable');
  set('data-a11y-spacing', settings.textSpacing && 'on');
  set('data-a11y-motion', settings.reduceMotion && 'reduce');
  set('data-a11y-cursor', settings.largeCursor && 'large');
}

/** True when the visitor asked for less motion, on the site or in their operating system. */
export function prefersReducedMotion() {
  return (
    document.documentElement.getAttribute('data-a11y-motion') === 'reduce' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Scroll behaviour that honours reduced-motion preferences. */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');
