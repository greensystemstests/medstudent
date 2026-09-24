import React, { useEffect, useRef, useState } from 'react';
import { Accessibility, Baseline, Contrast, Link2, MousePointer2, Pause, RotateCcw, Type, X } from 'lucide-react';
import { A11ySettings, applyA11y, DEFAULT_A11Y, loadA11y, saveA11y } from '../lib/a11y';
import { useDialogFocus } from '../lib/useDialogFocus';

const TEXT_SIZES: { value: A11ySettings['textSize']; label: string }[] = [
  { value: 100, label: 'Default' },
  { value: 115, label: 'Large' },
  { value: 130, label: 'Larger' },
  { value: 150, label: 'Largest' },
];

type Toggle = Exclude<keyof A11ySettings, 'textSize'>;

const TOGGLES: { key: Toggle; icon: React.ElementType; title: string; description: string }[] = [
  { key: 'highContrast', icon: Contrast, title: 'High contrast', description: 'Darker text and borders, underlined links' },
  { key: 'highlightLinks', icon: Link2, title: 'Highlight links', description: 'Underline every link on the page' },
  { key: 'readableFont', icon: Type, title: 'Readable font', description: 'A plain, wide font that is easier to read' },
  { key: 'textSpacing', icon: Baseline, title: 'Text spacing', description: 'More space between lines, letters and words' },
  { key: 'reduceMotion', icon: Pause, title: 'Stop animations', description: 'Turn off movement and smooth scrolling' },
  { key: 'largeCursor', icon: MousePointer2, title: 'Large cursor', description: 'A bigger, high-contrast mouse pointer' },
];

/**
 * The accessibility button (bottom-left on every page) and its settings panel. The panel is a
 * non-modal dialog, so visitors can see each change applied to the page behind it as they go.
 */
export const AccessibilityPanel: React.FC<{ onOpenStatement: () => void }> = ({ onOpenStatement }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(loadA11y);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useDialogFocus(panel, open, close, { modal: false });

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener('studybg:open-a11y', openPanel);
    return () => window.removeEventListener('studybg:open-a11y', openPanel);
  }, []);

  useEffect(() => {
    applyA11y(settings);
    saveA11y(settings);
  }, [settings]);

  const changed = (Object.keys(DEFAULT_A11Y) as (keyof A11ySettings)[]).some((k) => settings[k] !== DEFAULT_A11Y[k]);
  const activeCount = TOGGLES.filter((t) => settings[t.key]).length + (settings.textSize !== 100 ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-haspopup="dialog"
        aria-label={`Accessibility settings${activeCount ? ` (${activeCount} active)` : ''}`}
        title="Accessibility settings"
        id="a11y-button"
        className="fixed bottom-4 left-4 z-40 w-14 h-14 rounded-full bg-[#0f1e36] text-white border-2 border-white shadow-lg hover:bg-[#006644] transition-colors flex items-center justify-center"
      >
        <Accessibility className="w-7 h-7" aria-hidden="true" />
        {activeCount > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-400 text-[#0f1e36] text-[0.6875rem] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panel}
          id="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="a11y-title"
          aria-describedby="a11y-desc"
          className="fixed bottom-20 left-4 z-50 w-[min(23rem,calc(100vw-2rem))] max-h-[calc(100vh-7rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl text-slate-800"
        >
          <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0f1e36] to-[#006644] text-white px-5 py-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="a11y-title" className="font-bold font-heading text-lg flex items-center gap-2">
                <Accessibility className="w-5 h-5" aria-hidden="true" /> Accessibility
              </h2>
              <p id="a11y-desc" className="text-xs text-slate-200 mt-0.5">
                Adjust the site to suit you. Your choices are saved on this device.
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Close accessibility settings" className="p-1.5 rounded-lg hover:bg-white/15 shrink-0">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <fieldset>
              <legend className="text-sm font-bold text-slate-900 mb-2">Text size</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {TEXT_SIZES.map((size, i) => (
                  <label
                    key={size.value}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 cursor-pointer text-center has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0f1e36] ${
                      settings.textSize === size.value
                        ? 'border-[#006644] bg-emerald-50 text-[#006644] ring-1 ring-[#006644]'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="a11y-text-size"
                      value={size.value}
                      checked={settings.textSize === size.value}
                      onChange={() => setSettings((s) => ({ ...s, textSize: size.value }))}
                      data-autofocus={settings.textSize === size.value ? '' : undefined}
                      className="sr-only"
                    />
                    <span aria-hidden="true" className="font-bold leading-none" style={{ fontSize: `${0.85 + i * 0.2}rem` }}>
                      A
                    </span>
                    <span className="text-[0.6875rem] font-semibold">{size.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <ul className="space-y-2">
              {TOGGLES.map(({ key, icon: Icon, title, description }) => (
                <li key={key}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[key]}
                    onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      settings[key] ? 'border-[#006644] bg-emerald-50' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${settings[key] ? 'text-[#006644]' : 'text-slate-600'}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{title}</span>
                      <span className="block text-xs text-slate-600">{description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${settings[key] ? 'bg-[#006644]' : 'bg-slate-400'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings[key] ? 'left-5' : 'left-1'}`} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSettings({ ...DEFAULT_A11Y })}
                disabled={!changed}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reset all
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenStatement();
                }}
                className="text-sm font-semibold text-[#006644] underline px-1 py-2"
              >
                Accessibility statement
              </button>
            </div>

            <p className="text-xs text-slate-600 border-t border-slate-200 pt-3">
              Tip: press <kbd className="px-1 rounded border border-slate-300 font-mono">Tab</kbd> to move through the page, and your
              browser's zoom (<kbd className="px-1 rounded border border-slate-300 font-mono">Ctrl</kbd> /{' '}
              <kbd className="px-1 rounded border border-slate-300 font-mono">⌘</kbd> +{' '}
              <kbd className="px-1 rounded border border-slate-300 font-mono">+</kbd>) for even larger text.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
