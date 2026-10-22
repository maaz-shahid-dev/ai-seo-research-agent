import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

type SessionIdentity = {
  id: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  sessionVersion: number;
};

export function persistIdentityInToken(token: JWT, user?: User): JWT {
  if (user && isSessionIdentity(user)) {
    token.sub = user.id;
    token.role = user.role;
    token.status = user.status;
    token.sessionVersion = user.sessionVersion;
  }

  // Credentials sessions do not need profile data in the encrypted cookie.
  delete token.name;
  delete token.email;
  delete token.picture;
  return token;
}

export function exposeIdentityInSession(session: Session, token: JWT): Session {
  const identity = {
    id: token.sub,
    role: token.role,
    status: token.status,
    sessionVersion: token.sessionVersion,
  };

  if (!isSessionIdentity(identity)) {
    return { ...session, user: undefined };
  }

  return {
    ...session,
    user: identity,
  };
}

function isSessionIdentity(value: unknown): value is SessionIdentity {
  if (!value || typeof value !== "object") return false;

  const id = Reflect.get(value, "id");
  const role = Reflect.get(value, "role");
  const status = Reflect.get(value, "status");
  const sessionVersion = Reflect.get(value, "sessionVersion");

  return (
    typeof id === "string" &&
    id.length > 0 &&
    (role === "user" || role === "admin") &&
    (status === "active" || status === "disabled") &&
    Number.isSafeInteger(sessionVersion) &&
    Number(sessionVersion) >= 0
  );
}
