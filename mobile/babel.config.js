module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind needs to rewrite className → style via its JSX runtime.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
