import { useEffect, useCallback, useRef } from "react";

/**
 * Guards against accidental navigation when there are unsaved changes.
 * - Shows browser-native confirmation on tab close / refresh (beforeunload)
 * - Intercepts browser back button (popstate) and calls `onBlock` instead
 *
 * @param isDirty - Whether the form has unsaved changes
 * @param onBlock - Callback to show the in-app discard dialog
 */
export function useUnsavedChangesGuard(isDirty: boolean, onBlock: () => void) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  /* ─── beforeunload: browser tab close / refresh ─── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a generic prompt
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* ─── popstate: browser back/forward buttons ─── */
  useEffect(() => {
    if (!isDirty) return;

    // Push a dummy state so we have something to "go back" from
    window.history.pushState({ unsavedGuard: true }, "");

    const handler = (_e: PopStateEvent) => {
      if (isDirtyRef.current) {
        // Re-push the dummy state so the user stays on the page
        window.history.pushState({ unsavedGuard: true }, "");
        onBlockRef.current();
      }
    };

    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [isDirty]);
}
