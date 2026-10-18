import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-layout";
import { SignupForm } from "./signup-form";
import { SignupStory } from "./signup-story";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <AuthSplit aside={<SignupStory />}>
      <SignupForm />
    </AuthSplit>
  );
}
