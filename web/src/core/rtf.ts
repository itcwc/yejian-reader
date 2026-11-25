import { escapeHtml } from '@/utils/text'

const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer',
  'footnote', 'annotation', 'field', 'fldinst', 'themedata', 'colorschememapping',
  'datastore', 'latentstyles', 'xmlnstbl', 'mmathPr', 'listtable', 'listoverridetable',
])

/** 移除指定目标组（支持嵌套花括号），避免字体表、图片二进制污染正文 */
function stripDestinationGroups(rtf: string): string {
  let out = ''
  let i = 0
  while (i < rtf.length) {
    if (rtf[i] === '{') {
      let j = i + 1
      let isDestination = false
      if (rtf[j] === '\\' && rtf[j + 1] === '*') {
        isDestination = true
        j += 2
      }
      let k = j
      if (rtf[k] === '\\') k += 1
      let word = ''
      while (k < rtf.length && /[a-zA-Z]/.test(rtf[k])) {
        word += rtf[k]
        k += 1
      }
      if (isDestination || SKIP_DESTINATIONS.has(word)) {
        let depth = 1
        let p = i + 1
        while (p < rtf.length && depth > 0) {
          if (rtf[p] === '{') depth += 1
          else if (rtf[p] === '}') depth -= 1
          p += 1
        }
        i = p
        continue
      }
    }
    out += rtf[i]
    i += 1
  }
  return out
}

const SPECIAL_CHARS: Record<string, string> = {
  emdash: '—',
  endash: '–',
  lquote: '‘',
  rquote: '’',
  ldblquote: '“',
  rdblquote: '”',
  bullet: '•',
  ellipsis: '…',
}

/** 将 RTF 转为可排版 HTML（覆盖常用字符样式与段落） */
export function rtfToHtml(source: string): string {
  const rtf = stripDestinationGroups(source)
  let html = ''
  let paragraphOpen = false
  const openTags: string[] = []

  const closeAllInline = () => {
    while (openTags.length) html += `</${openTags.pop()}>`
  }
  const ensureParagraph = () => {
    if (!paragraphOpen) {
      html += '<p>'
      paragraphOpen = true
    }
  }
  const endParagraph = () => {
    closeAllInline()
    if (paragraphOpen) {
      html += '</p>'
      paragraphOpen = false
    }
  }
  const toggle = (tag: string, enabled: boolean) => {
    if (enabled) {
      ensureParagraph()
      html += `<${tag}>`
      openTags.push(tag)
    } else {
      const index = openTags.lastIndexOf(tag)
      if (index >= 0) {
        html += `</${tag}>`
        openTags.splice(index, 1)
      }
    }
  }

  let i = 0
  while (i < rtf.length) {
    const char = rtf[i]

    if (char === '{' || char === '}') {
      i += 1
      continue
    }

    if (char === '\\') {
      const next = rtf[i + 1]

      // 转义字符
      if (next === '\\' || next === '{' || next === '}') {
        ensureParagraph()
        html += escapeHtml(next)
        i += 2
        continue
      }

      // 十六进制字节
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4)
        const code = parseInt(hex, 16)
        if (!Number.isNaN(code)) {
          ensureParagraph()
          html += escapeHtml(String.fromCharCode(code))
        }
        i += 4
        continue
      }

      // 控制符号
      if (!/[a-zA-Z]/.test(next || '')) {
        if (next === '~') {
          ensureParagraph()
          html += '&nbsp;'
        } else if (next === '_') {
          ensureParagraph()
          html += '&#8209;'
        }
        i += 2
        continue
      }

      // 控制字
      let j = i + 1
      let word = ''
      while (j < rtf.length && /[a-zA-Z]/.test(rtf[j])) {
        word += rtf[j]
        j += 1
      }
      let param = ''
      if (rtf[j] === '-' || /[0-9]/.test(rtf[j])) {
        const start = j
        if (rtf[j] === '-') j += 1
        while (j < rtf.length && /[0-9]/.test(rtf[j])) j += 1
        param = rtf.slice(start, j)
      }
      if (rtf[j] === ' ') j += 1

      switch (word) {
        case 'par':
        case 'pard':
        case 'sect':
          endParagraph()
          break
        case 'line':
          ensureParagraph()
          html += '<br />'
          break
        case 'tab':
          ensureParagraph()
          html += '<span class="rtf-tab"></span>'
          break
        case 'b':
          toggle('strong', param !== '0')
          break
        case 'i':
          toggle('em', param !== '0')
          break
        case 'ul':
          toggle('u', param !== '0')
          break
        case 'u': {
          let code = parseInt(param, 10)
          if (Number.isFinite(code)) {
            if (code < 0) code += 65536
            ensureParagraph()
            html += escapeHtml(String.fromCharCode(code))
            if (rtf[j] === '?') j += 1
          }
          break
        }
        default:
          if (SPECIAL_CHARS[word]) {
            ensureParagraph()
            html += SPECIAL_CHARS[word]
          }
          break
      }

      i = j
      continue
    }

    if (char === '\r' || char === '\n') {
      i += 1
      continue
    }

    ensureParagraph()
    html += escapeHtml(char)
    i += 1
  }

  endParagraph()
  return html || '<p class="empty-doc">（这份 RTF 没有可显示的正文）</p>'
}
