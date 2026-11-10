import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId } from "react";
import "./SelectFilter.css";

export type FilterOption<T extends string> = { value: T; label: string };

export type SelectFilterProps<T extends string> = {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
  icon: LucideIcon;
  className?: string;
};

export function SelectFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className = "",
}: SelectFilterProps<T>) {
  const id = useId();

  return (
    <div className={["select-filter", className].filter(Boolean).join(" ")}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Icon className="select-filter-icon" size={16} aria-hidden="true" />
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="select-filter-chevron"
        size={15}
        aria-hidden="true"
      />
    </div>
  );
}
