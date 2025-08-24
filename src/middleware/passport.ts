import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import { Unauthorized } from 'http-errors'
import { prisma } from '../shared/libs/prisma'
import { requireEnv } from '../shared/utils/env'

const JWT_SECRET = requireEnv('JWT_SECRET')

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
    },
    async (payload: { userId: string; email: string }, done: (error: unknown, user?: unknown) => void) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } })
        if (!user) {
          throw new Unauthorized('Invalid token')
        }
        return done(null, user)
      } catch (err) {
        return done(err, false)
      }
    },
  ),
)

export const auth = passport.authenticate('jwt', { session: false })
export default passport
