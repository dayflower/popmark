import { SettingsPanel } from "./components/SettingsPanel";

export default function SettingsApp() {
  return (
    <div className="h-screen bg-white dark:bg-gray-800 flex flex-col">
      <SettingsPanel />
    </div>
  );
}
