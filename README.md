# librerIA

In this project you have an AI expert on a specific book.
You select the book and make it questions about the book.

## Local AI model

The application runs Qwen2.5-1.5B-Instruct locally in a WebLLM Web Worker.
It uses 4-bit weights: `q4f16_1` when WebGPU supports `shader-f16`, otherwise
`q4f32_1`. Model selection is in [webgpu.ts](src/ai/webgpu.ts).
The locked WebLLM version is 0.2.84.

### MiniCPM replacement evaluation (2026-11-03)

**Decision: retain Qwen for now.** MiniCPM5-1B Q4 is the first candidate to
benchmark if a compatible browser build becomes available, but neither equal
peak memory nor better book-answer quality has been demonstrated.

#### Memory

WebLLM 0.2.84 lists the following GPU-memory estimates for the current model,
with a 4,096-token context:

| Current model | WebLLM `vram_required_MB` |
| --- | ---: |
| Qwen2.5-1.5B-Instruct-q4f16_1-MLC | 1629.75 |
| Qwen2.5-1.5B-Instruct-q4f32_1-MLC | 1888.97 |

These are runtime estimates, not measured total browser RAM or weight download
sizes. Discrete GPU VRAM and system RAM are separate; integrated GPUs share
system memory. A replacement must be compared on the same device and backend.

The official MiniCPM5 GGUF repositories publish these file sizes (decimal GB):

| Candidate | Weight file size | Assessment |
| --- | ---: | --- |
| MiniCPM5-1B F16 | 2.167 GB | Weights alone exceed both current nominal memory estimates. |
| MiniCPM5-1B Q4_K_M | 0.688 GB | Most promising low-memory candidate; peak runtime memory unverified. |
| MiniCPM5-1B Q8_0 | 1.154 GB | Potential candidate, with less memory headroom than Q4. |
| MiniCPM5-2B Q4_K_M | 1.561 GB | Tight budget; equal peak memory cannot be assumed. |
| MiniCPM5-2B Q8_0 / F16 | 2.680 / 5.039 GB | Weights alone exceed both current nominal memory estimates. |

File size is not peak memory. For example, a conventional FP16 KV cache at
4,096 tokens adds approximately 0.101 GB for MiniCPM5-1B and 0.176 GB for
MiniCPM5-2B, before activations, runtime buffers, and browser overhead.
These are calculated lower-bound components, not measured footprints:
`2 * layers * KV heads * head dimension * tokens * 2 bytes`.
The models have 24/42 layers, 2 KV heads, and head dimension 128.
Do not enable their full 131,072-token context for this comparison.

BitCPM4-0.5B/1B uses ternary quantization, but its published Transformers
weights are **fake-quantized** and loaded as BF16. The advertised 1.58-bit
representation does not establish actual memory savings in this application.
MiniCPM3-4B and MiniCPM4-8B at ordinary 4-bit precision already require roughly
2/4 GB for weights alone, before quantization metadata and runtime overhead.

#### Compatibility and performance

- Neither the published WebLLM 0.2.84 model list nor the upstream model list
  contains MiniCPM. No MiniCPM conversion was returned by the official
  `mlc-ai` Hugging Face model listing at evaluation time.
- GGUF, MLX, and GPTQ are not interchangeable with WebLLM's MLC weights and
  compiled WebGPU WASM model library. Changing only the model ID would fail.
  MiniCPM5 uses a standard Llama architecture, making an MLC conversion worth
  investigating, but that does not prove tokenizer, chat-template, or compiled
  runtime compatibility.
- MiniCPM5 reports strong reasoning, coding, and tool-use benchmarks, but the
  published comparisons do not establish superiority to Qwen2.5-1.5B on this
  application's source-grounded English/Italian book questions. Its model
  cards list English and Chinese, not Italian.
- MiniCPM4's advertised generation acceleration relies on specialized
  inference systems such as CPM.cu; it is not a measured WebGPU speedup over
  the current model.
- MiniCPM5 supports thinking modes. A browser integration would need a tested
  non-thinking chat template so reasoning does not consume the current
  512-token answer budget or appear in the streamed answer.

No inference A/B benchmark was run: there is no verified compatible MiniCPM
build for the existing runtime. Changing to a native/server runtime would be
a separate architecture decision, not a drop-in replacement preserving the
current local, browser-only experience.

Before switching, run both quantized models on the same device with identical
retrieved passages, English/Italian questions, 4,096-token context,
temperature 0, and 512-token output limit. Measure cold-load peak memory,
warm-generation peak memory, time to first token, and tokens per second.
Assess supported facts, chapter attribution, correct refusal when evidence is
missing, instruction resistance, and language accuracy. Replace Qwen only
after the candidate fits the corresponding FP16/FP32 memory budget, improves
book-answer quality without a speed regression, and preserves streaming,
download caching, and offline use.

#### Sources

- [MiniCPM repository and release history](https://github.com/OpenBMB/MiniCPM)
- [Published WebLLM 0.2.84 bundle and model records](https://unpkg.com/@mlc-ai/web-llm@0.2.84/lib/index.js)
- [Upstream WebLLM model configuration](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)
- [MiniCPM5-1B model card](https://huggingface.co/openbmb/MiniCPM5-1B)
  and [configuration](https://huggingface.co/openbmb/MiniCPM5-1B/blob/main/config.json)
- [MiniCPM5-2B model card](https://huggingface.co/openbmb/MiniCPM5-2B)
  and [configuration](https://huggingface.co/openbmb/MiniCPM5-2B/blob/main/config.json)
- [MiniCPM5-1B GGUF files](https://huggingface.co/openbmb/MiniCPM5-1B-GGUF/tree/main)
  and [MiniCPM5-2B GGUF files](https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/tree/main)
- [BitCPM4-1B storage and inference details](https://huggingface.co/openbmb/BitCPM4-1B)
- [MiniCPM4-8B architecture and inference systems](https://huggingface.co/openbmb/MiniCPM4-8B)
