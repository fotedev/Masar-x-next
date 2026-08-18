"use client";

/**
 * Masar X — Pathfinder mascot for the auth screens.
 *
 * A custom build of the "Robot Login" concept, branded for Masar X:
 *  - Brand colors (brand-blue / brand-orange / brand-sky)
 *  - Graduation cap on top (the Masar X learning signature)
 *  - Bilingual speech bubble, controlled by the `authPages.robot` namespace
 *  - Reacts to email/password focus + typing, turns around on password,
 *    meters password strength on its back panel, hypes on the
 *    submit button hover, presses on click, celebrates on success.
 *
 * Two modes:
 *   - "login"  → greets the user back, validates credentials
 *   - "signup" → walks a new user through creating an account
 *
 * The parent form tells it WHAT to react to via props, and calls
 * imperative methods (onEmailFocus, onPasswordFocus, reportError, …) on
 * the ref when key events happen.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

type Mood =
  | "idle"
  | "watching"
  | "happy"
  | "excited"
  | "pressed"
  | "success"
  | "shy"
  | "error";

export type AuthMode = "login" | "signup";

export interface LoginRobotHandle {
  onEmailFocus: () => void;
  onEmailBlur: () => void;
  onPasswordFocus: () => void;
  onPasswordBlur: () => void;
  /** Optional second password field focus/blur (signup confirm password) */
  onConfirmFocus?: () => void;
  onConfirmBlur?: () => void;
  reportError: (msg: string) => void;
  reportSuccess: (msg: string) => void;
  /** Apply a short celebratory spin to the head. */
  celebrate: () => void;
}

export interface LoginRobotProps {
  /** Current email value (so the robot can react while typing) */
  email: string;
  /** Current password value (drives the strength meter on the back) */
  password: string;
  /** When true, the robot looks at the email/password fields by default */
  watchingForm: boolean;
  /** True while the form is submitting. Disables hype/press reactions. */
  loading: boolean;
  /** True on a successful sign-in. Locks the robot in success mood. */
  success: boolean;
  /** True when the latest submit failed. Briefly puts the robot in a sad mood. */
  error: boolean;
  /** "login" (default) or "signup" — chooses which speech lines to use */
  mode?: AuthMode;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return score === 0 ? 1 : score;
}

/** Pull a translation key with mode-aware fallback (signup → login). */
function tx(
  t: ReturnType<typeof useTranslations>,
  mode: AuthMode,
  key: string,
): string {
  if (mode === "signup") {
    const v = t(`robot.signup.${key}`);
    if (v && v !== `robot.signup.${key}`) return v;
  }
  return t(`robot.${key}`);
}

/** Same as `tx` but for "lines" arrays stored as `|`-delimited strings. */
function txLines(
  t: ReturnType<typeof useTranslations>,
  mode: AuthMode,
  key: string,
): string[] {
  return tx(t, mode, key).split("|");
}

export const LoginRobot = forwardRef<LoginRobotHandle, LoginRobotProps>(
  function LoginRobot(
    {
      email,
      password,
      watchingForm,
      loading,
      success,
      error,
      mode = "login",
    },
    ref,
  ) {
    const t = useTranslations("authPages");

    const [mood, setMood] = useState<Mood>("idle");
    const [speech, setSpeech] = useState<string>(() => tx(t, mode, "intro"));
    const [score, setScore] = useState<number>(0);
    const [meterLabel, setMeterLabel] = useState<string>(() =>
      tx(t, mode, "meterIdle"),
    );

    const robotRef = useRef<HTMLDivElement | null>(null);
    const eyesRef = useRef<HTMLDivElement | null>(null);
    const headRef = useRef<HTMLDivElement | null>(null);
    const bubbleRef = useRef<HTMLDivElement | null>(null);

    // Stable ref to translations so callbacks don't re-create on every render.
    const tRef = useRef(t);
    useEffect(() => {
      tRef.current = t;
    }, [t]);
    const modeRef = useRef(mode);
    useEffect(() => {
      modeRef.current = mode;
    }, [mode]);

    const lastSaidRef = useRef<string>("");

    const say = useCallback((text: string) => {
      if (!text || text === lastSaidRef.current) return;
      lastSaidRef.current = text;
      setSpeech(text);
      if (bubbleRef.current) {
        bubbleRef.current.classList.remove("pop");
        // force reflow to restart the pop animation
        void bubbleRef.current.offsetWidth;
        bubbleRef.current.classList.add("pop");
      }
    }, []);

    const look = useCallback((x: number, y: number) => {
      if (eyesRef.current) {
        eyesRef.current.style.setProperty("--mx-lx", `${x}px`);
        eyesRef.current.style.setProperty("--mx-ly", `${y}px`);
      }
    }, []);

    const tilt = useCallback((ry: number, rx: number) => {
      if (headRef.current) {
        headRef.current.style.setProperty("--mx-ry", `${ry}deg`);
        headRef.current.style.setProperty("--mx-rx", `${rx}deg`);
      }
    }, []);

    const turnAway = useCallback((on: boolean) => {
      robotRef.current?.classList.toggle("is-turned", on);
    }, []);

    // ---- Greet on mount (in the current locale) -------------------
    useEffect(() => {
      const m = modeRef.current;
      setSpeech(tx(tRef.current, m, "intro"));
      setMeterLabel(tx(tRef.current, m, "meterIdle"));
    }, []);

    // ---- React to email typing -------------------------------------
    useEffect(() => {
      if (success || loading) return;
      const m = modeRef.current;
      if (EMAIL_RE.test(email.trim())) {
        setMood("happy");
        say(pick(txLines(tRef.current, m, "emailValidLines")));
      } else if (email.length > 0 && email.includes("@")) {
        setMood("watching");
        say(tx(tRef.current, m, "emailAlmost"));
      } else if (email.length > 0) {
        setMood("watching");
      } else {
        setMood("idle");
      }
    }, [email, success, loading, say]);

    // ---- React to password typing (drives the strength meter) ------
    useEffect(() => {
      const m = modeRef.current;
      const newScore = scorePassword(password);
      setScore(newScore);
      if (!password) {
        setMeterLabel(tx(tRef.current, m, "meterIdle"));
        return;
      }
      const labels = tx(tRef.current, m, "meterLevels").split("|");
      setMeterLabel(labels[Math.min(newScore, labels.length - 1)]);
    }, [password]);

    // ---- External "watching" + success/error/loading state ----------
    useEffect(() => {
      if (success) {
        setMood("success");
        return;
      }
      if (loading) {
        setMood("pressed");
        return;
      }
      if (error) {
        setMood("error");
        return;
      }
      if (watchingForm) {
        setMood((prev) => (prev === "shy" ? prev : "watching"));
      } else {
        setMood((prev) => (prev === "shy" ? prev : "idle"));
      }
    }, [watchingForm, success, loading, error]);

    // ---- Submit-button-driven hype + press gestures ----------------
    const onSubmitEnter = useCallback(() => {
      if (loading || success) return;
      if (robotRef.current?.classList.contains("is-pressed")) return;
      robotRef.current?.classList.add("is-hyped");
      turnAway(false);
      setMood("excited");
      const m = modeRef.current;
      say(pick(txLines(tRef.current, m, "buttonHyped")));
    }, [loading, success, say, turnAway]);

    const onSubmitLeave = useCallback(() => {
      if (loading || success) return;
      robotRef.current?.classList.remove("is-hyped");
      setMood("idle");
      const m = modeRef.current;
      say(tx(tRef.current, m, "buttonIdle"));
    }, [loading, success, say]);

    const onSubmitPress = useCallback(() => {
      if (loading || success) return;
      robotRef.current?.classList.add("is-pressed");
      setMood("pressed");
      const m = modeRef.current;
      say(pick(txLines(tRef.current, m, "buttonPressed")));
    }, [loading, success, say]);

    const onSubmitRelease = useCallback(() => {
      robotRef.current?.classList.remove("is-pressed");
      if (success) setMood("success");
      else if (loading) setMood("pressed");
      else setMood("excited");
    }, [success, loading]);

    useEffect(() => {
      const target = document.getElementById("mx-auth-submit");
      if (!target) return;
      const enter = () => onSubmitEnter();
      const leave = () => onSubmitLeave();
      const down = () => onSubmitPress();
      const up = () => onSubmitRelease();
      target.addEventListener("mouseenter", enter);
      target.addEventListener("mouseleave", leave);
      target.addEventListener("focus", enter);
      target.addEventListener("blur", leave);
      target.addEventListener("pointerdown", down);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
      return () => {
        target.removeEventListener("mouseenter", enter);
        target.removeEventListener("mouseleave", leave);
        target.removeEventListener("focus", enter);
        target.removeEventListener("blur", leave);
        target.removeEventListener("pointerdown", down);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
      };
    }, [onSubmitEnter, onSubmitLeave, onSubmitPress, onSubmitRelease]);

    // ---- Mouse-following eyes --------------------------------------
    useEffect(() => {
      if (typeof window === "undefined") return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      let raf = 0;
      let pending = false;
      const onMove = (e: MouseEvent) => {
        if (pending || success || !robotRef.current) return;
        const active = document.activeElement;
        if (active && active.tagName === "INPUT") return;
        pending = true;
        raf = window.requestAnimationFrame(() => {
          pending = false;
          if (!robotRef.current) return;
          const r = robotRef.current.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 260));
          const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 260));
          look(dx * 7, dy * 6);
          if (!robotRef.current.classList.contains("is-turned")) {
            tilt(dx * 12, -dy * 9);
          }
        });
      };
      document.addEventListener("mousemove", onMove);
      return () => {
        document.removeEventListener("mousemove", onMove);
        if (raf) cancelAnimationFrame(raf);
      };
    }, [success, look, tilt]);

    // ---- Periodic blink --------------------------------------------
    useEffect(() => {
      if (typeof window === "undefined") return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      let cancelled = false;
      const loop = () => {
        if (cancelled) return;
        const wait = 2600 + Math.random() * 2600;
        setTimeout(() => {
          if (cancelled) return;
          if (
            mood !== "success" &&
            !robotRef.current?.classList.contains("is-turned")
          ) {
            eyesRef.current?.classList.add("blink");
            setTimeout(
              () => eyesRef.current?.classList.remove("blink"),
              150,
            );
          }
          loop();
        }, wait);
      };
      loop();
      return () => {
        cancelled = true;
      };
    }, [mood]);

    // ---- Confetti on success ---------------------------------------
    useEffect(() => {
      if (!success) return;
      if (typeof window === "undefined") return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      const host = document.querySelector(".mx-login .scene");
      const btn = document.getElementById("mx-auth-submit");
      if (!host || !btn) return;
      const hostRect = host.getBoundingClientRect();
      const origin = btn.getBoundingClientRect();
      const ox = origin.left - hostRect.left + origin.width / 2;
      const oy = origin.top - hostRect.top;

      const colors = ["#3b82f6", "#0ea5e9", "#f59e0b", "#0f172a", "#ffffff"];
      const bits: HTMLSpanElement[] = [];
      for (let i = 0; i < 70; i += 1) {
        const bit = document.createElement("span");
        bit.className = "confetti";
        bit.style.background = colors[i % colors.length];
        if (Math.random() > 0.5) bit.style.borderRadius = "50%";
        host.appendChild(bit);
        bits.push(bit);

        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const speed = 240 + Math.random() * 380;
        const tx2 = Math.cos(angle) * speed;
        const ty2 = Math.sin(angle) * speed;
        const rot = 540 * (Math.random() > 0.5 ? 1 : -1);

        const anim = bit.animate(
          [
            {
              transform: `translate(${ox}px, ${oy}px) rotate(0deg) scale(1)`,
              opacity: 1,
            },
            {
              transform: `translate(${ox + tx2}px, ${oy + ty2 + 320}px) rotate(${rot}deg) scale(0.6)`,
              opacity: 0,
            },
          ],
          {
            duration: 1100 + Math.random() * 700,
            easing: "cubic-bezier(0.15,0.6,0.35,1)",
          },
        );
        anim.onfinish = () => bit.remove();
      }
      return () => {
        bits.forEach((b) => b.remove());
      };
    }, [success]);

    // ---- Imperative handle (called by the form fields / submit) ----
    useImperativeHandle(
      ref,
      (): LoginRobotHandle => ({
        onEmailFocus: () => {
          if (success) return;
          turnAway(false);
          setMood("watching");
          const m = modeRef.current;
          say(pick(txLines(tRef.current, m, "emailFocusLines")));
        },
        onEmailBlur: () => {
          // emotion is driven by value
        },
        onPasswordFocus: () => {
          if (success) return;
          setMood("shy");
          turnAway(true);
          look(0, 0);
          tilt(0, 0);
          const m = modeRef.current;
          say(tx(tRef.current, m, "passwordFocus"));
          setMeterLabel(tx(tRef.current, m, "meterShy"));
        },
        onPasswordBlur: () => {
          if (success) return;
          turnAway(false);
          setMood("idle");
          const m = modeRef.current;
          const labels = tx(tRef.current, m, "meterLevels").split("|");
          setMeterLabel(
            password.length === 0
              ? tx(tRef.current, m, "meterIdle")
              : labels[Math.min(score, labels.length - 1)],
          );
        },
        onConfirmFocus: () => {
          if (success) return;
          // keep facing away — confirm is a password
          setMood("shy");
          turnAway(true);
          look(0, 0);
          tilt(0, 0);
          if (modeRef.current === "signup") {
            say(tRef.current("robot.signup.confirmFocus"));
          }
        },
        onConfirmBlur: () => {
          if (success) return;
          turnAway(false);
          setMood("idle");
        },
        reportError: (msg) => {
          setMood("error");
          say(msg);
          window.setTimeout(() => {
            setMood("watching");
          }, 2400);
        },
        reportSuccess: (msg) => {
          setMood("success");
          say(msg);
          robotRef.current?.classList.remove("is-hyped");
        },
        celebrate: () => {
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          robotRef.current?.classList.add("is-spinning");
          window.setTimeout(
            () => robotRef.current?.classList.remove("is-spinning"),
            950,
          );
        },
      }),
      [say, turnAway, look, tilt, success, password, score],
    );

    // Pre-compute the cap / antenna / meter markup once.
    const meterBars = useMemo(
      () => [0, 1, 2, 3].map((i) => (
        <i key={i} className={score >= i + 1 ? "on" : ""} />
      )),
      [score],
    );

    return (
      <div className="stage">
        <div
          ref={robotRef}
          className="robot"
          data-mood={mood}
          aria-hidden="true"
        >
          <div
            className="bubble"
            ref={bubbleRef}
            role="status"
            aria-live="polite"
          >
            <span>{speech}</span>
          </div>

          {/* Graduation cap — the Masar X mascot signature */}
          <div className="cap">
            <span className="cap-board" />
            <span className="cap-mortar" />
            <span className="cap-tassel" />
          </div>

          <div className="antenna">
            <span className="antenna-rod" />
            <span className="antenna-tip" />
          </div>

          <div className="head3d" ref={headRef}>
            <div className="head">
              <span className="ear ear--l" />
              <span className="ear ear--r" />

              <div className="face face--front">
                <div className="visor">
                  <div className="eyes" ref={eyesRef}>
                    <span className="eye eye--l" />
                    <span className="eye eye--r" />
                  </div>
                  <span className="cheek cheek--l" />
                  <span className="cheek cheek--r" />
                  <span className="mouth" />
                </div>
              </div>

              <div className="face face--back">
                <div className="panel">
                  <span className="panel-lights">
                    <i />
                    <i />
                    <i />
                  </span>
                  <div className="meter" data-lvl={score}>
                    {meterBars}
                  </div>
                  <p className="panel-label">{meterLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
