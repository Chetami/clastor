/**
 * No-op mock for react-native-reanimated.
 *
 * Prevents the worklets JSI module from being loaded when only basic
 * NativeWind styling (no animations) is used. createAnimatedComponent
 * returns the original component unchanged.
 */
const React = require("react");

function createAnimatedComponent(Component) {
  return Component;
}

module.exports = {
  default: { createAnimatedComponent },
  createAnimatedComponent,
  useAnimatedStyle: () => [{}],
  useAnimatedProps: () => {},
  useSharedValue: (init) => ({ value: init }),
  useDerivedValue: (fn) => ({ value: fn() }),
  withTiming: (val) => val,
  withSpring: (val) => val,
  withDelay: (_, val) => val,
  withSequence: (...vals) => vals[vals.length - 1],
  withRepeat: (val) => val,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: () => 0,
  Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  FadeIn: React.Fragment,
  FadeOut: React.Fragment,
  SlideInUp: React.Fragment,
  SlideOutUp: React.Fragment,
};
