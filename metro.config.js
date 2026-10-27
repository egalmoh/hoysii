const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore macOS AppleDouble files (._*) created on FAT/exFAT volumes.
// Metro requires a single regex (or patterns with the same flags).
const existing = config.resolver.blockList;
const patterns = (Array.isArray(existing) ? existing : [existing]).filter(Boolean);
config.resolver.blockList = new RegExp(
  [...patterns.map((re) => re.source), '\\/\\._[^/]*$'].join('|')
);

module.exports = config;
