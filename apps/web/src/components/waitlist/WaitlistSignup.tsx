"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Bell, Check, Loader2 } from "lucide-react";
import {
  WaitlistSignupSchema,
  type WaitlistSource,
} from "masarx-shared/types/schemas";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

type SubmitState =
  | "idle"
  | "invalid"
  | "submitting"
  | "success"
  | "duplicate"
  | "error";

interface WaitlistSignupProps {
  source: WaitlistSource;
  buttonLabel?: string;
  placeholder?: string;
  /** "compact" = tighter layout used inside the footer TRW card. */
  variant?: "inline" | "compact";
}

export function WaitlistSignup({
  source,
  buttonLabel,
  placeholder,
  variant = "inline",
}: WaitlistSignupProps) {
  const t = useTranslations("waitlist");
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");

  // Prefill the signed-in user's email once auth resolves, unless the
  // visitor already started typing their own address.
  useEffect(() => {
    if (!touched && user?.email) {
      setEmail(user.email);
    }
  }, [user?.email, touched]);

  const isTrw = source === "trw";
  const resolvedPlaceholder = placeholder ?? t("placeholder");
  const resolvedButtonLabel =
    buttonLabel ?? (isTrw ? t("trw.cta") : t("platform.cta"));
  const controlHeight = variant === "compact" ? "h-9" : "h-10";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = WaitlistSignupSchema.safeParse({ email, source });
    if (!parsed.success) {
      setState("invalid");
      return;
    }
    setState("submitting");
    try {
      const { error } = await supabase.from("waitlist").insert({
        email: parsed.data.email,
        source: parsed.data.source,
        user_id: user?.id ?? null,
      });
      if (error) {
        // 23505 = unique violation on (lower(email), source): already joined.
        setState(error.code === "23505" ? "duplicate" : "error");
        return;
      }
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success" || state === "duplicate") {
    return (
      <div aria-live="polite">
        {isTrw && (
          <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
            {t("trw.caption")}
          </p>
        )}
        <p
          className={
            state === "success"
              ? "flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm font-bold text-emerald-600 dark:text-emerald-400"
              : "flex items-center gap-2 rounded-lg bg-slate-500/10 px-3 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300"
          }
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{state === "success" ? t("success") : t("duplicate")}</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      {isTrw && (
        <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
          {t("trw.caption")}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        noValidate
        className={variant === "compact" ? "space-y-2" : "space-y-2.5"}
      >
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (!touched) setTouched(true);
            if (state !== "idle") setState("idle");
          }}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          autoComplete="email"
          className={`w-full ${controlHeight} px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-start focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors`}
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className={`w-full ${controlHeight} px-4 rounded-lg text-sm font-bold text-white inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
            isTrw
              ? "bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              : "bg-brand-blue hover:bg-brand-blue/90 shadow-md shadow-brand-blue/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          }`}
        >
          {state === "submitting" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          <span>{resolvedButtonLabel}</span>
        </button>
        {state === "invalid" && (
          <p
            className="text-xs font-bold text-amber-600 dark:text-amber-400"
            aria-live="polite"
          >
            {t("invalidEmail")}
          </p>
        )}
        {state === "error" && (
          <p
            className="text-xs font-bold text-red-600 dark:text-red-400"
            aria-live="polite"
          >
            {t("error")}
          </p>
        )}
      </form>
    </div>
  );
}
