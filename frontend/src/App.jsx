import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:4000";

async function readResponseData(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18-1.4 1.4-3.1-3.1a11.8 11.8 0 0 1-4.5.9c-6.5 0-10-6-10-6a19.2 19.2 0 0 1 5-5.3L1.6 4.4 3 3zm8.8 8.8l2.4 2.4a3.5 3.5 0 0 1-2.4-2.4zM12 8.5c1.9 0 3.5 1.6 3.5 3.5 0 .4-.1.8-.2 1.2l2.9 2.9A18.3 18.3 0 0 0 22 12s-3.5-6-10-6c-1.2 0-2.3.2-3.3.5l2.3 2.3c.3-.2.6-.3 1-.3z" />
    </svg>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="page">
      <div className="overlay" />
      <header className="brand">KODFLIX</header>
      <main className="panel">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </main>
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: ""
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canSubmit = useMemo(
    () => Object.values(form).every(Boolean) && !loading,
    [form, loading]
  );

  function updateField(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (form.password !== form.confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include"
      });

      const data = await readResponseData(response);

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Signup failed" });
        return;
      }

      setStatus({ type: "success", message: "Signup successful. Please login." });
      setTimeout(() => navigate("/login"), 1200);
    } catch (_error) {
      setStatus({ type: "error", message: "Unable to reach backend server" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Sign Up" subtitle="Create your account to start watching.">
      <form onSubmit={handleSubmit} className="form">
        <input name="username" value={form.username} onChange={updateField} placeholder="Username" />
        <input name="email" type="email" value={form.email} onChange={updateField} placeholder="Email" />
        <input name="phoneNumber" value={form.phoneNumber} onChange={updateField} placeholder="Phone Number" />
        <div className="input-wrap">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={updateField}
            placeholder="Password"
          />
          <button
            type="button"
            className="eye-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>
        <div className="input-wrap">
          <input
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={updateField}
            placeholder="Confirm Password"
          />
          <button
            type="button"
            className="eye-btn"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
          >
            <EyeIcon visible={showConfirmPassword} />
          </button>
        </div>
        <button disabled={!canSubmit}>{loading ? "Signing Up..." : "Sign Up"}</button>
      </form>
      {status.message ? <div className={`status ${status.type}`}>{status.message}</div> : null}
      <p className="switch">
        Already have an account? <a href="/login">Login</a>
      </p>
    </AuthLayout>
  );
}

function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function updateField(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include"
      });

      const data = await readResponseData(response);

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Login failed" });
        return;
      }

      setStatus({ type: "success", message: "Login successful. Redirecting..." });
      setTimeout(() => {
        window.location.href = "https://netflix-landing-page-omega-snowy.vercel.app/";
      }, 700);
    } catch (_error) {
      setStatus({ type: "error", message: "Unable to reach backend server" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Sign In" subtitle="Use your account credentials to continue.">
      <form onSubmit={handleSubmit} className="form">
        <input name="username" value={form.username} onChange={updateField} placeholder="Username" />
        <div className="input-wrap">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={updateField}
            placeholder="Password"
          />
          <button
            type="button"
            className="eye-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>
        <button disabled={!form.username || !form.password || loading}>
          {loading ? "Logging In..." : "Login"}
        </button>
      </form>
      {status.message ? <div className={`status ${status.type}`}>{status.message}</div> : null}
      <p className="switch">
        New here? <a href="/signup">Create an account</a>
      </p>
    </AuthLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
