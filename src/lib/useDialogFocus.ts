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

    const initial = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    initial.focus();

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
      if (opener && document.contains(opener)) opener.focus();
    };
    // onClose is intentionally not a dependency: re-running would steal focus back mid-dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modal, ref]);
}
