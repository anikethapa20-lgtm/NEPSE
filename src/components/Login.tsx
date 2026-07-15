import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setMessage("Invalid email or password.");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">PRIVATE RESEARCH PORTAL</div>
        <h1>NEPSE Research Workspace</h1>
        <p>Sign in with the account created for you by the project administrator.</p>

        <form onSubmit={handleLogin}>
          <label>Email address</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}
