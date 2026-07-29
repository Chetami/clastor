/**
 * Dynamic Expo config. Extends app.json to register the Google Sign-In
 * config plugin. On iOS the SDK needs the bundle's URL scheme set to the
 * *reversed* iOS OAuth client ID (e.g. `com.googleusercontent.apps.<prefix>`);
 * we derive it from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` so there's a single
 * source of truth.
 *
 * If the env var isn't set, the plugin is omitted so other builds (e.g. web)
 * aren't blocked — Google Sign-In just won't be available until it's provided.
 */
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.split(".apps.googleusercontent.com")[0]}`
  : "";

const PLUGIN = "@react-native-google-signin/google-signin";

module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).filter((p) =>
    (Array.isArray(p) ? p[0] : p) !== PLUGIN,
  );

  if (!iosUrlScheme) {
    // eslint-disable-next-line no-console
    console.warn(
      "[google-signin] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID not set — plugin skipped; Google Sign-In will not work.",
    );
    return { ...config, plugins };
  }

  return {
    ...config,
    plugins: [...plugins, [PLUGIN, { iosUrlScheme }]],
  };
};
