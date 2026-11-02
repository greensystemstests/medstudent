import { RefObject, useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour for dialogs (WAI-ARIA Authoring Practices, dialog pattern):
 * focus moves into the dialog when it opens, Escape closes it, focus returns to whatever
 * opened it when it closes, and — for modal dialogs — Tab/Shift+Tab stay inside it.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, { modal = true } = {}) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;

    // Modal dialogs lock the page behind them, so only the dialog scrolls.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    if (modal) root.style.overflow = 'hidden';

    const initial = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    // Don't scroll: a dialog should open showing its title, even when the first field is further down.
    initial.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (!modal || e.key !== 'Tab') return;
      const items = Array.from<HTMLElement>(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (modal) root.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
    // onClose is intentionally not a dependency: re-running would steal focus back mid-dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modal, ref]);
}
