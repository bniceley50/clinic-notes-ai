import { LoginPageClient } from "./LoginPageClient";

const ERROR_MESSAGES: Record<string, string> = {
  no_invite: "Your email hasn't been invited yet. Contact your administrator.",
  bootstrap_failed: "Account setup failed. Please try again or contact support.",
  invalid_token: "Your sign-in link has expired. Please request a new one.",
  missing_token: "Invalid sign-in link. Please request a new one.",
  auth_callback_failed: "Sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawError = resolvedSearchParams.error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const callbackErrorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? null : null;

  return <LoginPageClient callbackErrorMessage={callbackErrorMessage} />;
}
