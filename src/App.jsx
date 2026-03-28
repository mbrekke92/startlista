import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import Auth from "./Auth.jsx";
import Landing from "./Landing.jsx";
import Main from "./Main.jsx";
import Privacy from "./Privacy.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    // Check if URL is /personvern
    if (window.location.pathname === "/personvern") {
      setShowPrivacy(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setShowAuth(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Listen for navigation to /personvern
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest("a");
      if (link && link.getAttribute("href") === "/personvern") {
        e.preventDefault();
        setShowPrivacy(true);
        window.history.pushState({}, "", "/personvern");
      }
    };
    const handlePop = () => {
      setShowPrivacy(window.location.pathname === "/personvern");
    };
    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePop);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePop);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "#2D5A3D" }}>startlista</span>
      </div>
    );
  }

  if (showPrivacy) {
    return <Privacy onBack={() => { setShowPrivacy(false); window.history.pushState({}, "", "/"); }} />;
  }

  if (session) return <Main session={session} />;
  if (showAuth) return <Auth initialMode={showAuth} onBack={() => setShowAuth(null)} />;
  return <Landing onGetStarted={(mode) => setShowAuth(mode)} />;
}
