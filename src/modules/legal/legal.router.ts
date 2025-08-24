import { Router } from 'express'
import path from 'path'
import fs from 'fs'

const legalRouter = Router()

// Helper to send a markdown file if it exists
function sendLegalFile(res: any, filename: string) {
  const filePath = path.resolve(__dirname, '../../../../docs', filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  res.sendFile(filePath)
}

legalRouter.get('/privacy-policy', (_req, res) => {
  sendLegalFile(res, 'privacy-policy.md')
})

legalRouter.get('/terms-of-use', (_req, res) => {
  sendLegalFile(res, 'terms-of-use.md')
})

export default legalRouter
