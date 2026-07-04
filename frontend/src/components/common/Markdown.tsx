import React from 'react'

interface Props {
  text: string
}

export default function Markdown({ text }: Props) {
  if (!text) return null

  // Split by line
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  let inList = false
  let listItems: React.ReactNode[] = []
  let listKey = 0

  const parseInline = (str: string): React.ReactNode[] => {
    // Basic bold and code tag parser
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-violet-300">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-slate-900/60 text-pink-300 font-mono text-xs border border-slate-800"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc pl-5 my-2 flex flex-col gap-1.5 text-slate-300">
          {listItems}
        </ul>
      )
      listItems = []
      inList = false
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    // Unordered list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true
      const content = trimmed.slice(2)
      listItems.push(
        <li key={index} className="leading-relaxed">
          {parseInline(content)}
        </li>
      )
      return
    }

    // If we were in a list and this is not a list item, flush the list
    if (inList) {
      flushList()
    }

    // Heading 3
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={index} className="text-base font-bold text-slate-200 mt-4 mb-2">
          {parseInline(trimmed.slice(4))}
        </h4>
      )
      return
    }

    // Heading 2
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={index} className="text-lg font-bold text-slate-105 mt-5 mb-2 border-b border-slate-800 pb-1">
          {parseInline(trimmed.slice(3))}
        </h3>
      )
      return
    }

    // Heading 1
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={index} className="text-xl font-extrabold text-white mt-6 mb-3">
          {parseInline(trimmed.slice(2))}
        </h2>
      )
      return
    }

    // Empty line
    if (trimmed === '') {
      return
    }

    // Regular paragraph
    elements.push(
      <p key={index} className="my-2 leading-relaxed text-slate-300">
        {parseInline(line)}
      </p>
    )
  })

  // Flush any trailing list items
  if (inList) {
    flushList()
  }

  return <div className="markdown-body select-text">{elements}</div>
}
