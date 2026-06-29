"use client";
import { useEffect, useRef } from "react";

// Invisible form that auto-submits on mount, triggering the server action
// that sets the ae_admin cookie. The user never sees a login form.
export default function AdminAutoUnlock({ action }: { action: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);
  return (
    <form ref={formRef} action={action} style={{ display: "none" }}>
      <button type="submit" />
    </form>
  );
}
