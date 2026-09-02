import { ref, shallowRef } from 'vue'
import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { detectWebGpu, modelIdFor, type WebGpuSupport } from '../ai/webgpu'
import { createBookIndex, type BookIndex, type RetrievalResult } from '../domain/retrieval'
import { buildSystemPrompt, buildUserPrompt } from '../domain/prompt'
import type { Passage, PreparedBook } from '../domain/book'

const support = shallowRef<WebGpuSupport | null>(null)
const isLoading = ref(false)
const isReady = ref(false)
const progressMessage = ref('')
const progressPercent = ref(0)
const failure = ref('')

const engine = shallowRef<MLCEngineInterface | null>(null)
const indexes = new Map<string, BookIndex>()

function indexFor(book: PreparedBook) {
  const existing = indexes.get(book.id)
  if (existing) return existing

  const index = createBookIndex(book)
  indexes.set(book.id, index)
  return index
}

async function checkSupport() {
  if (support.value) return support.value

  support.value = await detectWebGpu()
  return support.value
}

async function enable() {
  if (isReady.value || isLoading.value) return

  const capability = await checkSupport()
  if (capability.status !== 'supported') return

  isLoading.value = true
  failure.value = ''
  progressPercent.value = 0

  try {
    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
    const worker = new Worker(new URL('../ai/engine.worker.ts', import.meta.url), { type: 'module' })

    engine.value = await CreateWebWorkerMLCEngine(worker, modelIdFor(capability), {
      initProgressCallback: (report) => {
        progressMessage.value = report.text
        progressPercent.value = Math.round(report.progress * 100)
      },
    })

    isReady.value = true
  } catch (error) {
    failure.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

function retrieve(book: PreparedBook, question: string): RetrievalResult {
  return indexFor(book).retrieve(question)
}

type AskOptions = {
  book: PreparedBook
  passages: Passage[]
  question: string
  replyLanguage: string
  onDelta: (delta: string) => void
}

async function ask({ book, passages, question, replyLanguage, onDelta }: AskOptions): Promise<void> {
  if (!engine.value) throw new Error('The AI engine is not ready.')

  const stream = await engine.value.chat.completions.create({
    stream: true,
    temperature: 0.2,
    max_tokens: 512,
    messages: [
      { role: 'system', content: buildSystemPrompt(book, replyLanguage) },
      { role: 'user', content: buildUserPrompt(passages, question) },
    ],
  })

  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content
    if (delta) onDelta(delta)
  }
}

export function useBookExpert() {
  return {
    support,
    isLoading,
    isReady,
    progressMessage,
    progressPercent,
    failure,
    checkSupport,
    enable,
    retrieve,
    ask,
  }
}
