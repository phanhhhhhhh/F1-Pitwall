import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ExportButton from "./ExportButton";

describe("ExportButton", () => {
  it("shows the label, then a checkmark once the export resolves", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn().mockResolvedValue(undefined);
    render(<ExportButton label="EXPORT CSV" onClick={onClick} />);

    const button = screen.getByRole("button", { name: /EXPORT CSV/ });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    // "✓" and "DONE" are adjacent sibling text nodes, not their own elements —
    // the button's own text content is what actually changes.
    await waitFor(() => expect(button).toHaveTextContent("DONE"));
  });

  it("disables the button while the export is in flight", async () => {
    let resolveExport: () => void = () => {};
    const onClick = vi.fn(
      () => new Promise<void>((resolve) => { resolveExport = resolve; })
    );
    const user = userEvent.setup();
    render(<ExportButton label="EXPORT PDF" onClick={onClick} />);

    const button = screen.getByRole("button", { name: /EXPORT PDF/ });
    await user.click(button);

    expect(button).toBeDisabled();
    resolveExport();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("alerts and re-enables the button when the export rejects", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const onClick = vi.fn().mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ExportButton label="EXPORT CSV" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: /EXPORT CSV/ }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Export failed. Please try again."));
    expect(screen.getByRole("button")).not.toBeDisabled();
    alertSpy.mockRestore();
  });
});
