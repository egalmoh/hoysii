"use client";
import { useState } from "react";
import Image from "next/image";
import { authClient } from "../lib/api";
export default function AuthForm({ onSignedIn, connectionError }) {
  const [mode, setMode] = useState("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [otp, setOtp] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(0);
  const check = (result) => {
    if (result.error)
      throw new Error(result.error.message || "Please try again.");
    return result;
  };
  const normalized = email.trim().toLowerCase();
  const signin = async () => {
    const result = await authClient.signIn.email({
      email: normalized,
      password,
    });
    if (result.error?.code === "EMAIL_NOT_VERIFIED") {
      setMode("verify");
      setNotice("Enter the email code sent to your partner email.");
      setCooldown(Date.now() + 60000);
      return;
    }
    check(result);
    setPassword("");
    onSignedIn();
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        check(
          await authClient.signUp.email({
            email: normalized,
            password,
            name: name.trim(),
          }),
        );
        await signin();
      } else if (mode === "signin") await signin();
      else if (mode === "verify") {
        check(
          await authClient.emailOtp.verifyEmail({ email: normalized, otp }),
        );
        setOtp("");
        setPassword("");
        onSignedIn();
      } else if (mode === "forgot") {
        check(
          await authClient.emailOtp.requestPasswordReset({ email: normalized }),
        );
        setMode("reset");
        setCooldown(Date.now() + 60000);
        setNotice(
          "If this partner account exists, a reset code has been sent.",
        );
      } else if (mode === "reset") {
        check(
          await authClient.emailOtp.resetPassword({
            email: normalized,
            otp,
            password,
          }),
        );
        setPassword("");
        setOtp("");
        setMode("signin");
        setNotice("Password updated. Sign in with your new password.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (Date.now() < cooldown) {
      setNotice("Please wait a minute before requesting another code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      check(
        mode === "verify"
          ? await authClient.emailOtp.sendVerificationOtp({
              email: normalized,
              type: "email-verification",
            })
          : await authClient.emailOtp.requestPasswordReset({
              email: normalized,
            }),
      );
      setCooldown(Date.now() + 60000);
      setNotice(
        "Code request accepted. Check inbox and spam; delivery may take a moment.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth">
      <Image
        src="/brand/hoysii-logo.png"
        alt="Hoysii"
        width={240}
        height={76}
        priority
      />
      <section className="panel">
        <h1>
          {
            {
              signin: "Hotel partner sign in",
              signup: "Create partner account",
              verify: "Verify partner email",
              forgot: "Reset your password",
              reset: "Choose a new password",
            }[mode]
          }
        </h1>
        <p className="muted">
          For invited hotel teams. Traveler and Hoysii admin accounts use their
          own sign-in.
        </p>
        {(error || connectionError) && (
          <p role="alert" className="error">
            {error || connectionError}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <form className="stack" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Partner email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === "verify" || mode === "reset"}
              required
              autoComplete="email"
            />
          </label>
          {["verify", "reset"].includes(mode) && (
            <label>
              Email code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                maxLength={6}
              />
            </label>
          )}
          {["signin", "signup", "reset"].includes(mode) && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signin" ? 1 : 12}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
              {mode !== "signin" && <span>At least 12 characters.</span>}
            </label>
          )}
          <button disabled={busy}>
            {busy
              ? "Please wait…"
              : {
                  signin: "Sign in",
                  signup: "Create account",
                  verify: "Verify email",
                  forgot: "Send reset code",
                  reset: "Save new password",
                }[mode]}
          </button>
        </form>
        <div className="actions" style={{ marginTop: 18 }}>
          {mode === "signin" ? (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
              >
                Accept an invitation
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setMode("signin");
                setError("");
                setOtp("");
                setPassword("");
              }}
            >
              Back to sign in
            </button>
          )}
          {["verify", "reset"].includes(mode) && (
            <button className="secondary" disabled={busy} onClick={resend}>
              Resend code
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
