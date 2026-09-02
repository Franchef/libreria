<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageSquareText, Send } from '@lucide/vue'
import AiGate from './AiGate.vue'
import { useBookExpert } from '../composables/useBookExpert'
import { passageSources, type PreparedBook, type Source } from '../domain/book'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

const props = defineProps<{ book: PreparedBook }>()

const { locale, t } = useI18n()
const { isReady, ask, retrieve } = useBookExpert()

const message = ref('')
const isSending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const isNearBottom = ref(true)
const messages = ref<ChatMessage[]>([{ role: 'assistant', content: t('initialMessage') }])

watch(() => props.book.id, () => {
  messages.value = [{ role: 'assistant', content: t('initialMessage') }]
  message.value = ''
})

function handleScroll() {
  const container = messagesContainer.value
  if (!container) return

  isNearBottom.value = container.scrollHeight - container.scrollTop - container.clientHeight < 24
}

async function scrollToLatest() {
  await nextTick()
  if (isNearBottom.value && messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function sourceLabel(source: Source) {
  if (source.chapterNumber === null) return t('ai.overviewLabel')

  const title = source.chapterTitle ?? ''
  return t('ai.chapterLabel', {
    number: source.chapterNumber,
    title: title.length > 60 ? `${title.slice(0, 60).trimEnd()}…` : title,
  })
}

async function answer(question: string, target: ChatMessage) {
  const { passages, relevant } = retrieve(props.book, question)

  if (!relevant) {
    target.content = t('ai.notCovered', { title: props.book.title })
    return
  }

  await ask({
    book: props.book,
    passages,
    question,
    replyLanguage: locale.value,
    onDelta: (delta) => {
      target.content += delta
      void scrollToLatest()
    },
  })
  target.sources = passageSources(passages)
}

async function sendMessage() {
  const question = message.value.trim()
  if (!question || isSending.value || !isReady.value) return

  messages.value.push({ role: 'user', content: question })
  message.value = ''
  isSending.value = true

  // Read the entry back from the array so streamed deltas hit the reactive proxy.
  messages.value.push({ role: 'assistant', content: '' })
  const placed = messages.value[messages.value.length - 1]
  await scrollToLatest()

  try {
    await answer(question, placed)
  } catch {
    placed.content = t('ai.answerFailed')
  } finally {
    isSending.value = false
    await scrollToLatest()
  }
}
</script>

<template>
  <section class="flex min-h-[calc(100vh-73px)] flex-col border-b border-slate-200 bg-white lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:self-start lg:border-b-0 lg:border-r" aria-labelledby="chat-heading">
    <div class="border-b border-slate-100 px-6 py-5 sm:px-8">
      <div class="flex items-center gap-3">
        <div class="grid size-9 place-items-center bg-teal-50 text-teal-700"><MessageSquareText :size="18" /></div>
        <div>
          <h2 id="chat-heading" class="font-semibold text-slate-950">{{ t('conversation') }}</h2>
          <p class="text-xs text-slate-500">{{ t('groundedIn', { title: book.title }) }}</p>
        </div>
      </div>
    </div>

    <AiGate />

    <div ref="messagesContainer" class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-8 sm:px-8" @scroll="handleScroll">
      <div v-for="(chatMessage, index) in messages" :key="index" class="flex max-w-[85%] flex-col gap-2" :class="chatMessage.role === 'user' ? 'self-end items-end' : 'self-start items-start'">
        <div class="whitespace-pre-line px-4 py-3 text-sm leading-6" :class="chatMessage.role === 'user' ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'">
          {{ chatMessage.content || t('ai.thinking') }}
        </div>
        <ul v-if="chatMessage.sources?.length" class="flex flex-wrap gap-1.5">
          <li v-for="source in chatMessage.sources" :key="String(source.chapterNumber)" class="border border-teal-200 bg-teal-50 px-2 py-1 text-xs text-teal-800">
            {{ sourceLabel(source) }}
            <span v-if="source.characters.length" class="text-teal-700/80">· {{ source.characters.join(', ') }}</span>
          </li>
        </ul>
      </div>
    </div>

    <form class="border-t border-slate-200 p-5 sm:p-6" @submit.prevent="sendMessage">
      <label class="sr-only" for="book-question">{{ t('askBook') }}</label>
      <div class="flex gap-3">
        <input id="book-question" v-model="message" :disabled="!isReady || isSending" class="h-11 min-w-0 flex-1 border border-slate-300 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700 disabled:bg-slate-100" :placeholder="t('askBook')" />
        <button class="grid size-11 shrink-0 place-items-center bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300" :disabled="!isReady || !message.trim() || isSending" :aria-label="t('sendQuestion')" :title="t('sendQuestion')" type="submit">
          <Send :size="17" />
        </button>
      </div>
    </form>
  </section>
</template>
