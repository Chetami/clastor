/**
 * Adds `className` support to React Native component prop types so
 * TypeScript accepts NativeWind's Tailwind classes on built-in components.
 *
 * NativeWind transforms `className` → `style` at runtime via Babel; this file
 * mirrors that at the type level.
 *
 * The `export {}` makes this a module so `declare module` is treated as
 * augmentation (merge) rather than a replacement of react-native's types.
 */
export {};

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface ImageProps {
    className?: string;
  }
}
