<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cpu, Download, TriangleAlert } from '@lucide/vue'
import { useBookExpert } from '../composables/useBookExpert'

const { t } = useI18n()
const { support, isLoading, isReady, progressMessage, progressPercent, failure, checkSupport, enable } = useBookExpert()

onMounted(checkSupport)
</script>

<template>
  <div v-if="!isReady" class="border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm sm:px-8">
    <p v-if="!support" class="text-slate-500">{{ t('ai.checking') }}</p>

    <div v-else-if="support.status === 'unsupported'" class="flex gap-3">
      <TriangleAlert :size="18" class="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p class="font-medium text-slate-800">{{ t('ai.unsupportedTitle') }}</p>
        <p class="mt-1 leading-6 text-slate-600">{{ t('ai.unsupportedBody') }}</p>
        <p class="mt-2 leading-6 text-slate-600">{{ t('ai.searchModeNotice') }}</p>
      </div>
    </div>

    <div v-else-if="isLoading">
      <div class="flex items-center justify-between gap-3">
        <p class="font-medium text-slate-800">{{ t('ai.loadingTitle') }}</p>
        <span class="tabular-nums text-slate-500">{{ progressPercent }}%</span>
      </div>
      <div class="mt-2 h-1.5 w-full bg-slate-200">
        <div class="h-full bg-teal-700 transition-[width]" :style="{ width: `${progressPercent}%` }" />
      </div>
      <p class="mt-2 leading-6 text-slate-600">{{ t('ai.loadingBody') }}</p>
      <p v-if="progressMessage" class="mt-1 truncate text-xs text-slate-500">{{ progressMessage }}</p>
    </div>

    <div v-else class="flex gap-3">
      <Cpu :size="18" class="mt-0.5 shrink-0 text-teal-700" />
      <div class="min-w-0">
        <p class="font-medium text-slate-800">{{ t('ai.enableTitle') }}</p>
        <p class="mt-1 leading-6 text-slate-600">{{ t('ai.enableBody') }}</p>
        <p v-if="failure" class="mt-2 leading-6 text-red-700">{{ t('ai.failureTitle') }} {{ failure }}</p>
        <button class="mt-3 inline-flex h-10 items-center gap-2 border border-teal-700 bg-teal-700 px-4 text-sm font-medium text-white transition hover:bg-teal-800" @click="enable">
          <Download :size="16" />
          {{ failure ? t('ai.retry') : t('ai.enableButton') }}
        </button>
      </div>
    </div>
  </div>
</template>
