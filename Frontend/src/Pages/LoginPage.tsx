import React, { useState } from "react";

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
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
  const [formData, setFormData] = useState<LoginData>({
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState<Partial<LoginData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof LoginData;

    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [fieldName]: undefined,
    }));

    setServerError("");
  };

  const validate = () => {
    const newErrors: Partial<LoginData> = {};

    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";

    return newErrors;
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
        headers: {
          "Content-Type": "application/json",
        },
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

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      window.location.href = "/";
    } catch (error) {
      console.error("Login error:", error);
      setServerError("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />

      <div style={styles.container}>
        <h2>Login</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          {errors.username && (
            <span style={styles.error}>{errors.username}</span>
          )}

          <div style={styles.passwordWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              style={{ width: "100%" }}
              autoComplete="current-password"
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

          {serverError && <div style={styles.serverError}>{serverError}</div>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: "10px" }}>
          Don't have an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  bg: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -1,
  },

  container: {
    width: "100%",
    maxWidth: "400px",
    padding: "25px",
    borderRadius: "10px",
    textAlign: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "10px",
  },

  passwordWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },

  toggleBtn: {
    padding: "5px 8px",
    cursor: "pointer",
  },

  error: {
    color: "red",
    fontSize: "0.8rem",
    textAlign: "left",
  },

  serverError: {
    color: "red",
    fontSize: "0.9rem",
    textAlign: "left",
  },
};

export default LoginPage;