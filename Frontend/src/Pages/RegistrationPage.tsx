import React, { useState } from "react";
import { Link } from "react-router-dom";

type FormData = {
  name: string;
  username: string;
  email: string;
  password: string;
};

type ApiErrorItem = {
  msg?: string;
};

const bgUrl = "/images/backgroundImage.jpg";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const getErrorMessage = (data: any) => {
  if (!data) return "Could not create account.";

  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item: ApiErrorItem) => item.msg)
      .filter(Boolean)
      .join(", ");
  }

  if (typeof data.message === "string") return data.message;

  return "Could not create account.";
};

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof FormData;

    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [fieldName]: undefined,
    }));

    setServerError("");
    setSuccessMessage("");
  };

  const validate = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setServerError("");
    setSuccessMessage("");

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          username: formData.username.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setServerError(getErrorMessage(data));
        return;
      }

      setSuccessMessage(
        data?.message ||
          "Account created. Check your email and click the verification link before logging in."
      );

      setFormData({
        name: "",
        username: "",
        email: "",
        password: "",
      });
    } catch (error) {
      setServerError("Could not connect to the server.");
      console.error("Signup error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.headerBlock}>
            <p style={styles.eyebrow}>Join CineScope</p>
            <h1 style={styles.title}>Create Account</h1>
            <p style={styles.subtitle}>
              Sign up to book tickets, manage your profile, and enjoy the full
              movie experience.
            </p>
          </div>

          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
            <span style={styles.requiredStar}>*</span> indicates required fields
          </p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Full Name <span style={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                style={styles.input}
              />
              {errors.name && <span style={styles.error}>{errors.name}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Username <span style={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                name="username"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                style={styles.input}
              />
              {errors.username && (
                <span style={styles.error}>{errors.username}</span>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Email <span style={styles.requiredStar}>*</span>
              </label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
              />
              {errors.email && <span style={styles.error}>{errors.email}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Password <span style={styles.requiredStar}>*</span>
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Create a password"
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

            {successMessage && (
              <div style={styles.success}>{successMessage}</div>
            )}

            <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerText}>Already have an account?</span>
            <Link to="/login" style={styles.footerLink}>
              Log In
            </Link>
          </div>
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
    maxWidth: 520,
    background: "rgba(10,10,12,0.75)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
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
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: "8px 0",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 1.5,
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
    color: "white",
  },
  requiredStar: {
    color: "#ff8080",
    marginLeft: 4,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  passwordWrapper: {
    display: "flex",
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  toggleBtn: {
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    color: "#ffb3b3",
    fontSize: 12,
  },
  serverError: {
    color: "#ff8080",
    fontSize: 13,
    background: "rgba(255, 85, 85, 0.12)",
    border: "1px solid rgba(255, 120, 120, 0.24)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  success: {
    color: "#bff5c7",
    fontSize: 13,
    background: "rgba(80, 200, 120, 0.12)",
    border: "1px solid rgba(120, 220, 150, 0.24)",
    borderRadius: 10,
    padding: "10px 12px",
    lineHeight: 1.5,
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
    fontSize: 14,
  },
  footer: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
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
};

export default RegisterPage;