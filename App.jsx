import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import Auth from "./Auth.jsx";
import Main from "./Main.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 600, color: "#2D5A3D" }}>startlista</span>
      </div>
    );
  }

  if (!session) return <Auth />;
  return <Main session={session} />;
}
