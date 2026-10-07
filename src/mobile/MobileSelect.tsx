import { useRef, type ReactNode } from "react";
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
  disabled = false,
  sheetWidth = SHEET_WIDTH.menu,
  presentation = "anchor",
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
  disabled?: boolean;
  sheetWidth?: number;
  /** A centred dialog suits a choice made from a settings row. */
  presentation?: "anchor" | "dialog";
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
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
        <span className="mobile-select-value">
          {selected?.icon}
          <span>{selected?.label ?? value}</span>
        </span>
        <ChevronDown size={14} />
      </button>
      <MobileSheet
        open={open}
        title={label}
        placement={presentation}
        anchor={trigger}
        width={presentation === "dialog" ? SHEET_WIDTH.form : sheetWidth}
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
              disabled={disabled || option.disabled}
              onClick={() => {
                onOpenChange(false);
                onChange(option.value);
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              {value === option.value && <Check size={20} />}
            </button>
          ))}
        </div>
      </MobileSheet>
    </>
  );
}
