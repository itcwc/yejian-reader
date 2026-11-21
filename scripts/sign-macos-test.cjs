const { createRequire } = require('node:module')

const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const { signAsync } = builderRequire('@electron/osx-sign')

module.exports = (options) => signAsync({
  ...options,
  identity: '-',
  identityValidation: false,
  preAutoEntitlements: false,
  preEmbedProvisioningProfile: false,
})
