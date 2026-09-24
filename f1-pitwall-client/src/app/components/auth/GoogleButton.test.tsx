import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hardNavigate } = vi.hoisted(() => ({ hardNavigate: vi.fn() }));
vi.mock("../../lib/navigation", () => ({ hardNavigate }));

import { GoogleButton } from "./GoogleButton";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("GoogleButton", () => {
  it("stores a nonce and sends it to the API as client_state (not via a cookie)", async () => {
    render(<GoogleButton />);

    await userEvent.setup().click(screen.getByRole("link", { name: /continue with google/i }));

    const nonce = sessionStorage.getItem("oauth_state");
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    expect(hardNavigate).toHaveBeenCalledOnce();
    const url = String(hardNavigate.mock.calls[0][0]);
    expect(url).toMatch(/\/oauth2\/authorize\/google\?client_state=/);
    expect(url).toContain(`client_state=${nonce}`);
    expect(document.cookie).not.toContain("oauth_state");
  });

  it("uses a fresh nonce for every attempt", async () => {
    render(<GoogleButton />);
    const link = screen.getByRole("link", { name: /continue with google/i });
    const user = userEvent.setup();

    await user.click(link);
    const first = sessionStorage.getItem("oauth_state");
    await user.click(link);

    expect(sessionStorage.getItem("oauth_state")).not.toBe(first);
  });
});
