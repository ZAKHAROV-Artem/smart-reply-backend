import { Router } from 'express'
import { billingController } from './billing.controller'
import { auth } from '../../middleware/passport'

const router = Router()

router.post('/checkout', auth, billingController.checkout)
router.post('/portal', auth, billingController.portal)
router.post('/gift', auth, billingController.gift)

// Public redirect endpoint used by Stripe (no auth)
router.get('/redirect', billingController.redirect)

router.get('/checkout-success', billingController.checkoutSuccess)
router.get('/checkout-cancel', billingController.checkoutCancel)

router.get('/usage', auth, billingController.usage)
router.post('/usage-plan', auth, billingController.usagePlan)

export default router
