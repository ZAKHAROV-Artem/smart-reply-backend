import { prisma } from './prisma'
import { calculateCostUSD } from '../utils/cost'

/**
 * Persist OpenAI token usage for the current billing cycle.
 *
 * @param userId           Authenticated user id
 * @param model            OpenAI model name (e.g. gpt-3.5-turbo-0125)
 * @param promptTokens     Prompt tokens consumed
 * @param completionTokens Completion tokens consumed
 */
export async function recordTokenUsage(userId: string, model: string, promptTokens: number, completionTokens: number) {
  const now = new Date()

  // Determine billing cycle window – subscription cycle if present, else calendar month
  const subscription = await prisma.subscription.findFirst({
    where: {
      currentPeriodEnd: { gt: now },
      status: { in: ['ACTIVE', 'TRIALING'] },
      userId,
    },
  })

  const periodStart = subscription ? subscription.currentPeriodStart : new Date(now.getFullYear(), now.getMonth(), 1)

  const periodEnd = subscription ? subscription.currentPeriodEnd : new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const costUsd = calculateCostUSD(model, promptTokens, completionTokens)

  // @ts-ignore – tokenUsage will exist after `prisma generate`
  await prisma.tokenUsage.upsert({
    create: {
      completionTokens,
      periodEnd,
      periodStart,
      promptTokens,
      totalCostUsd: costUsd,
      userId,
    },
    update: {
      completionTokens: { increment: completionTokens },
      promptTokens: { increment: promptTokens },
      totalCostUsd: { increment: costUsd },
    },
    where: {
      // Unique composite constraint (userId, periodStart)
      userId_periodStart: {
        userId,
        periodStart,
      },
    },
  })
}
