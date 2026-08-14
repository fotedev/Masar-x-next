"use client";

/**
 * Masar X — Login page (Pathfinder edition).
 *
 * A branded rebuild of the auth screen featuring an interactive robot
 * mascot ("Masar") that:
 *   - greets the user in the current locale
 *   - watches their typing (eyes follow the form)
 *   - turns around when they're typing a password
 *   - measures password strength on its back panel
 *   - hypes when the user hovers the submit button
 *   - celebrates on success (with confetti)
 *
 * The actual auth flow is unchanged — Supabase email/password + Google,
 * the existing brute-force lockout, and the forgot-password path all
 * still work the same way.
 */

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Eye, EyeOff, ArrowLeft, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { supabase } from "@/lib/supabase";
import { useLocale, useTranslations } from "next-intl";
import { LoginRobot, type LoginRobotHandle } from "@/components/auth/LoginRobot";
import "@/components/auth/auth.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("authPages");
  const { signIn, signInWithGoogle, user } = useAuth();
  const { trackEvent, logError } = useAnalytics();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [watchingForm, setWatchingForm] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const robotRef = useRef<LoginRobotHandle | null>(null);
  const cardRef = useRef<HTMLFormElement | null>(null);
  // Avoid double-firing success navigation
  const successHandledRef = useRef(false);

  const onNavigate = useCallback(
    (page: string) => {
      if (page === "home") router.push(`/${locale}`);
      else router.push(`/${locale}/${page}`);
    },
    [router],
  );

  // Auto-redirect once a user lands here while already signed in
  useEffect(() => {
    if (user) onNavigate("home");
  }, [user, onNavigate]);

  // Restore the lockout timer from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("login_attempts");
      if (stored) {
        const { count, timestamp } = JSON.parse(stored) as {
          count: number;
          timestamp: number;
        };
        const timeDiff = Date.now() - timestamp;
        const lockoutDuration = Math.min(count * 30000, 300000);
        if (timeDiff < lockoutDuration) {
          setAttempts(count);
          setLockoutTime(lockoutDuration - timeDiff);
        } else {
          sessionStorage.removeItem("login_attempts");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Tick the lockout countdown
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setTimeout(() => {
      setLockoutTime((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutTime]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) {
      setError(t("lockoutWait", { seconds: Math.ceil(lockoutTime / 1000) }));
      return;
    }

    // Local validation — let the robot react first
    if (!email.trim()) {
      setError("");
      robotRef.current?.reportError(t("robot.errorNoEmail"));
      cardRef.current?.classList.remove("shake");
      void cardRef.current?.offsetWidth;
      cardRef.current?.classList.add("shake");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("");
      robotRef.current?.reportError(t("robot.errorBadEmail"));
      cardRef.current?.classList.remove("shake");
      void cardRef.current?.offsetWidth;
      cardRef.current?.classList.add("shake");
      return;
    }
    if (!password) {
      setError("");
      robotRef.current?.reportError(t("robot.errorNoPassword"));
      cardRef.current?.classList.remove("shake");
      void cardRef.current?.offsetWidth;
      cardRef.current?.classList.add("shake");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      setAttempts(0);
      setLockoutTime(0);
      localStorage.removeItem("login_attempts");
      trackEvent("login_success", { method: "email" });
      // Robot celebrates briefly before navigation
      robotRef.current?.reportSuccess(t("robot.success"));
      robotRef.current?.celebrate();
      successHandledRef.current = true;
      // The AuthContext observer will redirect via the `user` effect,
      // but kick off a fallback timer in case it doesn't.
      window.setTimeout(() => onNavigate("home"), 1400);
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const lockoutDuration = Math.min(newAttempts * 30000, 300000);
      sessionStorage.setItem(
        "login_attempts",
        JSON.stringify({ count: newAttempts, timestamp: Date.now() }),
      );

      const isAuthError = (e: unknown): e is { code: string } =>
        typeof e === "object" && e !== null && "code" in e;

      let message: string;
      if (newAttempts >= 20) {
        setLockoutTime(lockoutDuration);
        message = t("lockoutRepeated", {
          seconds: Math.ceil(lockoutDuration / 1000),
        });
      } else if (isAuthError(err) && err.code === "INVALID_CREDENTIALS") {
        message = t("invalidCredentials");
      } else {
        message = t("loginGenericError");
      }
      setError(message);
      logError(err instanceof Error ? err : String(err), {
        message: "Login failed",
        metadata: { method: "email" },
      });
      trackEvent("login_failure", { method: "email" });
      robotRef.current?.reportError(message);
      cardRef.current?.classList.remove("shake");
      void cardRef.current?.offsetWidth;
      cardRef.current?.classList.add("shake");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      trackEvent("login_success", { method: "google" });
    } catch (err) {
      logError(err instanceof Error ? err : String(err), {
        message: "Google login failed",
        metadata: { method: "google" },
      });
      trackEvent("login_failure", { method: "google" });
      const msg = t("googleLoginFailed");
      setError(msg);
      robotRef.current?.reportError(msg);
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      const msg = t("emailRequiredForReset");
      setError(msg);
      robotRef.current?.reportError(msg);
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess(t("resetLinkSent"));
      trackEvent("password_reset_requested", { method: "supabase_auth" });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("resetRequestFailed");
      setError(msg);
      logError(err instanceof Error ? err : String(err), {
        message: "Password reset failed",
        metadata: { method: "supabase_auth" },
      });
      trackEvent("password_reset_failure", { method: "supabase_auth" });
      robotRef.current?.reportError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="mx-auth">
      <div className="scene">
        <div className="w-full max-w-md">
          <LoginRobot
            ref={robotRef}
            email={email}
            password={password}
            watchingForm={watchingForm}
            loading={loading}
            success={successHandledRef.current}
            error={Boolean(error)}
            mode="login"
          />

          {showForgotPasswordForm ? (
            <form
              ref={(el) => {
                formRef.current = el;
                cardRef.current = el;
              }}
              className="card"
              onSubmit={handleForgotPassword}
              onFocus={() => setWatchingForm(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setWatchingForm(false);
                }
              }}
              noValidate
            >
              <span className="hand hand--l" aria-hidden="true" />
              <span className="hand hand--r" aria-hidden="true" />

              <h1 className="title">{t("forgotPasswordTitle")}</h1>
              <p className="subtitle">{t("forgotPasswordSubtitle")}</p>

              {(error || success) && (
                <div
                  className={`status ${
                    error ? "status--error" : "status--success"
                  }`}
                  role="alert"
                >
                  {error || success}
                </div>
              )}

              <label className="field">
                <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 7.3L4.4 7h15.2L12 12.3ZM4 9.2V17h16V9.2l-8 5.3-8-5.3Z" />
                </svg>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="user@example.com"
                  aria-label={t("emailLabel")}
                />
              </label>

              <button
                type="submit"
                className="btn"
                disabled={resetLoading || !email.trim()}
              >
                {resetLoading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>{t("sending")}</span>
                  </>
                ) : (
                  <span>{t("sendResetLink")}</span>
                )}
              </button>

              <div className="bottom">
                <button
                  type="button"
                  className="home-link"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setShowForgotPasswordForm(false);
                  }}
                >
                  <ArrowLeft
                    aria-hidden="true"
                    style={{
                      width: 14,
                      height: 14,
                      marginInlineEnd: 4,
                      verticalAlign: -2,
                      display: "inline-block",
                    }}
                  />
                  {t("backToLogin")}
                </button>
              </div>

              <span className="foot foot--l" aria-hidden="true" />
              <span className="foot foot--r" aria-hidden="true" />
            </form>
          ) : (
            <form
              ref={(el) => {
                formRef.current = el;
                cardRef.current = el;
              }}
              className="card"
              onSubmit={handleSubmit}
              onFocus={() => setWatchingForm(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setWatchingForm(false);
                }
              }}
              noValidate
            >
              <span className="hand hand--l" aria-hidden="true" />
              <span className="hand hand--r" aria-hidden="true" />

              <h1 className="title">{t("welcomeBackTitle")}</h1>
              <p className="subtitle">{t("loginSubtitle")}</p>

              {error && (
                <div className="status status--error" role="alert">
                  {error}
                </div>
              )}

              <label className="field">
                <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 7.3L4.4 7h15.2L12 12.3ZM4 9.2V17h16V9.2l-8 5.3-8-5.3Z" />
                </svg>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => robotRef.current?.onEmailFocus()}
                  placeholder="user@example.com"
                  aria-label={t("emailLabel")}
                />
              </label>

              <label className="field">
                <svg className="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Zm3 4a2 2 0 0 1 1 3.7V19h-2v-1.3a2 2 0 0 1 1-3.7Z" />
                </svg>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => robotRef.current?.onPasswordFocus()}
                  onBlur={() => robotRef.current?.onPasswordBlur()}
                  placeholder="••••••••"
                  aria-label={t("passwordLabel")}
                />
                <button
                  type="button"
                  className="peek"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" style={{ width: 20, height: 20 }} />
                  ) : (
                    <Eye aria-hidden="true" style={{ width: 20, height: 20 }} />
                  )}
                </button>
              </label>

              <div className="forgot-row">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setShowForgotPasswordForm(true);
                  }}
                >
                  {t("forgotPassword")}
                </button>
              </div>

              <button
                id="mx-auth-submit"
                type="submit"
                className={`btn ${successHandledRef.current ? "is-success" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>{t("signingIn")}</span>
                  </>
                ) : (
                  <>
                    <span className="btn-bolt" aria-hidden="true">⚡</span>
                    <LogIn aria-hidden="true" style={{ width: 18, height: 18 }} />
                    <span>{t("signIn")}</span>
                  </>
                )}
              </button>

              <div className="divider">
                <span>{t("or")}</span>
              </div>

              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <span
                    className="btn-spinner"
                    aria-hidden="true"
                    style={{
                      borderTopColor: "currentColor",
                      width: 18,
                      height: 18,
                    }}
                  />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span>{t("signInWithGoogle")}</span>
              </button>

              <div className="bottom">
                <div>
                  {t("noAccountPrompt")}{" "}
                  <button
                    type="button"
                    className="signup-link"
                    onClick={() => onNavigate("signup")}
                  >
                    {t("createNewAccount")}
                  </button>
                </div>
                <button
                  type="button"
                  className="home-link"
                  onClick={() => onNavigate("home")}
                >
                  {t("backToHome")}
                </button>
              </div>

              <span className="foot foot--l" aria-hidden="true" />
              <span className="foot foot--r" aria-hidden="true" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
