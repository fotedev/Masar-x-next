import { type TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = ({
  className = "",
  ...props
}: TextareaProps) => {
    return (
      <textarea
        className={`flex min-h-[80px] w-full rounded-md border border-input bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
};

Textarea.displayName = "Textarea";
