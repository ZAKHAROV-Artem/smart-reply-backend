import OpenAI from 'openai'
import createError from 'http-errors'
import { requireEnv } from '../../shared/utils/env'

const openai = new OpenAI({
  apiKey: requireEnv('OPENAI_API_KEY'),
})

class AiService {
  /* ------------------------------------------------------------------
    REPLY GENERATION (Selected text + user context)
  ------------------------------------------------------------------ */
  public async generateReply(
    text: string,
    context: {
      description: string
      instructions: string
      name: string
      tone: string
    },
  ): Promise<{ reply: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const systemPrompt = `You are an AI assistant helping to generate replies to selected text. The user has created a custom persona/character for you to embody when crafting responses.

PERSONA DETAILS:
- Name: "${context.name}" (this is a user-created persona name - it could be anything from a professional role to a fictional character)
- Description: ${context.description}
- Tone: ${context.tone}

INSTRUCTIONS FOR THIS PERSONA:
${context.instructions}

TASK:
You will receive selected text that the user wants you to reply to. Your job is to:
1. Analyze the selected text carefully
2. Generate a thoughtful, relevant reply that embodies the persona described above
3. Follow the specific instructions provided for this persona
4. Maintain the specified tone throughout your response
5. Ensure your reply is contextually appropriate and helpful

The selected text you'll be replying to will be provided as the user message. Generate your response as if you are the persona "${context.name}" responding to that text.`

    try {
      const response = await openai.chat.completions.create({
        messages: [
          { content: systemPrompt, role: 'system' },
          { content: text, role: 'user' },
        ],
        model: 'gpt-3.5-turbo-0125',
        temperature: 0.7,
      })

      return {
        reply: response.choices?.[0]?.message?.content ?? '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens ?? 0,
              completionTokens: response.usage.completion_tokens ?? 0,
            }
          : undefined,
      }
    } catch (err) {
      console.error('OpenAI generateReply error', err)
      throw createError(500, 'Failed to generate reply', { code: 'OPENAI_ERROR' })
    }
  }

  public async generateInstructions(context: {
    name: string
    description: string
    tone: string
  }): Promise<{ instructions: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const systemPrompt = `You are an expert prompt engineer. Using the details provided, craft comprehensive system instructions that will guide ChatGPT to respond as the described persona in a professional setting.\n\nDETAILS ABOUT THE PERSONA:\n- Name: "${context.name}"\n- Description: ${context.description}\n- Tone: ${context.tone}\n\nREQUIREMENTS:\n1. Write clear, actionable instructions that the AI should follow when replying on behalf of this persona.\n2. Include perspective, style, do's and don'ts, and domain expertise when relevant.\n3. Output ONLY the final instructions text without any additional commentary, headings, or markdown.`

    try {
      const response = await openai.chat.completions.create({
        messages: [{ content: systemPrompt, role: 'system' }],
        model: 'gpt-3.5-turbo-0125',
        temperature: 0.7,
      })

      return {
        instructions: response.choices?.[0]?.message?.content ?? '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens ?? 0,
              completionTokens: response.usage.completion_tokens ?? 0,
            }
          : undefined,
      }
    } catch (err) {
      console.error('OpenAI generateInstructions error', err)
      throw createError(500, 'Failed to generate instructions', { code: 'OPENAI_ERROR' })
    }
  }
}

const aiService = new AiService()
export default aiService
