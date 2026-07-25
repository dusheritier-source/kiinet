import { Suspense } from "react";
import CompleteProfileClient from "./CompleteProfileClient";

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <CompleteProfileClient />
    </Suspense>
  );
}
