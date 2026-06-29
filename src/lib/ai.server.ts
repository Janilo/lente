// Helper de IA OpenAI-compatível. A URL base vem de AI_GATEWAY_URL (com fallback
// pro gateway do Lovable) e a chave de AI_API_KEY ?? LOVABLE_API_KEY (resolvida no
// call site). Trocar de provider (OpenRouter, Google, OpenAI…) é só setar
// AI_GATEWAY_URL + AI_API_KEY como secrets do Worker — sem mexer no código.
// Lido em runtime (por request), não no load do módulo.
export function aiGatewayUrl(): string {
  return process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1";
}

/** Endpoint completo de chat completions do provider de IA configurado. */
export function aiChatUrl(): string {
  return `${aiGatewayUrl()}/chat/completions`;
}
