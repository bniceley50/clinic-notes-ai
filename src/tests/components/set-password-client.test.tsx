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

describe("SetPasswordClient", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let replaceMock: ReturnType<typeof vi.fn>;
  let getSessionMock: ReturnType<typeof vi.fn>;
  let onAuthStateChangeMock: ReturnType<typeof vi.fn>;
  let verifyOtpMock: ReturnType<typeof vi.fn>;
  let updateUserMock: ReturnType<typeof vi.fn>;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  let SetPasswordClient: typeof import("@/app/set-password/SetPasswordClient").SetPasswordClient;

  beforeEach(async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;

    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    fetchMock = vi.fn();
    replaceMock = vi.fn();
    getSessionMock = vi.fn();
    onAuthStateChangeMock = vi.fn();
    verifyOtpMock = vi.fn();
    updateUserMock = vi.fn();
    unsubscribeMock = vi.fn();

    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    });

    mockCreateClient.mockReturnValue({
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: onAuthStateChangeMock,
        verifyOtp: verifyOtpMock,
        updateUser: updateUserMock,
      },
    });

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "http://localhost:3000",
        search: "",
        replace: replaceMock,
      },
    });

    ({ SetPasswordClient } = await import("@/app/set-password/SetPasswordClient"));

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

  async function renderSetPassword(): Promise<void> {
    await act(async () => {
      root.render(<SetPasswordClient />);
    });
    await flushPromises();
  }

  function getInputById(id: string): HTMLInputElement {
    const input = container.querySelector(`#${id}`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Input not found: ${id}`);
    }

    return input;
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

  it("uses getSession immediately, subscribes to auth changes, and exchanges the app session after password set", async () => {
    const supabaseSession = { access_token: "supabase-token" };
    getSessionMock.mockResolvedValue({
      data: { session: supabaseSession },
    });
    updateUserMock.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await renderSetPassword();
    await changeValue(getInputById("password"), "Password123!");
    await changeValue(getInputById("confirm-password"), "Password123!");
    await submitForm();
    await flushPromises();

    expect(getSessionMock).toHaveBeenCalled();
    expect(onAuthStateChangeMock).toHaveBeenCalled();
    expect(updateUserMock).toHaveBeenCalledWith({ password: "Password123!" });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "supabase-token" }),
    });
    expect(replaceMock).toHaveBeenCalledWith("/sessions");
  });

  it("uses verifyOtp fallback for old token_hash query params", async () => {
    getSessionMock
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { access_token: "otp-token" } } });
    verifyOtpMock.mockResolvedValue({ error: null });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "http://localhost:3000",
        search: "?token_hash=abc123&type=invite",
        replace: replaceMock,
      },
    });

    await renderSetPassword();

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "abc123",
      type: "invite",
    });
    expect(container.textContent).toContain("Set your password");
    expect(container.textContent).toContain("Set Password");
  });

  it("shows a clear error when no session can be established", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await renderSetPassword();

    expect(container.textContent).toContain(
      "No active session. Please use a valid invite or reset link.",
    );
    expect(container.textContent).toContain("Return to sign in");
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
