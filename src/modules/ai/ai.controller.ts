import { Request, Response } from 'express'

import aiService from './ai.service'
import { CheaperRequest } from './types'
import { controllerHandler } from '../../shared/utils/controller-handler'
import { recordTokenUsage } from '../../shared/libs/tokenUsage'

class AiController {
  generateReply = controllerHandler(async (req, res) => {
    const { context, text } = req.body as {
      context?: {
        description: string
        instructions: string
        name: string
        tone: string
      }
      text?: string
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'Text is required' })
      return
    }
    if (!context) {
      res.status(400).json({ error: 'Context is required' })
      return
    }

    const result = await aiService.generateReply(text.trim(), context)

    // Persist token usage if available
    if (result.usage && req.user?.id) {
      await recordTokenUsage(
        req.user.id,
        'gpt-3.5-turbo-0125',
        result.usage.promptTokens,
        result.usage.completionTokens,
      )
    }

    res.json({ reply: result.reply })
    return
  })

  generateInstructions = controllerHandler(async (req, res) => {
    const { name, description, tone } = req.body as {
      name?: string
      description?: string
      tone?: string
    }

    if (!name || !description) {
      res.status(400).json({ error: 'Name and description are required' })
      return
    }

    const result = await aiService.generateInstructions({
      name: name.trim(),
      description: description.trim(),
      tone: tone?.trim() || 'professional',
    })

    if (result.usage && req.user?.id) {
      await recordTokenUsage(
        req.user.id,
        'gpt-3.5-turbo-0125',
        result.usage.promptTokens,
        result.usage.completionTokens,
      )
    }

    res.json({ instructions: result.instructions })
    return
  })
}

const aiController = new AiController()
export default aiController
