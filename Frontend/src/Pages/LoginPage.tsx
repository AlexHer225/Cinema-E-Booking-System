import React, { useState } from "react";

type LoginData = {
  username: string;
  password: string;
};


const bgUrl = "/images/backgroundImage.jpg";

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginData>({
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState<Partial<LoginData>>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    const newErrors: Partial<LoginData> = {};

    if (!formData.username) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";

    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    console.log("Login attempt:", formData);
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

          <button type="submit">Login</button>
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
};

export default LoginPage;