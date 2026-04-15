const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Support WatermelonDB — modules natifs SQLite
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs']

module.exports = config
