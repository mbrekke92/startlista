import { useState, useEffect, useRef } from "react";

function useOnScreen(ref) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return isVisible;
}

function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef();
  const isVisible = useOnScreen(ref);
  return (
    <div ref={ref} style={{
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(40px)",
      transition: `opacity 0.9s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}s, transform 0.9s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}s`,
      ...style,
    }}>{children}</div>
  );
}

export default function Landing({ onGetStarted }) {
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => { setTimeout(() => setHeroVisible(true), 150); }, []);

  const AvatarStack = ({ avatars }) => (
    <div style={{ display: "flex" }}>
      {avatars.map((a, i) => (
        <div key={i} style={{
          width: 20, height: 20, borderRadius: "50%", background: a.color,
          color: "#fff", fontSize: 7, fontWeight: 600, display: "flex",
          alignItems: "center", justifyContent: "center",
          marginLeft: i > 0 ? -6 : 0, border: "2px solid #FAFAF7",
        }}>{a.initials}</div>
      ))}
    </div>
  );

  const PhoneMockup = ({ children, glow = false }) => (
    <div style={{
      width: 280, borderRadius: 32, background: "#FAFAF7",
      border: "5px solid #1A1A1A", overflow: "hidden",
      boxShadow: glow
        ? "0 32px 100px rgba(45,90,61,0.12), 0 12px 40px rgba(0,0,0,0.08)"
        : "0 24px 80px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)",
    }}>
      <div style={{ padding: "7px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontWeight: 600, color: "#1A1A1A", position: "relative" }}>
        <span>09:41</span>
        <div style={{ width: 56, height: 4, borderRadius: 3, background: "#1A1A1A", position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }} />
        <span style={{ fontSize: 9 }}>●●● ▐█▌</span>
      </div>
      <div style={{ padding: "0 11px 14px" }}>{children}</div>
    </div>
  );

  const NavBar = ({ active }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0 7px", borderBottom: "1px solid #E2E0D8" }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: "#2D5A3D", letterSpacing: "-0.5px" }}>startlista</span>
      <div style={{ display: "flex", gap: 9, fontSize: 9 }}>
        <span style={{ color: active === "lop" ? "#2D5A3D" : "#C4C3BB", fontWeight: active === "lop" ? 600 : 400 }}>Løp</span>
        <span style={{ color: active === "oversikt" ? "#2D5A3D" : "#C4C3BB", fontWeight: active === "oversikt" ? 600 : 400 }}>Oversikt</span>
        <span style={{ color: active === "profil" ? "#2D5A3D" : "#C4C3BB", fontWeight: active === "profil" ? 600 : 400 }}>Min profil</span>
      </div>
    </div>
  );

  const races = [
    { name: "Drammen 10K", loc: "Drammen · 10 km · 11. apr", avatars: [{ initials: "KL", color: "#2D5A3D" }, { initials: "TH", color: "#8B4513" }] },
    { name: "Holmestrand Maraton", loc: "Holmestrand · 42.195 km · 11. apr", avatars: [] },
    { name: "Sentrumsløpet", loc: "Oslo · 10 km · 25. apr", avatars: [{ initials: "TH", color: "#8B4513" }, { initials: "SN", color: "#4A5568" }, { initials: "KL", color: "#2D5A3D" }] },
    { name: "Holmenkollstafetten", loc: "Oslo · Stafett · 9. mai", avatars: [{ initials: "KL", color: "#2D5A3D" }] },
    { name: "Revetal Halvmaraton", loc: "Revetal · 21.0975 km · 14. mai", avatars: [{ initials: "SN", color: "#4A5568" }] },
    { name: "OBOS Fornebuløpet", loc: "Fornebu · 10 km · 27. mai", avatars: [] },
    { name: "Oslo Maraton", loc: "Oslo · 42.195 km · 12. sep", avatars: [{ initials: "KL", color: "#2D5A3D" }, { initials: "TH", color: "#8B4513" }] },
  ];

  const groups = [
    { name: "Sentrumsløpet", loc: "Oslo · 10 km · 25. apr", runners: [{ n: "Kristine Larsen", g: "Sub 42:00" }, { n: "Thomas Haugen", g: "PR" }, { n: "Sara Nordby", g: "" }] },
    { name: "Holmenkollstafetten", loc: "Oslo · Stafett · 9. mai", runners: [{ n: "Kristine Larsen", g: "" }, { n: "Thomas Haugen", g: "" }] },
    { name: "Oslo Maraton", loc: "Oslo · 42.195 km · 12. sep", runners: [{ n: "Kristine Larsen", g: "Sub 3:30" }, { n: "Thomas Haugen", g: "Sub 3:15" }, { n: "Sara Nordby", g: "Fullføre" }] },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <nav style={{
        position: "sticky", top: 0, zIndex: 100, background: "rgba(250,250,247,0.85)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(226,224,216,0.6)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#2D5A3D", letterSpacing: "-0.5px" }}>startlista</span>
          <button onClick={() => onGetStarted("login")} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
            padding: "7px 18px", borderRadius: 18, border: "1px solid #E2E0D8",
            background: "transparent", color: "#7A7A6E", cursor: "pointer",
          }}>Logg inn</button>
        </div>
      </nav>

      <div style={{
        textAlign: "center", padding: "100px 24px 40px", maxWidth: 700, margin: "0 auto",
        opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 1s cubic-bezier(0.25, 0.1, 0.25, 1), transform 1s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}>
        <h1 style={{ fontSize: "clamp(40px, 8vw, 56px)", fontWeight: 800, color: "#1A1A1A", letterSpacing: "-2px", lineHeight: 1.05, margin: "0 0 24px" }}>
          Se hvem som skal<br />løpe hva.
        </h1>
        <p style={{ fontSize: "clamp(16px, 3vw, 19px)", color: "#9B9B8E", lineHeight: 1.6, margin: "0 auto 40px", maxWidth: 440 }}>
          Din og dine løpevenners terminliste.
        </p>
        <button onClick={() => onGetStarted("register")} style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
          padding: "15px 40px", borderRadius: 26, border: "none",
          background: "#2D5A3D", color: "#fff", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(45,90,61,0.3)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => { e.target.style.transform = "scale(1.03)"; e.target.style.boxShadow = "0 6px 28px rgba(45,90,61,0.35)"; }}
        onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 20px rgba(45,90,61,0.3)"; }}
        >Kom i gang</button>
      </div>

      <div style={{
        display: "flex", justifyContent: "center", padding: "40px 24px 0",
        opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(50px)",
        transition: "opacity 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) 0.15s, transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1) 0.15s",
      }}>
        <PhoneMockup glow>
          <NavBar active="lop" />
          <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#9B9B8E", margin: "10px 0 6px" }}>Kommende løp</div>
          {races.map((r, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 9.5, marginBottom: 1, color: "#1A1A1A" }}>{r.name}</div>
                <div style={{ fontSize: 7.5, color: "#9B9B8E" }}>{r.loc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {r.avatars.length > 0 && <AvatarStack avatars={r.avatars} />}
                <span style={{ color: "#D4D3CC", fontSize: 10 }}>›</span>
              </div>
            </div>
          ))}
        </PhoneMockup>
      </div>

      <div style={{ height: 120, background: "linear-gradient(to bottom, #FAFAF7, #fff)" }} />

      <div style={{ background: "#fff", padding: "60px 24px 80px" }}>
        <FadeIn>
          <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", gap: 56, flexWrap: "wrap", justifyContent: "center" }}>
            <PhoneMockup>
              <NavBar active="oversikt" />
              <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#9B9B8E", margin: "10px 0 6px" }}>Oversikt</div>
              {groups.map((group, i) => (
                <div key={i} style={{ borderBottom: "1px solid #EDECE6", marginBottom: 1 }}>
                  <div style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 9.5, marginBottom: 1 }}>{group.name}</div>
                      <div style={{ fontSize: 7.5, color: "#9B9B8E" }}>{group.loc}</div>
                    </div>
                    <span style={{ color: "#D4D3CC", fontSize: 10 }}>›</span>
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    {group.runners.map((r, j) => (
                      <div key={j} style={{ padding: "2.5px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 8, color: "#7A7A6E" }}>{r.n}</span>
                        {r.g && <span style={{ fontSize: 6.5, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "1px 5px", borderRadius: 4 }}>{r.g}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </PhoneMockup>
            <div style={{ flex: 1, minWidth: 260 }}>
              <FadeIn delay={0.15}>
                <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1, margin: "0 0 16px" }}>Følg vennene dine.</h2>
                <p style={{ fontSize: 16, color: "#9B9B8E", lineHeight: 1.7, margin: 0 }}>Se hvilke løp de planlegger og hvilke mål de har satt seg. Finn noen å dra sammen med.</p>
              </FadeIn>
            </div>
          </div>
        </FadeIn>
      </div>

      <div style={{ height: 40, background: "linear-gradient(to bottom, #fff, #FAFAF7)" }} />

      <div style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <FadeIn>
          <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-1px", textAlign: "center", margin: "0 0 56px" }}>Tre steg. Ett minutt.</h2>
        </FadeIn>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { num: "1", title: "Opprett profil", desc: "Fornavn, etternavn og by." },
            { num: "2", title: "Legg til løp", desc: "Velg fra listen eller legg til egne." },
            { num: "3", title: "Følg venner", desc: "Se hva de planlegger." },
          ].map((step, i) => (
            <FadeIn key={i} delay={i * 0.1} style={{ flex: 1, minWidth: 170, textAlign: "center" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#1A1A1A", color: "#fff",
                fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 18px",
              }}>{step.num}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 14, color: "#9B9B8E", lineHeight: 1.5 }}>{step.desc}</div>
            </FadeIn>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", padding: "100px 24px" }}>
        <FadeIn>
          <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: "clamp(22px, 4.5vw, 32px)", fontWeight: 700, color: "#1A1A1A", lineHeight: 1.35, margin: "0 0 20px", letterSpacing: "-0.5px" }}>
              «Skal du løpe Sentrumsløpet?»
            </div>
            <div style={{ fontSize: 16, color: "#9B9B8E", lineHeight: 1.7, margin: 0 }}>
              Du har sikkert spurt noen det spørsmålet. Med startlista trenger du ikke spørre — du ser det med én gang.
            </div>
          </div>
        </FadeIn>
      </div>

      <div style={{ textAlign: "center", padding: "80px 24px 100px" }}>
        <FadeIn>
          <h2 style={{ fontSize: "clamp(32px, 6vw, 44px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px" }}>Klar?</h2>
          <p style={{ fontSize: 16, color: "#9B9B8E", margin: "0 0 36px" }}>Det tar under ett minutt.</p>
          <button onClick={() => onGetStarted("register")} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600,
            padding: "16px 48px", borderRadius: 28, border: "none",
            background: "#2D5A3D", color: "#fff", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(45,90,61,0.3)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "scale(1.03)"; e.target.style.boxShadow = "0 6px 28px rgba(45,90,61,0.35)"; }}
          onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 20px rgba(45,90,61,0.3)"; }}
          >Opprett konto</button>
        </FadeIn>
      </div>

      <footer style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "#C4C3BB", borderTop: "1px solid #EDECE6" }}>
        <div>startlista · laget for løpere som vil finne hverandre</div>
        <div style={{ marginTop: 6 }}><a href="/personvern" style={{ color: "#C4C3BB", textDecoration: "underline" }}>Personvern</a></div>
      </footer>
    </div>
  );
}
