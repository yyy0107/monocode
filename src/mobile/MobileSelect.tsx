import { useRef } from "react";
import { Check, ChevronDown } from "../shared/ui/icons";
import { MobileSheet, SHEET_WIDTH } from "./MobileSheet";

export function MobileSelect<T extends string>({
  id,
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="mobile-select-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <span>
          {options.find((option) => option.value === value)?.label ?? value}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <MobileSheet
          title={label}
          placement="anchor"
          anchor={trigger}
          width={SHEET_WIDTH.menu}
          align="end"
          onClose={() => onOpenChange(false)}
        >
          <div role="radiogroup" aria-label={label}>
            {options.map((option) => (
              <button
                type="button"
                className="mobile-sheet-row"
                role="radio"
                key={option.value}
                aria-checked={value === option.value}
                onClick={() => {
                  onOpenChange(false);
                  onChange(option.value);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && <Check size={20} />}
              </button>
            ))}
          </div>
        </MobileSheet>
      )}
    </>
  );
}
