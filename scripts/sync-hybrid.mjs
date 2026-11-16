import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'dist')

const targets = [
  path.join(root, 'android-uniapp', 'hybrid', 'html'),
  path.join(root, 'android-webview', 'app', 'src', 'main', 'assets', 'hybrid', 'html'),
]

for (const target of targets) {
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await cp(source, target, { recursive: true })
}

console.log('Web 构建产物已复制到 android-uniapp/hybrid/html 与 android-webview assets。')
console.log('HBuilderX 可导入 android-uniapp 打包；android-webview 用于 CI 直接产出 APK。')
