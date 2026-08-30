const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// masarx-shared is consumed as a local file: dependency (workspace source).
config.transpilePackages = ["masarx-shared"];

module.exports = withNativeWind(config, { input: "./global.css" });
