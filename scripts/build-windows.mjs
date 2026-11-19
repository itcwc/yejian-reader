import { cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const { Arch, Platform, build } = require('electron-builder')
const { NSIS_PATH, NsisTargetOptions } = builderRequire('app-builder-lib/out/targets/nsis/nsisUtil')

NsisTargetOptions.resolve({})
const nsisSource = await NSIS_PATH()
const hindiPath = path.join('Contrib', 'Language files', 'Hindi.nsh')
const hindi = await readFile(path.join(nsisSource, hindiPath), 'utf8')
// electron-builder 25.1.8 bundles NSIS 3.0.4.1 with a missing quote in this translation.
const fixedHindi = hindi.replace(/(MULTIUSER_INNERTEXT_INSTALLMODE_CURRENTUSER "[^"\r\n]+)(?=\r?$)/m, '$1"')
const targets = Platform.WINDOWS.createTarget(['nsis'], Arch.x64)

if (fixedHindi === hindi) {
  await build({ targets, publish: 'never' })
} else {
  const tempRoot = await realpath(tmpdir())
  const patchedNsis = await mkdtemp(path.join(tempRoot, 'yejian-nsis-'))
  try {
    await cp(nsisSource, patchedNsis, { recursive: true })
    await writeFile(path.join(patchedNsis, hindiPath), fixedHindi)
    process.env.ELECTRON_BUILDER_NSIS_DIR = patchedNsis
    await build({ targets, publish: 'never' })
  } finally {
    if (path.dirname(await realpath(patchedNsis)) === tempRoot) {
      await rm(patchedNsis, { recursive: true, force: true })
    }
  }
}
