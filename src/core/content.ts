import type { Book, TocItem } from '@/types'
import { decodeBuffer, escapeHtml, sanitizeHtml } from '@/utils/text'
import { parseMhtml } from './mhtml'
import { rtfToHtml } from './rtf'

export interface FlowContent {
  html: string
  chapters: TocItem[]
}

const CHAPTER_PATTERN =
  /^(?:第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章节回卷部篇集]|(?:Chapter|CHAPTER|Part|PART)\s+(?:\d+|[IVXLC]+)|序章|序言|楔子|引子|前言|后记|尾声|番外(?:篇)?)(?:[\s:：、.·—-].{0,42})?$/

function isChapterLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 2 || trimmed.length > 56) return false
  if (!CHAPTER_PATTERN.test(trimmed)) return false
  return !/[。，,；;！!？?]$/.test(trimmed)
}

function addHeadingIds(html: string): FlowContent {
  const template = document.createElement('template')
  template.innerHTML = html
  const headings = Array.from(template.content.querySelectorAll('h1, h2, h3, h4'))
  const chapters: TocItem[] = []
  headings.forEach((heading, index) => {
    const id = `ch-${index + 1}`
    heading.setAttribute('id', id)
    const label = heading.textContent?.trim() || `第 ${index + 1} 节`
    chapters.push({ label, locator: id, level: Number(heading.tagName.slice(1)) || 1 })
  })
  return { html: template.innerHTML, chapters }
}

function txtToFlow(text: string): FlowContent {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  const chapters: TocItem[] = []
  let index = 0

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '')
    const trimmed = line.trim()
    if (!trimmed) continue
    if (isChapterLine(trimmed)) {
      const id = `ch-${chapters.length + 1}`
      chapters.push({ label: trimmed, locator: id, level: 1 })
      html.push(`<h2 id="${id}">${escapeHtml(trimmed)}</h2>`)
      continue
    }
    index += 1
    html.push(`<p>${escapeHtml(trimmed)}</p>`)
  }

  return {
    html: `<div class="flow-article flow-txt">${html.join('\n')}</div>`,
    chapters,
  }
}

async function mdToFlow(text: string): Promise<FlowContent> {
  const { marked } = await import('marked')
  const raw = marked.parse(text, { async: false, gfm: true, breaks: true }) as string
  return addHeadingIds(sanitizeHtml(raw))
}

function xmlToFlow(text: string): FlowContent {
  return {
    html: `<div class="flow-article"><pre class="plain-xml">${escapeHtml(text)}</pre></div>`,
    chapters: [],
  }
}

function fb2ToFlow(xml: string): FlowContent {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return xmlToFlow(xml)

  const binaries = new Map<string, string>()
  Array.from(doc.getElementsByTagName('binary')).forEach((node) => {
    const id = node.getAttribute('id')
    const type = node.getAttribute('content-type') || 'image/jpeg'
    const content = node.textContent?.replace(/\s/g, '')
    if (id && content) binaries.set(id, `data:${type};base64,${content}`)
  })

  const chapters: TocItem[] = []
  const parts: string[] = []

  const imageSource = (el: Element): string => {
    const href = el.getAttribute('l:href') || el.getAttribute('href') || el.getAttribute('xlink:href') || ''
    const id = href.replace(/^#/, '')
    return binaries.get(id) || ''
  }

  const walk = (node: Node, depth: number): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '')
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as Element
    const tag = el.localName.toLowerCase()
    const children = () => Array.from(el.childNodes).map((child) => walk(child, depth)).join('')

    if (tag === 'description' || tag === 'binary') return ''

    switch (tag) {
      case 'section': {
        const nextDepth = depth + 1
        return `<section class="fb2-section">${Array.from(el.childNodes)
          .map((child) => walk(child, nextDepth))
          .join('')}</section>`
      }
      case 'title': {
        const label = el.textContent?.trim() || '未命名章节'
        const id = `ch-${chapters.length + 1}`
        const level = Math.min(Math.max(depth, 1), 4)
        chapters.push({ label, locator: id, level })
        return `<h${level} id="${id}" class="fb2-title">${children()}</h${level}>`
      }
      case 'subtitle':
        return `<h4 class="fb2-subtitle">${children()}</h4>`
      case 'p':
        return `<p>${children()}</p>`
      case 'empty-line':
        return '<div class="fb2-spacer"></div>'
      case 'emphasis':
        return `<em>${children()}</em>`
      case 'strong':
        return `<strong>${children()}</strong>`
      case 'strikethrough':
        return `<s>${children()}</s>`
      case 'code':
        return `<code>${children()}</code>`
      case 'sup':
        return `<sup>${children()}</sup>`
      case 'sub':
        return `<sub>${children()}</sub>`
      case 'a': {
        const href = el.getAttribute('href') || el.getAttribute('l:href') || ''
        return /^(https?:|mailto:)/i.test(href)
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${children()}</a>`
          : children()
      }
      case 'image': {
        const src = imageSource(el)
        return src ? `<img src="${src}" alt="" />` : ''
      }
      case 'epigraph':
        return `<blockquote class="fb2-epigraph">${children()}</blockquote>`
      case 'cite':
        return `<cite>${children()}</cite>`
      case 'poem':
        return `<div class="fb2-poem">${children()}</div>`
      case 'stanza':
        return `<div class="fb2-stanza">${children()}</div>`
      case 'v':
        return `<p class="fb2-verse">${children()}</p>`
      case 'text-author':
        return `<p class="fb2-text-author">${children()}</p>`
      case 'table':
        return `<table class="fb2-table">${children()}</table>`
      case 'tr':
        return `<tr>${children()}</tr>`
      case 'th':
        return `<th>${children()}</th>`
      case 'td':
        return `<td>${children()}</td>`
      case 'body':
      case 'section-title':
        return children()
      default:
        return children()
    }
  }

  const body = doc.getElementsByTagName('body')[0]
  if (body) {
    const depth = 1
    Array.from(body.childNodes).forEach((child) => parts.push(walk(child, depth)))
  }

  return {
    html: `<div class="flow-article flow-fb2">${parts.join('\n')}</div>`,
    chapters,
  }
}

async function docxToFlow(buffer: ArrayBuffer): Promise<FlowContent> {
  const { default: mammoth } = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer.slice(0) })
  return addHeadingIds(sanitizeHtml(result.value))
}

/** 构建流式排版（TXT / MD / RTF / FB2 / DOCX / XML）的 HTML 与目录 */
export async function buildFlowContent(book: Book, buffer: ArrayBuffer): Promise<FlowContent> {
  switch (book.format) {
    case 'txt': {
      const text = decodeBuffer(buffer)
      return txtToFlow(text)
    }
    case 'md':
      return mdToFlow(decodeBuffer(buffer))
    case 'rtf':
      return addHeadingIds(rtfToHtml(decodeBuffer(buffer)))
    case 'fb2':
      return fb2ToFlow(decodeBuffer(buffer))
    case 'docx':
      return docxToFlow(buffer)
    case 'xml':
      return xmlToFlow(decodeBuffer(buffer))
    default:
      return txtToFlow(decodeBuffer(buffer))
  }
}

/** HTML / XHTML / MHTML 统一转为可渲染的 HTML 文本 */
export function buildHtmlContent(book: Book, buffer: ArrayBuffer): string {
  const text = decodeBuffer(buffer)
  if (book.format === 'mhtml') return parseMhtml(text)
  return text
}
