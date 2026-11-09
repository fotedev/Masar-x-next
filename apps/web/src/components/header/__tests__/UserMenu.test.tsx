import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    const { src, alt, ...rest } = props;
    return <img src={String(src)} alt={String(alt ?? "")} {...rest} />;
  },
}));

import { UserMenu } from "../UserMenu";

const tNav = (key: string) => `nav.${key}`;

const baseUser = {
  id: "u-1",
  email: "student@example.com" as string | undefined,
  user_metadata: {} as { full_name?: string; avatar_url?: string },
};

const baseProps = {
  isMounted: true,
  loading: false,
  user: null as typeof baseUser | null,
  profile: null as { avatarUrl?: string | null } | null,
  isAdmin: false,
  isAdminLoading: false,
  compact: false,
  handleNavigate: vi.fn(),
  handleSignOut: vi.fn(),
  tNav,
};

function renderMenu(overrides: Partial<typeof baseProps> = {}) {
  return render(<UserMenu {...baseProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserMenu", () => {
  it("renders skeleton placeholders while loading or unmounted", () => {
    const { rerender } = renderMenu({ isMounted: false });
    expect(document.querySelectorAll(".animate-pulse").length).toBe(2);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<UserMenu {...baseProps} isMounted loading />);
    expect(document.querySelectorAll(".animate-pulse").length).toBe(2);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("compact skeleton uses two stacked circle placeholders", () => {
    const { container } = renderMenu({ isMounted: false, compact: true });
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBe(2);
    expect(pulses[0].className).toContain("rounded-full");
    expect(pulses[0].className).not.toContain("rounded-lg");
  });

  it("guest sees login and signup buttons wired to handleNavigate", async () => {
    const user = userEvent.setup();
    renderMenu({ user: null });
    await user.click(screen.getByRole("button", { name: "nav.login" }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("login");
    await user.click(screen.getByRole("button", { name: "nav.signup" }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("signup");
  });

  it("compact guest uses icon buttons with aria-labels", async () => {
    const user = userEvent.setup();
    renderMenu({ user: null, compact: true });
    await user.click(screen.getByRole("button", { name: "nav.login" }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("login");
    await user.click(screen.getByRole("button", { name: "nav.signup" }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("signup");
  });

  it("member shows the avatar with the email initial and navigates to profile", async () => {
    const user = userEvent.setup();
    renderMenu({ user: baseUser });
    const avatar = screen.getByRole("button", { name: "nav.profile" });
    expect(avatar.textContent).toContain("S");
    await user.click(avatar);
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("profile");
  });

  it("full_name takes precedence over email for the initial", () => {
    renderMenu({
      user: {
        ...baseUser,
        user_metadata: { full_name: "amr khaled" },
      },
    });
    expect(screen.getByRole("button", { name: "nav.profile" }).textContent).toContain("A");
  });

  it("profile avatarUrl renders through next/image (stubbed img)", () => {
    renderMenu({
      user: baseUser,
      profile: { avatarUrl: "https://cdn.example.com/a.png" },
    });
    const img = screen.getByRole("button", { name: "nav.profile" }).querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/a.png");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("sign-out button calls handleSignOut", async () => {
    const user = userEvent.setup();
    renderMenu({ user: baseUser });
    await user.click(screen.getByRole("button", { name: "nav.logout" }));
    expect(baseProps.handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("admin button renders only when isAdmin && !isAdminLoading", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu({ user: baseUser, isAdmin: true, isAdminLoading: true });
    expect(screen.queryByRole("button", { name: /Admin/ })).toBeNull();

    rerender(<UserMenu {...baseProps} user={baseUser} isAdmin isAdminLoading={false} />);
    await user.click(screen.getByRole("button", { name: /Admin/ }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("admin-dashboard");

    rerender(<UserMenu {...baseProps} user={baseUser} isAdmin={false} isAdminLoading={false} />);
    expect(screen.queryByRole("button", { name: /Admin/ })).toBeNull();
  });

  it("compact member exposes admin/logout via aria-labels", async () => {
    const user = userEvent.setup();
    renderMenu({ user: baseUser, isAdmin: true, isAdminLoading: false, compact: true });
    await user.click(screen.getByRole("button", { name: "nav.admin" }));
    expect(baseProps.handleNavigate).toHaveBeenCalledWith("admin-dashboard");
    await user.click(screen.getByRole("button", { name: "nav.logout" }));
    expect(baseProps.handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("avatar falls back to '?' when neither name nor email exists", () => {
    renderMenu({ user: { id: "u-2", email: undefined, user_metadata: {} } });
    expect(screen.getByRole("button", { name: "nav.profile" }).textContent).toContain("?");
  });

  it("image error falls back to the initial (onError flips to fallback)", async () => {
    renderMenu({
      user: baseUser,
      profile: { avatarUrl: "https://cdn.example.com/broken.png" },
    });
    const avatar = screen.getByRole("button", { name: "nav.profile" });
    const img = avatar.querySelector("img");
    expect(img).not.toBeNull();
    await waitFor(() => {
      img?.dispatchEvent(new Event("error"));
      expect(avatar.querySelector("img")).toBeNull();
    });
  });
});
