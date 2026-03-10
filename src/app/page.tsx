import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionFromCookieHeader } from "@/lib/auth/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const session = await readSessionFromCookieHeader(cookieHeader || null);

  redirect(session ? "/sessions" : "/login");
}