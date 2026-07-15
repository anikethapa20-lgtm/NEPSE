import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    setBusy(false);
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">PRIVATE RESEARCH PORTAL</div>
        <h1>NEPSE Research Workspace</h1>
        <p>
          A secure collaborative space for developing the full abnormal trading
          behavior research paper.
        </p>
        <form onSubmit={handleLogin}>
          <label>Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Sending link..." : "Send secure login link"}
          </button>
        </form>
        {message && <div className="notice">{message}</div>}
        <small>Only emails added to the project membership table can access the workspace.</small>
      </section>
    </main>
  );
}
