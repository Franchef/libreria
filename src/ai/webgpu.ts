export type WebGpuSupport =
  | { status: 'supported'; shaderF16: boolean }
  | { status: 'unsupported'; reason: 'no-api' | 'no-adapter' | 'error' }

export async function detectWebGpu(): Promise<WebGpuSupport> {
  if (!('gpu' in navigator)) return { status: 'unsupported', reason: 'no-api' }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return { status: 'unsupported', reason: 'no-adapter' }

    return { status: 'supported', shaderF16: adapter.features.has('shader-f16') }
  } catch {
    return { status: 'unsupported', reason: 'error' }
  }
}

export function modelIdFor(support: WebGpuSupport) {
  const quantization = support.status === 'supported' && support.shaderF16 ? 'q4f16_1' : 'q4f32_1'
  return `Qwen2.5-1.5B-Instruct-${quantization}-MLC`
}
