import PhoneInputBase, {
  type Country,
  type Value,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

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

export function PhoneInput({
  value,
  onChange,
  id,
  placeholder,
  defaultCountry,
  disabled,
  invalid,
  className,
}: PhoneInputProps) {
  return (
    <PhoneInputBase
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry ?? detectDefaultCountry()}
      value={value ? (value as Value) : undefined}
      onChange={(v) => onChange(v ?? "")}
      disabled={disabled}
      className={cn("gi-phone-input", className)}
      numberInputProps={{
        id,
        placeholder,
        "aria-invalid": invalid,
      }}
    />
  );
}
