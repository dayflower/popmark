import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import type { HistoryEntry } from "../types/history";

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<HistoryEntry[]>("list_history");
      setEntries(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEntry = useCallback(async (id: string): Promise<string> => {
    return invoke<string>("get_history_entry", { id });
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await invoke("delete_history_entry", { id });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(async () => {
    await invoke("clear_history");
    setEntries([]);
  }, []);

  return { entries, loading, loadHistory, getEntry, deleteEntry, clearHistory };
}
