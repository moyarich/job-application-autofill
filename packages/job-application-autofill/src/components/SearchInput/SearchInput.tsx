import { Search, X } from "lucide-react";
import { useId } from "react";
import "./SearchInput.css";

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  label,
  placeholder = "Search…",
  className = "",
}: SearchInputProps) {
  const id = useId();

  return (
    <div className={["search-input", className].filter(Boolean).join(" ")}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search className="search-input-icon" size={17} aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="search-input-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange("")}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
