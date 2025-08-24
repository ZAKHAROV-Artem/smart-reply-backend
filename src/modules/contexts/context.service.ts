import { prisma } from '../../shared/libs/prisma'
import createError from 'http-errors'

export interface ContextPayload {
  name: string
  description: string
  instructions: string
  tone: string
}

class ContextService {
  async list(userId: string) {
    return prisma.context.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  }

  async create(userId: string, data: ContextPayload) {
    return prisma.context.create({ data: { ...data, userId } })
  }

  async update(userId: string, id: string, data: ContextPayload) {
    // Ensure the context belongs to the user
    const existing = await prisma.context.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      throw createError(404, 'Context not found', { code: 'NOT_FOUND' })
    }
    return prisma.context.update({ where: { id }, data })
  }

  async delete(userId: string, id: string) {
    const existing = await prisma.context.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      throw createError(404, 'Context not found', { code: 'NOT_FOUND' })
    }
    await prisma.context.delete({ where: { id } })
    return { id }
  }
}

export const contextService = new ContextService()
export default contextService
