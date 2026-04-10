import { type EventCallback, type EventName, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";

/**
 * Subscribes to a Tauri menu/event and automatically unlistens on cleanup.
 *
 * Re-subscribes whenever `deps` changes, matching the pattern:
 *   useEffect(() => {
 *     const unlisten = listen(event, handler);
 *     return () => { unlisten.then(fn => fn()); };
 *   }, deps);
 *
 * `handler` is intentionally excluded from the effect's dep array — callers
 * control re-subscription exclusively through `deps`.
 *
 * @param event   - Tauri event name to listen for
 * @param handler - Callback invoked with the event object on each emission
 * @param deps    - Values that trigger re-subscription when changed (default: [])
 */
export function useMenuEvent<T = unknown>(
  event: EventName,
  handler: EventCallback<T>,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<T>(event, handler).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
    // handler is intentionally omitted from deps; callers use `deps` to control
    // re-subscription, mirroring the original per-effect pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
