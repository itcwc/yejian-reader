import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'dist')
const target = path.join(root, 'android-uniapp', 'hybrid', 'html')

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true })

console.log('Web 构建产物已复制到 android-uniapp/hybrid/html，可用 HBuilderX 打包安卓 App。')
