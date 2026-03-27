import { useState } from "react";
import { supabase } from "./supabase.js";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const inputStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "10px 12px",
    border: "1px solid #E2E0D8", borderRadius: 8, background: "#fff",
    color: "#1A1A1A", width: "100%", boxSizing: "border-box", outline: "none",
  };
  const labelStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
    color: "#7A7A6E", marginBottom: 4, display: "block",
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === "Invalid login credentials" ? "Feil e-post eller passord" : error.message);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!acceptPrivacy) { setError("Du må godta personvernerklæringen"); return; }
    if (!firstName.trim() || !lastName.trim() || !city.trim()) { setError("Alle felt må fylles ut"); return; }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), city: city.trim() } } });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    setLoading(false);
    if (!data.session) setMode("confirm");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (!email) { setError("Skriv inn e-postadressen din"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset",
    });
    if (error) setError(error.message);
    else setMessage("Vi har sendt deg en lenke for å tilbakestille passordet. Sjekk e-posten din.");
    setLoading(false);
  };

  if (mode === "confirm") {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, padding: "0 20px", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#2D5A3D", marginBottom: 8 }}>startlista</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sjekk e-posten din</div>
          <div style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.5 }}>
            Vi har sendt en bekreftelseslenke til <strong>{email}</strong>. Klikk på lenken for å aktivere kontoen din.
          </div>
          <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{
            marginTop: 24, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
            color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline",
          }}>Tilbake til innlogging</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 380, width: "100%", padding: "0 20px", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: "#2D5A3D", marginBottom: 4 }}>startlista</div>
          <div style={{ fontSize: 13, color: "#9B9B8E" }}>
            {mode === "login" ? "Logg inn" : mode === "register" ? "Opprett konto" : "Glemt passord"}
          </div>
        </div>

        <form onSubmit={mode === "forgot" ? handleForgotPassword : mode === "login" ? handleLogin : handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fornavn</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Etternavn</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>By</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="F.eks. Oslo" style={inputStyle} required />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>E-post</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
          </div>

          {mode !== "forgot" && (
            <div>
              <label style={labelStyle}>Passord</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} minLength={6} required />
            </div>
          )}

          {mode === "register" && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#7A7A6E", cursor: "pointer" }}>
              <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Jeg godtar <a href="/personvern" target="_blank" style={{ color: "#2D5A3D" }}>personvernerklæringen</a></span>
            </label>
          )}

          {error && <div style={{ fontSize: 12, color: "#C53030", background: "#FFF5F5", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {message && <div style={{ fontSize: 12, color: "#2D5A3D", background: "#EFF5F0", padding: "8px 12px", borderRadius: 8 }}>{message}</div>}

          <button type="submit" disabled={loading} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
            padding: "12px", borderRadius: 8, border: "none",
            background: "#2D5A3D", color: "#fff", cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1, marginTop: 4,
          }}>
            {loading ? "Vennligst vent..." : mode === "login" ? "Logg inn" : mode === "register" ? "Opprett konto" : "Send tilbakestillingslenke"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer" }}>Glemt passord?</button>
              <button onClick={() => { setMode("register"); setError(""); setMessage(""); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer" }}>Har du ikke konto? Opprett en her</button>
            </>
          )}
          {mode === "register" && (
            <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer" }}>Har du allerede konto? Logg inn</button>
          )}
          {mode === "forgot" && (
            <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer" }}>Tilbake til innlogging</button>
          )}
        </div>
      </div>
    </div>
  );
}
