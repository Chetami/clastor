import { useMemo } from "react";
import PhoneInputBase, {
  type Country,
  type Value,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";

export interface PhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  defaultCountry?: Country;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

function detectDefaultCountry(): Country | undefined {
  if (typeof navigator === "undefined") return undefined;
  const locale = navigator.language || navigator.languages?.[0] || "";
  const region = locale.split("-")[1];
  return region && region.length === 2
    ? (region.toUpperCase() as Country)
    : undefined;
}

interface CountryOption {
  value?: string;
  label: string;
  divider?: boolean;
}

type FlagIconComponent = React.ComponentType<{
  country?: string;
  label: string;
  aspectRatio?: number;
}>;

interface CountrySelectComponentProps {
  value?: string;
  onChange: (value?: string) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  name?: string;
  "aria-label"?: string;
  iconComponent: FlagIconComponent;
  className?: string;
}

function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  onFocus,
  onBlur,
  "aria-label": ariaLabel,
  iconComponent: FlagIcon,
  className,
}: CountrySelectComponentProps) {
  const radixValue = value ?? "ZZ";

  const selectedLabel = useMemo(() => {
    const match = options.find(
      (o) => !o.divider && (o.value ?? "ZZ") === radixValue,
    );
    return match?.label ?? (value ? value : "International");
  }, [options, radixValue, value]);

  function handleValueChange(next: string) {
    onChange(next === "ZZ" ? undefined : next);
  }

  return (
    <Select
      value={radixValue}
      onValueChange={handleValueChange}
      disabled={disabled || readOnly}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          "w-auto justify-start gap-1 self-stretch border-0 px-0.5 mr-1 shadow-none focus:ring-0 focus-visible:ring-0",
          className,
        )}
      >
        <FlagIcon country={value} label={selectedLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-72 min-w-[16rem]">
        {options.map((opt, index) => {
          if (opt.divider) {
            return <SelectSeparator key={`divider-${index}`} />;
          }
          const itemValue = opt.value ?? "ZZ";
          return (
            <SelectItem key={itemValue} value={itemValue}>
              <span className="flex items-center gap-2">
                <FlagIcon country={opt.value} label={opt.label} />
                <span>{opt.label}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// NOTE: PhoneInput is currently disabled until further notice.
// There are known bugs with this component that need to be resolved
// before it can be enabled again. Do not re-enable without fixing them.
export function PhoneInput({
  value,
  onChange,
  id,
  placeholder,
  defaultCountry,
  invalid,
  className,
}: PhoneInputProps) {
  return (
    <span title="Disabled until further notice" className="block w-full">
      <PhoneInputBase
        international
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry ?? detectDefaultCountry()}
        value={value ? (value as Value) : undefined}
        onChange={(v) => onChange(v ?? "")}
        disabled
        className={cn("gi-phone-input", className)}
        countrySelectComponent={PhoneCountrySelect}
        numberInputProps={{
          id,
          placeholder,
          "aria-invalid": invalid,
        }}
      />
    </span>
  );
}
