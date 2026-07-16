import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput as RNTextInput,
  View,
  type PressableProps,
  type TextProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { cn } from "@examify-tms/shared";

/** A flexible box — the RN equivalent of a <div>. */
export function Box({ className, children, ...props }: ViewProps & { children?: ReactNode }) {
  return (
    <View className={className} {...props}>
      {children}
    </View>
  );
}

type Variant = "default" | "muted" | "h1" | "h2" | "h3" | "label";

const textVariants: Record<Variant, string> = {
  default: "text-base text-gray-900 dark:text-gray-50",
  muted: "text-sm text-gray-500 dark:text-gray-400",
  h1: "text-3xl font-bold text-gray-900 dark:text-gray-50",
  h2: "text-2xl font-semibold text-gray-900 dark:text-gray-50",
  h3: "text-xl font-semibold text-gray-900 dark:text-gray-50",
  label: "text-sm font-medium text-gray-700 dark:text-gray-300",
};

export function Text({
  className,
  variant = "default",
  children,
  ...props
}: TextProps & { variant?: Variant; children?: ReactNode }) {
  return (
    <RNText className={cn(textVariants[variant], className)} {...props}>
      {children}
    </RNText>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand active:bg-brand-dark",
  secondary:
    "bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700",
  ghost: "bg-transparent active:bg-gray-100 dark:active:bg-gray-800",
  destructive: "bg-red-600 active:bg-red-700",
};

const buttonTextVariants: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-gray-900 dark:text-gray-50",
  ghost: "text-gray-700 dark:text-gray-300",
  destructive: "text-white",
};

type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center rounded-xl px-5 py-3.5",
        buttonVariants[variant],
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "destructive" ? "#fff" : "#6b7280"}
        />
      ) : typeof children === "string" ? (
        <RNText className={cn("text-base font-semibold", buttonTextVariants[variant])}>
          {children}
        </RNText>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function Input({ className, ...props }: TextInputProps) {
  return (
    <RNTextInput
      placeholderTextColor="#9ca3af"
      className={cn(
        "rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: ViewProps & { children?: ReactNode }) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <ActivityIndicator className={cn("py-8", className)} size="large" />;
}

export function ScreenError({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-center text-red-500">{message}</Text>
    </View>
  );
}
