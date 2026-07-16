// Polyfills required by the Firebase JS SDK in React Native.
// Must be imported before any Firebase module — done via the side-effect
// import at the top of app/_layout.tsx.

// `crypto.getRandomValues` is used by Firebase for secure random values.
import "react-native-get-random-values";
