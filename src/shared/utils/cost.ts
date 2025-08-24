// Utility functions to convert OpenAI token usage into USD cost
// Prices are per 1K tokens as of 2024-04 (gpt-3.5-turbo-0125)

const TOKEN_PRICING_USD: Record<string, { prompt: number; completion: number }> = {
  'gpt-3.5-turbo-0125': {
    prompt: 0.0005, // $0.50 per 1M => 0.0005 per 1K
    completion: 0.0015, // $1.50 per 1M => 0.0015 per 1K
  },
}

export function calculateCostUSD(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = TOKEN_PRICING_USD[model]
  if (!pricing) {
    // Default to zero cost for unknown models to avoid blocking
    return 0
  }
  const promptCost = (promptTokens / 1000) * pricing.prompt
  const completionCost = (completionTokens / 1000) * pricing.completion
  // round to 6 decimal places to avoid tiny floats accumulating
  return Math.round((promptCost + completionCost) * 1e6) / 1e6
}
