import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

type LoginData = {
  username: string;
  password: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user?: {
    id: string;
    email: string;
    username?: string;
    name?: string | null;
  };
};

type ApiErrorItem = {
  msg?: string;
};

const bgUrl = "/images/backgroundImage.jpg";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const getErrorMessage = (data: any) => {
  if (!data) return "Login failed.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item: ApiErrorItem) => item.msg)
      .filter(Boolean)
      .join(", ");
  }
  if (typeof data.message === "string") return data.message;
  return "Login failed.";
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<LoginData>({
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState<Partial<LoginData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Forgot password modal state ──
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotServerError, setForgotServerError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof LoginData;
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    setServerError("");
  };

  const validate = () => {
    const newErrors: Partial<LoginData> = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    return newErrors;
  };
  const getPendingBooking = () => {
    try {
      const data = sessionStorage.getItem("pending_booking");
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.error("pending_booking parse error:", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
        }),
      });

      const data: LoginResponse | any = await response.json().catch(() => null);

      if (!response.ok) {
        setServerError(getErrorMessage(data));
        return;
      }

      if (!data?.access_token) {
        setServerError("Login succeeded, but no access token was returned.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_type", data.token_type || "bearer");
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      window.dispatchEvent(new Event("storage"));

    const pendingBooking = getPendingBooking();

      console.log("pendingBooking:", pendingBooking);

      if (pendingBooking) {
        sessionStorage.removeItem("pending_booking");

        navigate("/confirmation", { state: pendingBooking });
        return;
      }


const username = formData.username.trim().toLowerCase();

if (username === "admin") {
  navigate("/admin");
} else {
  navigate("/");
}
    } catch (error) {
      console.error("Login error:", error);
      setServerError("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Forgot password handlers ──
  const openForgotModal = () => {
    setForgotEmail("");
    setForgotEmailError("");
    setForgotSuccess("");
    setForgotServerError("");
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailError("");
    setForgotServerError("");
    setForgotSuccess("");

    if (!forgotEmail.trim()) {
      setForgotEmailError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotEmailError("Please enter a valid email address.");
      return;
    }

    setForgotSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setForgotServerError(getErrorMessage(data));
        return;
      }

      setForgotSuccess(
        data?.message ||
          "If that email is registered you will receive a reset link shortly."
      );
    } catch {
      setForgotServerError("Could not connect to the server.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.headerBlock}>
            <p style={styles.eyebrow}>Welcome Back</p>
            <h1 style={styles.title}>Log In</h1>
            <p style={styles.subtitle}>
              Sign in to continue your movie experience.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                name="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                style={styles.input}
              />
              {errors.username && (
                <span style={styles.error}>{errors.username}</span>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  style={styles.forgotLink}
                >
                  Forgot password?
                </button>
              </div>
              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  style={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={styles.toggleBtn}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <span style={styles.error}>{errors.password}</span>
              )}
            </div>

            {serverError && (
              <div style={styles.serverError}>{serverError}</div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={styles.submitBtn}
            >
              {isSubmitting ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerText}>Don't have an account?</span>
            <Link to="/register" style={styles.footerLink}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div style={styles.modalBackdrop} onClick={closeForgotModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={closeForgotModal}>
              ✕
            </button>

            <h2 style={styles.modalTitle}>Reset Password</h2>
            <p style={styles.modalSubtitle}>
              Enter your email and we'll send you a reset link.
            </p>

            {forgotSuccess ? (
              <div style={styles.successBox}>
                <span style={styles.successIcon}>✓</span>
                <p style={styles.successText}>{forgotSuccess}</p>
                <button style={styles.submitBtn} onClick={closeForgotModal}>
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setForgotEmailError("");
                      setForgotServerError("");
                    }}
                    style={styles.input}
                    autoFocus
                  />
                  {forgotEmailError && (
                    <span style={styles.error}>{forgotEmailError}</span>
                  )}
                </div>

                {forgotServerError && (
                  <div style={styles.serverError}>{forgotServerError}</div>
                )}

                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  style={styles.submitBtn}
                >
                  {forgotSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
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
  },

  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: "8px 0",
  },

  subtitle: {
    fontSize: 14,
    opacity: 0.8,
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

  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: {
    fontWeight: 600,
    fontSize: 13,
  },

  forgotLink: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },

  input: {
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
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
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "0 24px",
  },

  modal: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    background: "rgba(18,18,22,0.97)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 20,
    backdropFilter: "blur(16px)",
    padding: "36px 32px 32px",
    color: "white",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
  },

  modalClose: {
    position: "absolute",
    top: 14,
    right: 16,
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 6,
    marginTop: 0,
  },

  modalSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 24,
    marginTop: 0,
  },

  successBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    textAlign: "center",
    paddingTop: 8,
  },

  successIcon: {
    fontSize: 40,
    color: "#6ee7b7",
  },

  successText: {
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 1.5,
    margin: 0,
  },
};

export default LoginPage;