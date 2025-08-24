import { Router } from 'express'
import contextController from './context.controller'

const router = Router()

router.get('/', contextController.list)
router.post('/', contextController.create)
router.put('/:id', contextController.update)
router.delete('/:id', contextController.delete)

export default router
