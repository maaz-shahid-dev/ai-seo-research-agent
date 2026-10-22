import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateCredentials } from "@/features/auth/service";
import { exposeIdentityInSession, persistIdentityInToken } from "@/features/auth/session";
import { runtimeEnvironmentSchema } from "@/server/config/environment-schema";
import { AppError } from "@/server/http/errors";
import { logger } from "@/server/logging/logger";
import { getClientAddress } from "@/server/security/request";

class SignInTemporarilyUnavailable extends CredentialsSignin {
  code = "try_again_later";
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  // Lazy validation keeps builds environment-agnostic while rejecting weak
  // or absent secrets before any authentication request is processed.
  secret: runtimeEnvironmentSchema.shape.AUTH_SECRET.parse(process.env.AUTH_SECRET),
  trustHost: process.env.AUTH_TRUST_HOST === "true" || Boolean(process.env.VERCEL),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email", autocomplete: "email" },
        password: { label: "Password", type: "password", autocomplete: "current-password" },
      },
      async authorize(credentials, request) {
        try {
          return await authenticateCredentials(credentials, getClientAddress(request));
        } catch (error) {
          if (error instanceof AppError && error.status < 500) {
            logger.warn(
              { code: error.code, status: error.status },
              "Credential sign-in was rejected by a security control",
            );
          } else {
            logger.error({ error }, "Credential sign-in is temporarily unavailable");
          }
          throw new SignInTemporarilyUnavailable();
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      return persistIdentityInToken(token, user);
    },
    session({ session, token }) {
      return exposeIdentityInSession(session, token);
    },
  },
}));
