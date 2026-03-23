// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const mockCreateClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function changeValue(
  input: HTMLInputElement,
  value: string,
): Promise<void> {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (!valueSetter) {
    throw new Error("HTMLInputElement value setter not found");
  }

  await act(async () => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("LoginPageClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let replaceMock: ReturnType<typeof vi.fn>;
  let signInWithPasswordMock: ReturnType<typeof vi.fn>;
  let resetPasswordForEmailMock: ReturnType<typeof vi.fn>;
  let LoginPageClient: typeof import("@/app/login/LoginPageClient").LoginPageClient;

  beforeEach(async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;

    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    fetchMock = vi.fn();
    replaceMock = vi.fn();
    signInWithPasswordMock = vi.fn();
    resetPasswordForEmailMock = vi.fn();

    mockCreateClient.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
      },
    });

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "http://localhost:3000",
        replace: replaceMock,
      },
    });

    ({ LoginPageClient } = await import("@/app/login/LoginPageClient"));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function renderLogin(): Promise<void> {
    await act(async () => {
      root.render(<LoginPageClient callbackErrorMessage={null} />);
    });
  }

  function getInputById(id: string): HTMLInputElement {
    const input = container.querySelector(`#${id}`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Input not found: ${id}`);
    }

    return input;
  }

  function getButtonByText(text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes(text),
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button not found: ${text}`);
    }

    return button;
  }

  async function submitForm(): Promise<void> {
    const form = container.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Form not found");
    }

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("signs in with password, exchanges the token, and redirects to sessions", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: { access_token: "supabase-token" } },
      error: null,
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await renderLogin();
    await changeValue(getInputById("email"), "therapist@example.com");
    await changeValue(getInputById("password"), "Password123!");
    await submitForm();
    await flushPromises();

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "therapist@example.com",
      password: "Password123!",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "supabase-token" }),
    });
    expect(replaceMock).toHaveBeenCalledWith("/sessions");
  });

  it("shows a generic invalid credentials error for all auth failures", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { message: "User not found" },
    });

    await renderLogin();
    await changeValue(getInputById("email"), "therapist@example.com");
    await changeValue(getInputById("password"), "WrongPassword!");
    await submitForm();
    await flushPromises();

    expect(container.textContent).toContain("Invalid email or password");
    expect(container.textContent).not.toContain("User not found");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a password reset email and shows the confirmation state", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    await renderLogin();
    await changeValue(getInputById("email"), "therapist@example.com");

    await act(async () => {
      getButtonByText("Forgot password?").dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await flushPromises();

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "therapist@example.com",
      {
        redirectTo: "http://localhost:3000/set-password",
      },
    );
    expect(container.textContent).toContain(
      "Check your email for a password reset link.",
    );
  });
});
