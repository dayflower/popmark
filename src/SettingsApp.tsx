import { SettingsPanel } from "./components/SettingsPanel";
import { useTheme } from "./hooks/useTheme";

export default function SettingsApp() {
  useTheme();
  return (
    <div className="popmark-settings-root h-screen bg-white dark:bg-gray-800 flex flex-col">
      <SettingsPanel />
    </div>
  );
}
