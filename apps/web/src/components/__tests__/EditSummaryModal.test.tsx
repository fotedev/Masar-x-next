import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const editState = vi.hoisted(() => {
  const makeState = () => ({
    formData: {
      title: "Linear Algebra",
      subject: "Math",
      year: "2025",
      department: "General",
      content: "Summary body",
    },
    setFormData: undefined as unknown as ReturnType<typeof vi.fn>,
    semester: 1,
    setSemester: undefined as unknown as ReturnType<typeof vi.fn>,
    levels: [] as Array<{ id: string; name: string; level_number: number }>,
    subjects: [] as Array<{ id: string; name: string }>,
    availableDepartments: [] as string[],
    pdfFile: null as File | null,
    setPdfFile: undefined as unknown as ReturnType<typeof vi.fn>,
    loading: false,
    error: "",
    setError: undefined as unknown as ReturnType<typeof vi.fn>,
    attachmentType: "file" as "file" | "link",
    setAttachmentType: undefined as unknown as ReturnType<typeof vi.fn>,
    driveLink: "",
    setDriveLink: undefined as unknown as ReturnType<typeof vi.fn>,
    handleSubmit: undefined as unknown as ReturnType<typeof vi.fn>,
  });
  const state = makeState();
  return { ...state, reset: makeState, lastProps: { current: null as unknown } };
});

vi.mock("@/hooks/useEditSummary", () => ({
  useEditSummary: (props: unknown) => {
    editState.lastProps.current = props;
    return editState;
  },
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import { EditSummaryModal } from "../EditSummaryModal";

const summary = {
  id: "sum-1",
  title: "Linear Algebra",
  subject: "Math",
  year: "2025",
  department: "General",
  content: "Summary body",
} as unknown as Parameters<typeof EditSummaryModal>[0]["summary"];

const baseProps = {
  summary,
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn<(id: string, updates: unknown) => Promise<void>>(),
};

function renderModal(overrides: Partial<typeof baseProps> = {}) {
  return render(<EditSummaryModal {...baseProps} {...overrides} />);
}

beforeEach(() => {
  setMockIntlLocale("ar");
  Object.assign(editState, editState.reset());
  editState.setFormData = vi.fn();
  editState.setSemester = vi.fn();
  editState.setPdfFile = vi.fn();
  editState.setError = vi.fn();
  editState.setAttachmentType = vi.fn();
  editState.setDriveLink = vi.fn();
  editState.handleSubmit = vi.fn((e?: { preventDefault?: () => void }) =>
    e?.preventDefault?.(),
  );
  vi.clearAllMocks();
});

describe("EditSummaryModal", () => {
  it("renders nothing when closed", () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when there is no summary to edit", () => {
    const { container } = renderModal({ summary: null });
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog with the form fields and hands props to the hook", () => {
    const onSave = baseProps.onSave;
    renderModal();
    expect(screen.getByText("تعديل الملخص")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Linear Algebra")).toBeInTheDocument();

    expect(editState.lastProps.current).toMatchObject({
      summary,
      isOpen: true,
      onSave,
    });
  });

  it("shows the error banner from the hook state", () => {
    const { rerender } = renderModal();
    expect(screen.queryByText("failed to save")).toBeNull();

    editState.error = "failed to save";
    rerender(<EditSummaryModal {...baseProps} />);
    expect(screen.getByText("failed to save")).toBeInTheDocument();
  });

  it("submit routes through the hook's handleSubmit", () => {
    renderModal();
    fireEvent.submit(screen.getByRole("button", { name: "حفظ التغييرات" }).closest("form")!);
    expect(editState.handleSubmit).toHaveBeenCalledTimes(1);
    // onSave itself is only invoked by the real hook — the modal never calls it directly
    expect(baseProps.onSave).not.toHaveBeenCalled();
  });

  it("cancel and header close both call onClose", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderModal();

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);

    const xButton = container.querySelector(".lucide-x")?.closest("button");
    expect(xButton).not.toBeNull();
    await user.click(xButton!);
    expect(baseProps.onClose).toHaveBeenCalledTimes(2);
  });

  it("loading state disables submit and swaps the label", () => {
    const { rerender } = renderModal();
    const submit = screen.getByRole("button", { name: "حفظ التغييرات" });
    expect(submit).toBeEnabled();

    editState.loading = true;
    rerender(<EditSummaryModal {...baseProps} />);
    expect(screen.getByRole("button", { name: "جاري الحفظ..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "حفظ التغييرات" })).toBeNull();
  });

  it("forwards the same callback identities to the hook across re-renders", () => {
    const { rerender } = renderModal();
    const first = editState.lastProps.current as { onClose: unknown; onSave: unknown };
    rerender(<EditSummaryModal {...baseProps} />);
    const second = editState.lastProps.current as { onClose: unknown; onSave: unknown };
    // the props wrapper object is fresh per render, but the callbacks passed
    // down are the same references
    expect(second.onClose).toBe(first.onClose);
    expect(second.onSave).toBe(baseProps.onSave);
  });
});
