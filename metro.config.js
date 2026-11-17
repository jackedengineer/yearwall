// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// web/ is the separate React web app (with its own node_modules). Keep the phone bundler out of it.
const webDir = path.resolve(__dirname, 'web').replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [].concat(config.resolver.blockList || [], new RegExp(`^${webDir}[/\\\\].*`));

module.exports = config;
