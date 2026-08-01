interface CheckboxSettingProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
}

export function CheckboxSetting({ checked, onChange, label, className }: CheckboxSettingProps) {
  return (
    <div className={className}>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-(--popmark-primary)"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </label>
    </div>
  );
}
