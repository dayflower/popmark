interface FontSettingsProps {
  mode: "rich" | "plain";
  fontFamily: string;
  fontSize: string;
  fontFallback: boolean;
  fontList: string[];
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: string) => void;
  onFontFallbackChange: (value: boolean) => void;
}

export function FontSettings({
  mode,
  fontFamily,
  fontSize,
  fontFallback,
  fontList,
  onFontFamilyChange,
  onFontSizeChange,
  onFontFallbackChange,
}: FontSettingsProps) {
  const datalistId = `${mode}-font-family-list`;
  const title = mode === "rich" ? "Rich Mode Font" : "Plain Mode Font";

  return (
    <div>
      <datalist id={datalistId}>
        {fontList.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          list={datalistId}
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          placeholder="Family…"
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
        />
        <input
          type="number"
          min="1"
          value={fontSize}
          onChange={(e) => onFontSizeChange(e.target.value)}
          placeholder="px"
          className="w-14 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded outline-none focus:border-blue-500"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={fontFallback}
          onChange={(e) => onFontFallbackChange(e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <span className="text-xs text-gray-600 dark:text-gray-400">Append fallback fonts</span>
      </label>
    </div>
  );
}
