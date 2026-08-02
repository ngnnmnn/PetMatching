import { Suspense } from "react";
import CompleteGoogleProfileForm from "@/components/auth/CompleteGoogleProfileForm";

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)]" />}>
      <CompleteGoogleProfileForm />
    </Suspense>
  );
}
