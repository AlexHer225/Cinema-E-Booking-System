import React, { useState } from "react";

type FormData = {
  name: string;
  username: string;
  email: string;
  password: string;
};


const bgUrl = "/images/backgroundImage.jpg";

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.username) newErrors.username = "Username is required";
    if (!formData.email) newErrors.email = "Email is required";
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

    console.log("Form submitted:", formData);
  };

  return (
    <div style={styles.page}>
     
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />

      
      <div style={styles.container}>
        <h2>Register</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
          />
          {errors.name && <span style={styles.error}>{errors.name}</span>}

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

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && <span style={styles.error}>{errors.email}</span>}

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />
          {errors.password && (
            <span style={styles.error}>{errors.password}</span>
          )}

          <button type="submit">Create Account</button>
        </form>
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

  error: {
    color: "red",
    fontSize: "0.8rem",
    textAlign: "left",
  },
};

export default RegisterPage;