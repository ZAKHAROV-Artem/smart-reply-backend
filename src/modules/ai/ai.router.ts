import { Router } from 'express'
import aiController from './ai.controller'

const router = Router()

router.post('/reply', aiController.generateReply)
router.post('/instructions', aiController.generateInstructions)

export default router
