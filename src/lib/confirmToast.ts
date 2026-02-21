import { toast } from "sonner";

type ConfirmToastOptions = {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function confirmToast(
  message: string,
  options: ConfirmToastOptions = {},
): Promise<boolean> {
  const {
    description,
    confirmLabel = "تأكيد",
    cancelLabel = "إلغاء",
  } = options;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    toast(message, {
      description,
      duration: Infinity,
      action: {
        label: confirmLabel,
        onClick: () => settle(true),
      },
      cancel: {
        label: cancelLabel,
        onClick: () => settle(false),
      },
      onDismiss: () => settle(false),
    });
  });
}
