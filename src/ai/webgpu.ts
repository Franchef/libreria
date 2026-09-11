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
  // Rileva se il browser supporta gli shader FP16 o deve ripiegare su FP32
  const quantization = support.status === 'supported' && support.shaderF16 ? 'q4f16_1' : 'q4f32_1'
  
  // Restituisce l'ID ufficiale per Llama 3.2 3B ottimizzato per WebLLM
  return `Llama-3.2-3B-Instruct-${quantization}-MLC`
}

/* qwen2.5-1.5B-Instruct-q4f16_1-MLC
export function modelIdFor(support: WebGpuSupport) {
  const quantization = support.status === 'supported' && support.shaderF16 ? 'q4f16_1' : 'q4f32_1'
  return `Qwen2.5-1.5B-Instruct-${quantization}-MLC`
}
*/

/*
export function modelIdFor(support: WebGpuSupport) {
  const quantization = support.status === 'supported' && support.shaderF16 ? 'q4f16_1' : 'q4f32_1'
  // Sostituisce Qwen 1.5B con Llama 3.2 3B
  return `Llama-3.2-3B-Instruct-${quantization}-MLC`
}*/

/*
export function modelIdFor(support: WebGpuSupport) {
  const quantization = support.status === 'supported' && support.shaderF16 ? 'q4f16_1' : 'q4f32_1'
  return `Phi3.5-mini-instruct-${quantization}-MLC`
}
*/
