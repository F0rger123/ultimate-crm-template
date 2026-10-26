// The AI model each Alfred "slot" (the keys in Settings → AI Models) calls,
// shared by /api/call-model and the model watch (_lib/modelWatch.ts). The
// watch may swap a slot's model for a working one when a provider retires it
// — see effectiveModel() in _lib/modelOverrides.ts.

export type ModelDef = { modelId: string; provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "nvidia" | "openrouter" | "cerebras"; endpoint: string };

// Minimal mirror of src/lib/api.ts's MODELS — only the fields this proxy
// actually needs (provider/endpoint/modelId), duplicated rather than
// cross-imported since Cloudflare Pages Functions build separately from the
// Vite app under src/. Keep in sync with src/lib/api.ts's MODELS if a model
// is added/renamed/removed there.
export const MODELS: Record<string, ModelDef> = {
  claude: { modelId: "claude-sonnet-5-5", provider: "anthropic", endpoint: "https://api.anthropic.com/v1/messages" },
  openai: { modelId: "gpt-4o", provider: "openai", endpoint: "https://api.openai.com/v1/chat/completions" },
  gemini: { modelId: "gemini-2.5-flash", provider: "google", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" },
  groq: { modelId: "openai/gpt-oss-120b", provider: "groq", endpoint: "https://api.groq.com/openai/v1/chat/completions" },
  mistral: { modelId: "mistral-large-latest", provider: "mistral", endpoint: "https://api.mistral.ai/v1/chat/completions" },
  nvidia_kimi: { modelId: "deepseek-ai/deepseek-v4.1-flash", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_nemotron: { modelId: "nvidia/nemotron-3.5-lightning-30b-a3b", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_muse: { modelId: "meta/muse-glimmer-30b", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_deepseek_r1: { modelId: "moonshotai/kimi-k2.6", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  nvidia_qwen: { modelId: "nvidia/nemotron-3-super-120b-a12b", provider: "nvidia", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions" },
  openrouter: { modelId: "nvidia/nemotron-3-super-120b-a12b:free", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  cerebras: { modelId: "gpt-oss-120b", provider: "cerebras", endpoint: "https://api.cerebras.ai/v1/chat/completions" },
};
