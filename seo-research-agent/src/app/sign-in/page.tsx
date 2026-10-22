import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in | SEO Research Agent" };

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
