// Explicit Babel config mirroring Expo's default (babel-preset-expo already
// wires react-native-worklets/reanimated), plus a plugin that neutralises
// `import.meta` in ESM-only dependencies so the Metro web target doesn't crash.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["./babel-plugins/transform-import-meta.js"],
  };
};
