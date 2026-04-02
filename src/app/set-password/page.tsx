import { SetPasswordClient } from "./SetPasswordClient";

// Nonce-based CSP requires per-request rendering so Next can attach the nonce
// to framework-managed scripts on password recovery links.
export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
