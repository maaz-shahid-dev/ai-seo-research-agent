import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: "user" | "admin";
    status: "active" | "disabled";
    sessionVersion: number;
  }

  interface Session {
    user?: {
      id: string;
      role: "user" | "admin";
      status: "active" | "disabled";
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "user" | "admin";
    status?: "active" | "disabled";
    sessionVersion?: number;
  }
}
