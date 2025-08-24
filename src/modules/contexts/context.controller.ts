import { controllerHandler } from '../../shared/utils/controller-handler'
import contextService, { ContextPayload } from './context.service'

class ContextController {
  list = controllerHandler(async (req, res) => {
    const userId = req.user?.id as string
    const contexts = await contextService.list(userId)
    res.json({ contexts })
  })

  create = controllerHandler(async (req, res) => {
    const userId = req.user?.id as string
    if (req.user?.isGuest) {
      res.status(403).json({ error: 'Guests cannot save contexts' })
      return
    }

    const { name, description, instructions, tone } = req.body as Partial<ContextPayload>
    if (!name || !description || !instructions || !tone) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }
    const ctx = await contextService.create(userId, {
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      tone: tone.trim(),
    })
    res.status(201).json({ context: ctx })
  })

  update = controllerHandler(async (req, res) => {
    const userId = req.user?.id as string
    if (req.user?.isGuest) {
      res.status(403).json({ error: 'Guests cannot save contexts' })
      return
    }
    const id = (req as any).params.id
    const { name, description, instructions, tone } = req.body as Partial<ContextPayload>
    if (!name || !description || !instructions || !tone) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }
    try {
      const ctx = await contextService.update(userId, id, {
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        tone: tone.trim(),
      })
      res.json({ context: ctx })
    } catch (err) {
      res.status(404).json({ error: 'Not found' })
    }
  })

  delete = controllerHandler(async (req, res) => {
    const userId = req.user?.id as string
    if (req.user?.isGuest) {
      res.status(403).json({ error: 'Guests cannot save contexts' })
      return
    }

    const id = (req as any).params.id
    try {
      await contextService.delete(userId, id)
      res.status(204).end()
    } catch {
      res.status(404).json({ error: 'Not found' })
    }
  })
}

export const contextController = new ContextController()
export default contextController
