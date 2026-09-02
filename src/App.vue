<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { supportedLocales, type SupportedLocale } from './i18n'
import BookChat from './components/BookChat.vue'
import type { CatalogBook, PreparedBook } from './domain/book'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Search,
} from '@lucide/vue'

const { locale, t } = useI18n()
const activeView = ref<'catalog' | 'book'>('catalog')
const books = ref<CatalogBook[]>([])
const selectedBook = ref<PreparedBook | null>(null)
const searchQuery = ref('')
const languageFilter = ref('all')
const selectedYearRange = ref<[number, number]>([0, 0])
const selectedChapter = ref('summary')
const catalogError = ref('')

function dataUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

const languages = computed(() => ['all', ...new Set(books.value.map((book) => book.language))])
const yearBounds = computed<[number, number]>(() => {
  if (books.value.length === 0) return [0, 0]

  return [
    Math.min(...books.value.map((book) => book.year)),
    Math.max(...books.value.map((book) => book.year)),
  ]
})

function setYearRange(boundary: 'minimum' | 'maximum', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  const [minimum, maximum] = selectedYearRange.value
  selectedYearRange.value = boundary === 'minimum'
    ? [Math.min(value, maximum), maximum]
    : [minimum, Math.max(value, minimum)]
}

function clearFilters() {
  searchQuery.value = ''
  languageFilter.value = 'all'
  selectedYearRange.value = [...yearBounds.value]
}

const filteredBooks = computed(() =>
  books.value.filter((book) => {
    const matchesSearch = `${book.title} ${book.author}`.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesLanguage = languageFilter.value === 'all' || book.language === languageFilter.value
    const matchesYear = book.year >= selectedYearRange.value[0] && book.year <= selectedYearRange.value[1]
    return matchesSearch && matchesLanguage && matchesYear
  }),
)

const readingContent = computed(() => {
  if (!selectedBook.value || selectedChapter.value === 'summary') return selectedBook.value?.overview ?? ''

  const chapter = selectedBook.value.chapters.find((item) => item.number === Number(selectedChapter.value))
  return chapter?.chunks.map((chunk) => chunk.text).join('\n\n') ?? ''
})

const readingTitle = computed(() => {
  if (!selectedBook.value || selectedChapter.value === 'summary') return t('bookSummary')

  return selectedBook.value.chapters.find((item) => item.number === Number(selectedChapter.value))?.title ?? ''
})

async function openBook(book: CatalogBook) {
  const response = await fetch(dataUrl(book.file))
  if (!response.ok) {
    catalogError.value = 'This book could not be loaded.'
    return
  }

  selectedBook.value = await response.json() as PreparedBook
  selectedChapter.value = 'summary'
  activeView.value = 'book'
}

function bookInitials(book: CatalogBook) {
  return book.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function setLocale(event: Event) {
  const selectedLocale = (event.target as HTMLSelectElement).value as SupportedLocale
  locale.value = selectedLocale
  localStorage.setItem('libreria.locale', selectedLocale)
}

onMounted(async () => {
  const response = await fetch(dataUrl('data/catalogo.json'))
  if (!response.ok) {
    catalogError.value = 'The local catalog could not be loaded.'
    return
  }

  books.value = await response.json() as CatalogBook[]
  selectedYearRange.value = [...yearBounds.value]
})
</script>

<template>
  <div class="min-h-screen bg-[#f6f7f5] text-slate-800">
    <main>
      <template v-if="activeView === 'catalog'">
        <header class="border-b border-slate-200 bg-white px-6 py-5 sm:px-10">
          <div class="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="grid size-9 place-items-center bg-teal-700 text-sm font-bold text-white">LI</div>
              <div>
                <p class="text-xs text-slate-500">{{ t('library') }}</p>
                <h1 class="text-base font-semibold text-slate-950">librerIA</h1>
              </div>
            </div>
            <label class="relative block">
              <span class="sr-only">{{ t('language') }}</span>
              <select :value="locale" class="h-9 appearance-none border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-600 outline-none focus:border-teal-700" @change="setLocale">
                <option v-for="availableLocale in supportedLocales" :key="availableLocale" :value="availableLocale">{{ t(`languages.${availableLocale}`) }}</option>
              </select>
              <ChevronDown :size="16" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </label>
          </div>
        </header>

        <section class="mx-auto max-w-7xl px-6 py-9 sm:px-10">
          <div class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
            <div>
              <p class="text-sm text-slate-500">{{ t('catalog') }}</p>
              <h2 class="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{{ t('catalogLibrary') }}</h2>
            </div>
            <p class="text-sm text-slate-500">{{ t('booksAvailable', { count: filteredBooks.length }) }}</p>
          </div>

          <div class="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_minmax(260px,0.5fr)]">
            <label class="relative block">
              <span class="sr-only">{{ t('searchBooks') }}</span>
              <Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input v-model="searchQuery" class="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700" :placeholder="t('searchPlaceholder')" type="search" />
            </label>
            <label class="relative block">
              <span class="sr-only">{{ t('filterLanguage') }}</span>
              <select v-model="languageFilter" class="h-11 w-full appearance-none border border-slate-300 bg-white px-3 pr-9 text-sm outline-none focus:border-teal-700">
                <option v-for="language in languages" :key="language" :value="language">{{ language === 'all' ? t('allLanguages') : t(`languages.${language}`) }}</option>
              </select>
              <ChevronDown :size="16" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </label>
            <fieldset class="border border-slate-300 bg-white px-3 py-2.5">
              <legend class="sr-only">{{ t('filterYear') }}</legend>
              <div class="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>{{ t('filterYear') }}</span>
                <span>{{ selectedYearRange[0] }} - {{ selectedYearRange[1] }}</span>
              </div>
              <div class="relative mt-1.5 h-4">
                <input class="absolute inset-0 h-4 w-full cursor-pointer accent-teal-700" :min="yearBounds[0]" :max="yearBounds[1]" :value="selectedYearRange[0]" type="range" :aria-label="t('earliestYear')" @input="setYearRange('minimum', $event)" />
                <input class="absolute inset-0 h-4 w-full cursor-pointer accent-teal-700" :min="yearBounds[0]" :max="yearBounds[1]" :value="selectedYearRange[1]" type="range" :aria-label="t('latestYear')" @input="setYearRange('maximum', $event)" />
              </div>
            </fieldset>
          </div>

          <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article v-for="book in filteredBooks" :key="book.id" class="flex min-h-72 flex-col border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-start gap-4">
                <div class="grid size-14 shrink-0 place-items-center bg-amber-200 text-sm font-bold text-slate-700">{{ bookInitials(book) }}</div>
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ t(`languages.${book.language}`) }} · {{ book.year }}</p>
                  <h3 class="mt-2 text-lg font-semibold leading-6 text-slate-950">{{ book.title }}</h3>
                  <p class="mt-1 text-sm text-slate-600">{{ book.author }}</p>
                </div>
              </div>
              <p class="mt-5 text-sm leading-6 text-slate-600">{{ t('preparedText') }}</p>
              <button class="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 border border-teal-700 bg-teal-700 text-sm font-medium text-white transition hover:bg-teal-800 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700" @click="openBook(book)">
                {{ t('openBook') }}
                <BookOpen :size="16" />
              </button>
            </article>
          </div>

          <div v-if="filteredBooks.length === 0" class="mt-8 grid min-h-56 place-items-center border border-dashed border-slate-300 bg-white text-center">
            <div>
              <Search :size="24" class="mx-auto text-slate-400" />
              <p class="mt-3 text-sm font-medium text-slate-700">{{ t('noBooks') }}</p>
              <button class="mt-2 text-sm text-teal-700 underline underline-offset-4" @click="clearFilters">{{ t('clearFilters') }}</button>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="selectedBook">
        <header class="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 sm:px-10">
          <div class="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div class="flex min-w-0 items-center gap-4">
              <button class="grid size-9 shrink-0 place-items-center border border-slate-300 text-slate-600 hover:bg-slate-50" :aria-label="t('returnToCatalog')" :title="t('returnToCatalog')" @click="activeView = 'catalog'">
                <ArrowLeft :size="18" />
              </button>
              <div class="min-w-0">
                <p class="text-xs text-slate-500">{{ t('bookWorkspace') }}</p>
                <h1 class="truncate text-base font-semibold text-slate-950">{{ selectedBook.title }}</h1>
              </div>
            </div>
            <label class="relative block shrink-0">
              <span class="sr-only">{{ t('language') }}</span>
              <select :value="locale" class="h-9 appearance-none border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-600 outline-none focus:border-teal-700" @change="setLocale">
                <option v-for="availableLocale in supportedLocales" :key="availableLocale" :value="availableLocale">{{ t(`languages.${availableLocale}`) }}</option>
              </select>
              <ChevronDown :size="16" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </label>
          </div>
        </header>

        <section class="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <BookChat :book="selectedBook" />

          <aside class="bg-[#fbfaf7]" aria-labelledby="reading-heading">
            <div class="border-b border-slate-200 px-6 py-5 sm:px-8">
              <div class="flex items-center justify-between gap-3">
                <div><p class="text-xs text-slate-500">{{ t('readingPanel') }}</p><h2 id="reading-heading" class="mt-1 font-semibold text-slate-950">{{ readingTitle }}</h2></div>
                <BookOpen :size="19" class="text-slate-500" />
              </div>
              <label class="relative mt-4 block">
                <span class="sr-only">{{ t('selectReadingContent') }}</span>
                <select v-model="selectedChapter" class="h-10 w-full appearance-none border border-slate-300 bg-white px-3 pr-9 text-sm outline-none focus:border-teal-700">
                  <option value="summary">{{ t('bookSummary') }}</option>
                  <option v-for="chapter in selectedBook.chapters" :key="chapter.number" :value="String(chapter.number)">
                    Chapter {{ chapter.number }}: {{ chapter.title }}
                  </option>
                </select>
                <ChevronDown :size="16" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </label>
            </div>
            <article class="px-6 py-8 sm:px-8">
              <p class="text-xs font-medium uppercase tracking-wide text-teal-700">{{ selectedBook.author }} · {{ selectedBook.year }}</p>
              <h3 class="mt-3 font-serif text-3xl leading-tight text-slate-950">{{ selectedBook.title }}</h3>
              <p class="mt-7 whitespace-pre-line font-serif text-lg leading-8 text-slate-700">{{ readingContent }}</p>
            </article>
          </aside>
        </section>
      </template>
    </main>
  </div>
</template>
