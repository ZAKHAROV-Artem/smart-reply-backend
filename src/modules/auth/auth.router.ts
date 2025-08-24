import { Router } from 'express'

import authController from './auth.controller'
import { auth } from '../../middleware/passport'

const router = Router()

router.get('/me', auth, authController.me)

router.post('/otp/send', authController.sendOtp)
router.post('/otp/verify', authController.verifyOtp)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)
router.post('/email/update', auth, authController.updateEmail)

export default router
