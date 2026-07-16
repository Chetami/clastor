/**
 * Side-effect import type declarations for the Metro bundler.
 * `global.css` is processed by NativeWind's Metro plugin at build time.
 */
declare module "*.css";

/** The `~` alias points at the mobile project root (Expo convention). */
declare module "~/*";
