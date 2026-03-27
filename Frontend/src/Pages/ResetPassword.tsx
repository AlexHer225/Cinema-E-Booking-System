import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const bgUrl = "/images/backgroundImage.jpg";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type PageState = "form" | "success" | "invalid";

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<PageState>("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If there's no token in the URL at all, show the invalid state immediately
  useEffect(() => {
    if (!token) setPageState("invalid");
  }, [token]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!newPassword) {
      errs.newPassword = "Password is required.";
    } else if (newPassword.length < 8) {
      errs.newPassword = "Password must be at least 8 characters.";
    } else if (newPassword.length > 128) {
      errs.newPassword = "Password must be under 128 characters.";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : "Something went wrong. The link may have expired.";

        // Treat token-specific errors as the invalid state
        if (
          detail.toLowerCase().includes("invalid") ||
          detail.toLowerCase().includes("expired")
        ) {
          setPageState("invalid");
          return;
        }

        setServerError(detail);
        return;
      }

      setPageState("success");
    } catch {
      setServerError("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render helpers ──

  const renderInvalid = () => (
    <div style={styles.stateBox}>
      <span style={styles.stateIcon}>✕</span>
      <h2 style={styles.stateTitle}>Link Invalid or Expired</h2>
      <p style={styles.stateText}>
        This password reset link is invalid or has already been used. Reset
        links expire after 30 minutes.
      </p>
      <Link to="/login" style={styles.btnLink}>
        Back to Login
      </Link>
      <p style={styles.stateHint}>
        Need a new link?{" "}
        <Link to="/login" style={styles.inlineLink}>
          Request one from the login page.
        </Link>
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div style={styles.stateBox}>
      <span style={{ ...styles.stateIcon, color: "#6ee7b7" }}>✓</span>
      <h2 style={styles.stateTitle}>Password Updated</h2>
      <p style={styles.stateText}>
        Your password has been changed successfully. You can now log in with
        your new password.
      </p>
      <button style={styles.submitBtn} onClick={() => navigate("/login")}>
        Go to Login
      </button>
    </div>
  );

  const renderForm = () => (
    <>
      <div style={styles.headerBlock}>
        <p style={styles.eyebrow}>Account Recovery</p>
        <h1 style={styles.title}>New Password</h1>
        <p style={styles.subtitle}>
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* New password */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>New Password</label>
          <div style={styles.passwordWrapper}>
            <input
              type={showNew ? "text" : "password"}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors((prev) => ({ ...prev, newPassword: undefined }));
                setServerError("");
              }}
              style={styles.passwordInput}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNew((p) => !p)}
              style={styles.toggleBtn}
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
          {errors.newPassword && (
            <span style={styles.error}>{errors.newPassword}</span>
          )}
        </div>

        {/* Confirm password */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Confirm Password</label>
          <div style={styles.passwordWrapper}>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                setServerError("");
              }}
              style={styles.passwordInput}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              style={styles.toggleBtn}
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirmPassword && (
            <span style={styles.error}>{errors.confirmPassword}</span>
          )}
        </div>

        {serverError && <div style={styles.serverError}>{serverError}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={styles.submitBtn}
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div style={styles.footer}>
        <span style={styles.footerText}>Remembered it?</span>
        <Link to="/login" style={styles.footerLink}>
          Back to Login
        </Link>
      </div>
    </>
  );

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.card}>
          {pageState === "invalid" && renderInvalid()}
          {pageState === "success" && renderSuccess()}
          {pageState === "form" && renderForm()}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
  },

  bg: {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    zIndex: -2,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: -1,
  },

  wrapper: {
    height: "calc(100vh - 70px)",
    marginTop: 70,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: 480,
    background: "rgba(10,10,12,0.75)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    backdropFilter: "blur(14px)",
    padding: "32px",
    color: "white",
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
  },

  headerBlock: {
    textAlign: "center",
    marginBottom: 20,
  },

  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    opacity: 0.7,
    margin: 0,
  },

  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: "8px 0",
  },

  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    margin: 0,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  label: {
    fontWeight: 600,
    fontSize: 13,
  },

  passwordWrapper: {
    display: "flex",
    gap: 8,
  },

  passwordInput: {
    flex: 1,
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
  },

  toggleBtn: {
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
  },

  error: {
    color: "#ffb3b3",
    fontSize: 12,
  },

  serverError: {
    color: "#ff8080",
    fontSize: 13,
  },

  submitBtn: {
    marginTop: 8,
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "white",
    color: "black",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },

  footer: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    gap: 6,
  },

  footerText: {
    fontSize: 13,
    opacity: 0.8,
  },

  footerLink: {
    color: "white",
    fontWeight: 600,
    textDecoration: "underline",
    fontSize: 13,
  },

  // Success / invalid shared styles
  stateBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    padding: "8px 0",
  },

  stateIcon: {
    fontSize: 48,
    color: "#ff8080",
    lineHeight: 1,
  },

  stateTitle: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  },

  stateText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 340,
  },

  stateHint: {
    fontSize: 12,
    opacity: 0.6,
    margin: 0,
  },

  btnLink: {
    display: "block",
    marginTop: 4,
    padding: "12px 32px",
    borderRadius: 10,
    background: "white",
    color: "black",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: 14,
  },

  inlineLink: {
    color: "white",
    textDecoration: "underline",
  },
};

export default ResetPasswordPage;