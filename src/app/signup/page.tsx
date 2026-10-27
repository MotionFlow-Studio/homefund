import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free HomeFund account and see what is left until payday.",
  alternates: { canonical: "/signup" },
};

export default function SignUpPage() {
  return <SignUpForm />;
}
