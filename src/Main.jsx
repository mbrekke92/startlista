import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getInitials = (first, last) => `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();
const COLORS = ["#2D5A3D", "#8B4513", "#4A5568", "#6B3A5D", "#2C5282", "#744210"];
const colorFor = (id) => COLORS[id.charCodeAt(0) % COLORS.length];

// Fixed capitalize that handles ø, æ, å correctly
const capitalize = (str) => {
  return str.split(" ").map((word) => {
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
};

const FYLKER = ["Agder", "Innlandet", "Møre og Romsdal", "Nordland", "Oslo", "Rogaland", "Troms", "Trøndelag", "Vestfold og Telemark", "Vestland", "Viken"];

// Parse goal time string to total seconds
const parseGoalSeconds = (goal) => {
  if (!goal) return null;
  const cleaned = goal.replace(/\s/g, "");
  const parts = cleaned.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1 && parts[0] > 0) return parts[0] * 60; // single number = minutes
  return null;
};

// Format seconds to time string
const formatGoalTime = (h, m, s) => {
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Get match tolerance in seconds based on distance
const getMatchTolerance = (distance) => {
  const d = (distance || "").toLowerCase();
  if (d.includes("42") || d.includes("maraton")) return 300; // ±5 min
  if (d.includes("21") || d.includes("halv")) return 180; // ±3 min
  return 60; // ±1 min for 10km etc
};

const fuzzyMatch = (input, target) => {
  const a = input.toLowerCase().replace(/[^a-zæøå0-9]/g, "");
  const b = target.toLowerCase().replace(/[^a-zæøå0-9]/g, "");
  if (a.length < 4) return false;
  if (b.includes(a) || a.includes(b)) return true;
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const idx = b.indexOf(a[i], Math.max(0, i - 2));
    if (idx !== -1 && Math.abs(idx - i) <= 2) matches++;
  }
  return matches / a.length > 0.85;
};

export default function Main({ session }) {
  const [view, setView] = useState("races");
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [races, setRaces] = useState([]);
  const [entries, setEntries] = useState([]);
  const [follows, setFollows] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [showAddRace, setShowAddRace] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [newRace, setNewRace] = useState({ name: "", location: "", date: "", distance: "", country: "", goal: "" });
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [goalForExisting, setGoalForExisting] = useState({ h: 0, m: 0, s: 0 });
  const [globalSearch, setGlobalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editFylke, setEditFylke] = useState("");
  const [editingFylke, setEditingFylke] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [editingGoalEntryId, setEditingGoalEntryId] = useState(null);
  const [editGoalH, setEditGoalH] = useState(0);
  const [editGoalM, setEditGoalM] = useState(0);
  const [editGoalS, setEditGoalS] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);
  const [showAllRaces, setShowAllRaces] = useState(false);
  const [needsFylke, setNeedsFylke] = useState(false);
  const [selectedFylke, setSelectedFylke] = useState("");
  const [newGoalH, setNewGoalH] = useState(0);
  const [newGoalM, setNewGoalM] = useState(0);
  const [newGoalS, setNewGoalS] = useState(0);
  const [raceSortByTime, setRaceSortByTime] = useState(false);
  const carouselRef = useRef(null);

  const userId = session.user.id;

  useEffect(() => {
    const load = async () => {
      const [profileRes, profilesRes, racesRes, entriesRes, followsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*"),
        supabase.from("races").select("*").order("date"),
        supabase.from("entries").select("*"),
        supabase.from("follows").select("*").eq("follower_id", userId),
      ]);
      const p = profileRes.data;
      setProfile(p);
      setProfiles(profilesRes.data || []);
      setRaces(racesRes.data || []);
      setEntries(entriesRes.data || []);
      setFollows((followsRes.data || []).map((f) => f.following_id));
      // Check if user needs to set fylke
      if (p && !FYLKER.includes(p.city)) setNeedsFylke(true);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "#2D5A3D" }}>startlista</span>
      </div>
    );
  }

  const fullName = (p) => `${p.first_name} ${p.last_name}`;
  const myEntries = entries.filter((e) => e.user_id === userId);
  const followingIds = follows;
  const today = new Date().toISOString().split("T")[0];
  const totalUsers = profiles.length;

  const navigate = (fn) => { setFadeKey((k) => k + 1); fn(); };

  const saveFylke = async () => {
    if (!selectedFylke) return;
    await supabase.from("profiles").update({ city: selectedFylke }).eq("id", userId);
    setProfile((prev) => ({ ...prev, city: selectedFylke }));
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, city: selectedFylke } : p));
    setNeedsFylke(false);
  };

  const toggleFollow = async (targetId) => {
    if (followingIds.includes(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      setFollows((prev) => prev.filter((id) => id !== targetId));
    } else {
      await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
      setFollows((prev) => [...prev, targetId]);
    }
  };

  const goalTimeString = (h, m, s) => {
    if (h === 0 && m === 0 && s === 0) return "";
    return formatGoalTime(h, m, s);
  };

  const addRaceToMyList = async (raceId) => {
    if (myEntries.some((e) => e.race_id === raceId)) return;
    const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: raceId, goal: "" }).select().single();
    if (data) setEntries((prev) => [...prev, data]);
  };

  const addExistingRace = async () => {
    if (!selectedExisting) return;
    if (myEntries.some((e) => e.race_id === selectedExisting.id)) return;
    const goal = goalTimeString(goalForExisting.h, goalForExisting.m, goalForExisting.s);
    const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: selectedExisting.id, goal }).select().single();
    if (data) setEntries((prev) => [...prev, data]);
    setShowAddRace(false); setSelectedExisting(null); setGoalForExisting({ h: 0, m: 0, s: 0 }); setSearchQuery("");
  };

  const addManualRace = async () => {
    if (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) return;
    const goal = goalTimeString(newGoalH, newGoalM, newGoalS);
    const { data: raceData, error: raceError } = await supabase.from("races").insert({
      name: capitalize(newRace.name), location: capitalize(newRace.location),
      date: newRace.date, distance: newRace.distance,
      country: newRace.country ? capitalize(newRace.country) : "", user_created: true,
    }).select().single();
    if (raceError) return;
    if (raceData) {
      setRaces((prev) => [...prev, raceData]);
      const { data: entryData } = await supabase.from("entries").insert({ user_id: userId, race_id: raceData.id, goal }).select().single();
      if (entryData) setEntries((prev) => [...prev, entryData]);
    }
    setShowAddRace(false); setManualMode(false); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); setNewGoalH(0); setNewGoalM(0); setNewGoalS(0); setSearchQuery("");
  };

  const removeEntry = async (raceId) => {
    await supabase.from("entries").delete().eq("user_id", userId).eq("race_id", raceId);
    setEntries((prev) => prev.filter((e) => !(e.user_id === userId && e.race_id === raceId)));
  };

  const updateGoal = async (entryId) => {
    const goal = goalTimeString(editGoalH, editGoalM, editGoalS);
    await supabase.from("entries").update({ goal }).eq("id", entryId);
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, goal } : e));
    setEditingGoalEntryId(null);
  };

  const startEditGoal = (entry) => {
    const secs = parseGoalSeconds(entry.goal);
    if (secs) {
      setEditGoalH(Math.floor(secs / 3600));
      setEditGoalM(Math.floor((secs % 3600) / 60));
      setEditGoalS(secs % 60);
    } else {
      setEditGoalH(0); setEditGoalM(0); setEditGoalS(0);
    }
    setEditingGoalEntryId(entry.id);
  };

  const updateFylke = async () => {
    if (!editFylke) return;
    await supabase.from("profiles").update({ city: editFylke }).eq("id", userId);
    setProfile((prev) => ({ ...prev, city: editFylke }));
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, city: editFylke } : p));
    setEditingFylke(false);
    setSettingsMessage("Fylke oppdatert");
    setTimeout(() => setSettingsMessage(""), 2000);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setSettingsMessage("Passordet må være minst 6 tegn"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setSettingsMessage(error.message);
    else { setSettingsMessage("Passord endret"); setNewPassword(""); setChangingPassword(false); }
    setTimeout(() => setSettingsMessage(""), 3000);
  };

  const deleteAccount = async () => { await supabase.rpc("delete_user"); await supabase.auth.signOut(); };
  const handleLogout = async () => { await supabase.auth.signOut(); };

  const openProfile = (p) => navigate(() => { setSelectedProfile(p); setView("profile"); setGlobalSearch(""); setShowSettings(false); });
  const openRace = (raceId) => navigate(() => { setSelectedRace(races.find((r) => r.id === raceId)); setView("race"); setGlobalSearch(""); setRaceSortByTime(false); });
  const goRaces = () => navigate(() => { setView("races"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); setShowAllRaces(false); });
  const goFeed = () => navigate(() => { setView("feed"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); });

  const raceLocation = (race) => `${race.location}${race.country && race.country !== "Norge" ? `, ${race.country}` : ""}`;

  const filteredRaces = searchQuery.length > 0
    ? races.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.location.toLowerCase().includes(searchQuery.toLowerCase()) || (r.country && r.country.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  const getSuggestions = (name) => {
    if (!name || name.length < 4) return [];
    return races.filter((r) => fuzzyMatch(name, r.name) && !myEntries.some((e) => e.race_id === r.id)).slice(0, 3);
  };

  // Generate race suggestions for carousel
  const getRaceSuggestions = () => {
    const myRaceIds = myEntries.map((e) => e.race_id);
    const upcoming = races.filter((r) => r.date >= today && !myRaceIds.includes(r.id));

    return upcoming.map((race) => {
      const raceEntries = entries.filter((e) => e.race_id === race.id);
      const participants = raceEntries.map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
      const followingParticipants = participants.filter((p) => followingIds.includes(p.id));
      const sameAreaParticipants = participants.filter((p) => p.city === profile.city && p.id !== userId);
      
      // Find same goal participants
      const myGoals = myEntries.map((e) => ({ raceId: e.race_id, secs: parseGoalSeconds(e.goal) })).filter((g) => g.secs);
      let sameGoalCount = 0;
      const tolerance = getMatchTolerance(race.distance);
      raceEntries.forEach((e) => {
        if (e.user_id === userId) return;
        const theirSecs = parseGoalSeconds(e.goal);
        if (!theirSecs) return;
        myGoals.forEach((mg) => {
          if (Math.abs(theirSecs - mg.secs) <= tolerance) sameGoalCount++;
        });
      });

      const score = followingParticipants.length * 3 + sameAreaParticipants.length * 2 + sameGoalCount * 2 + participants.length * 0.1;
      if (score === 0 && participants.length === 0) return null;

      return {
        race, participants, followingParticipants, sameAreaParticipants, sameGoalCount, score, total: participants.length,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 5);
  };

  const scrollCarousel = (dir) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 280, behavior: "smooth" });
    }
  };

  const inputStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "12px 14px", border: "1px solid #E2E0D8", borderRadius: 10, background: "#fff", color: "#1A1A1A", width: "100%", boxSizing: "border-box", outline: "none" };
  const labelStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#9B9B8E", marginBottom: 5, display: "block" };
  const sectionTitle = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#C4C3BB", marginBottom: 16 };
  const pillBtn = (active, green) => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, padding: "7px 18px", borderRadius: 20,
    border: active ? "1px solid #E2E0D8" : `1px solid ${green ? "#2D5A3D" : "#E2E0D8"}`,
    background: active ? "transparent" : green ? "#2D5A3D" : "transparent",
    color: active ? "#9B9B8E" : green ? "#fff" : "#9B9B8E", cursor: "pointer", whiteSpace: "nowrap",
  });
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239B9B8E' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36 };

  const Avatar = ({ p, size = 36, fontSize = 13 }) => (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colorFor(p.id), color: "#fff", fontSize, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{getInitials(p.first_name, p.last_name)}</div>
  );

  const AvatarStack = ({ participants, max = 3 }) => (
    <div style={{ display: "flex", alignItems: "center" }}>
      {participants.slice(0, max).map((p, i) => (
        <div key={p.id} style={{ width: 26, height: 26, borderRadius: "50%", background: colorFor(p.id), color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -8 : 0, border: "2px solid #FAFAF7", fontFamily: "'DM Sans', sans-serif" }}>{getInitials(p.first_name, p.last_name)}</div>
      ))}
      {participants.length > max && <span style={{ fontSize: 11, fontWeight: 500, color: "#C4C3BB", marginLeft: 4 }}>+{participants.length - max}</span>}
    </div>
  );

  const TimePicker = ({ h, m, s, onH, onM, onS, label = "Målsetning (valgfritt)" }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <select value={h} onChange={(e) => onH(Number(e.target.value))} style={{ ...selectStyle, padding: "10px 12px" }}>
            {Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{i} t</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <select value={m} onChange={(e) => onM(Number(e.target.value))} style={{ ...selectStyle, padding: "10px 12px" }}>
            {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")} min</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <select value={s} onChange={(e) => onS(Number(e.target.value))} style={{ ...selectStyle, padding: "10px 12px" }}>
            {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")} sek</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const RaceRow = ({ race, onClick, rightContent }) => (
    <div onClick={onClick} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{race.name}</div>
        <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
      </div>
      {rightContent || <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>}
    </div>
  );

  // Fylke prompt for existing users
  if (needsFylke) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 380, width: "100%", padding: "0 20px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#2D5A3D", marginBottom: 8 }}>startlista</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Velg fylke</div>
          <div style={{ fontSize: 14, color: "#9B9B8E", lineHeight: 1.5, marginBottom: 24 }}>Vi har oppdatert profilen. Velg fylket ditt for å finne løpere i ditt område.</div>
          <select value={selectedFylke} onChange={(e) => setSelectedFylke(e.target.value)} style={{ ...selectStyle, marginBottom: 16 }}>
            <option value="">Velg fylke</option>
            {FYLKER.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={saveFylke} disabled={!selectedFylke} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "12px", borderRadius: 8, border: "none", background: "#2D5A3D", color: "#fff", cursor: selectedFylke ? "pointer" : "default", opacity: selectedFylke ? 1 : 0.4, width: "100%" }}>Lagre</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A" }}>

      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,250,247,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(226,224,216,0.6)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div onClick={goRaces} style={{ cursor: "pointer" }}>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px", color: "#2D5A3D" }}>startlista</span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {[
              { label: "Løp", v: "races", action: goRaces },
              { label: "Oversikt", v: "feed", action: goFeed },
              { label: "Min profil", v: "myprofile", action: () => openProfile(profile) },
            ].map((tab) => {
              const isActive = view === tab.v || (tab.v === "myprofile" && view === "profile" && selectedProfile?.id === userId);
              return <span key={tab.v} onClick={tab.action} style={{ fontSize: 13, cursor: "pointer", color: isActive ? "#2D5A3D" : "#9B9B8E", fontWeight: isActive ? 600 : 500, transition: "color 0.2s ease" }}>{tab.label}</span>;
            })}
          </div>
        </div>
      </header>

      <main key={fadeKey} style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px", animation: "fadeIn 0.35s cubic-bezier(0.25,0.1,0.25,1)" }}>
        <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* LØP */}
        {view === "races" && (
          <div style={{ padding: "24px 0 60px" }}>
            {/* Welcome */}
            <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.8px", marginBottom: 8 }}>Velkommen til startlista</div>
              <div style={{ fontSize: 15, color: "#9B9B8E", lineHeight: 1.5 }}>Din og dine løpevenners terminliste.</div>
              <div style={{ fontSize: 12, color: "#C4C3BB", marginTop: 8 }}>{totalUsers} løpere registrert</div>
            </div>

            {/* Search below welcome */}
            <div style={{ position: "relative", marginBottom: 28 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputStyle} />
              {globalSearch.length > 0 && (() => {
                const q = globalSearch.toLowerCase();
                const matchedUsers = profiles.filter((p) => fullName(p).toLowerCase().includes(q) || p.city.toLowerCase().includes(q));
                const matchedRaces = races.filter((r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
                if (!matchedUsers.length && !matchedRaces.length) return (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, padding: 14, zIndex: 50, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 13, color: "#9B9B8E", marginBottom: 8 }}>Ingen treff</div>
                    <div onClick={() => { setGlobalSearch(""); openProfile(profile); setTimeout(() => { setShowAddRace(true); setManualMode(true); }, 100); }} style={{ fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Finner ikke løpet? Legg til manuelt →</div>
                  </div>
                );
                return (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, zIndex: 50, marginTop: 4, maxHeight: 340, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
                    {matchedUsers.length > 0 && <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løpere</div>
                      {matchedUsers.map((p) => (
                        <div key={p.id} onClick={() => { openProfile(p); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F0EFE9" }}>
                          <Avatar p={p} size={28} fontSize={10} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(p)}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{p.city}</div></div>
                        </div>
                      ))}
                    </>}
                    {matchedRaces.length > 0 && <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løp</div>
                      {matchedRaces.map((race) => (
                        <div key={race.id} onClick={() => { openRace(race.id); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F0EFE9" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name}</div>
                          <div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                        </div>
                      ))}
                    </>}
                    <div onClick={() => { setGlobalSearch(""); openProfile(profile); setTimeout(() => { setShowAddRace(true); setManualMode(true); }, 100); }} style={{ padding: "10px 14px", borderTop: "1px solid #F0EFE9", fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Finner ikke løpet? Legg til manuelt →</div>
                  </div>
                );
              })()}
            </div>

            {/* Your and following's races */}
            {(() => {
              const relevantRaces = races.filter((r) => r.date >= today && entries.some((e) => e.race_id === r.id && (e.user_id === userId || followingIds.includes(e.user_id))));
              const visibleRaces = showAllRaces ? relevantRaces : relevantRaces.slice(0, 10);
              if (relevantRaces.length > 0) {
                return (
                  <>
                    <h2 style={sectionTitle}>Løp fra de du følger</h2>
                    <div>
                      {visibleRaces.map((race) => {
                        const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                        return <RaceRow key={race.id} race={race} onClick={() => openRace(race.id)} rightContent={
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {ps.length > 0 && <AvatarStack participants={ps} />}
                            <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                          </div>
                        } />;
                      })}
                    </div>
                    {relevantRaces.length > 10 && !showAllRaces && (
                      <div style={{ textAlign: "center", paddingTop: 12 }}>
                        <button onClick={() => setShowAllRaces(true)} style={{ ...pillBtn(false, false), fontSize: 13 }}>Se alle løp ({relevantRaces.length})</button>
                      </div>
                    )}
                  </>
                );
              }
              return null;
            })()}

            {/* Suggestions carousel */}
            {(() => {
              const suggestions = getRaceSuggestions();
              if (suggestions.length === 0) return null;
              return (
                <div style={{ marginTop: 40 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>Forslag til løp</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => scrollCarousel(-1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #E2E0D8", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#9B9B8E" }}>‹</button>
                      <button onClick={() => scrollCarousel(1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #E2E0D8", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#9B9B8E" }}>›</button>
                    </div>
                  </div>
                  <div ref={carouselRef} style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: 8 }}>
                    <style>{`::-webkit-scrollbar { display: none; }`}</style>
                    {suggestions.map((s) => (
                      <div key={s.race.id} onClick={() => openRace(s.race.id)} style={{
                        minWidth: 260, maxWidth: 260, scrollSnapAlign: "start", cursor: "pointer",
                        background: "#fff", borderRadius: 16, border: "1px solid #EDECE6", padding: 20,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s ease",
                      }}>
                        <div style={{ fontSize: 11, color: "#9B9B8E", marginBottom: 6 }}>{s.total} løpere registrert</div>
                        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12 }}>{s.race.name}</div>
                        <div style={{ fontSize: 11, color: "#7A7A6E", marginBottom: 14 }}>{raceLocation(s.race)} · {formatDate(s.race.date)}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                          {s.followingParticipants.length > 0 && <div style={{ fontSize: 12, color: "#1A1A1A" }}>{s.followingParticipants.length} du følger skal løpe</div>}
                          {s.sameAreaParticipants.length > 0 && <div style={{ fontSize: 12, color: "#1A1A1A" }}>{s.sameAreaParticipants.length} løpere fra {profile.city}</div>}
                          {s.sameGoalCount > 0 && <div style={{ fontSize: 12, color: "#1A1A1A" }}>{s.sameGoalCount} med samme tidsmål</div>}
                        </div>
                        {s.participants.length > 0 && <AvatarStack participants={s.participants} max={5} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* A few upcoming races */}
            {(() => {
              const myRaceIds = entries.filter((e) => e.user_id === userId || followingIds.includes(e.user_id)).map((e) => e.race_id);
              const otherRaces = races.filter((r) => r.date >= today && !myRaceIds.includes(r.id)).slice(0, 6);
              if (otherRaces.length === 0) return null;
              return (
                <div style={{ marginTop: 40 }}>
                  <h2 style={sectionTitle}>Kommende løp</h2>
                  <div>
                    {otherRaces.map((race) => {
                      const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                      return <RaceRow key={race.id} race={race} onClick={() => openRace(race.id)} rightContent={
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ps.length > 0 && <AvatarStack participants={ps} />}
                          <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                        </div>
                      } />;
                    })}
                  </div>
                  <div style={{ textAlign: "center", paddingTop: 12 }}>
                    <span style={{ fontSize: 12, color: "#C4C3BB" }}>Bruk søkefeltet for å finne flere løp</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* OVERSIKT */}
        {view === "feed" && (
          <div style={{ padding: "24px 0 60px" }}>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputStyle} />
              {globalSearch.length > 0 && (() => {
                const q = globalSearch.toLowerCase();
                const matchedUsers = profiles.filter((p) => fullName(p).toLowerCase().includes(q) || p.city.toLowerCase().includes(q));
                const matchedRaces = races.filter((r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
                if (!matchedUsers.length && !matchedRaces.length) return <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, padding: 14, fontSize: 13, color: "#9B9B8E", zIndex: 50, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>Ingen treff</div>;
                return (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, zIndex: 50, marginTop: 4, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
                    {matchedUsers.length > 0 && <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løpere</div>
                      {matchedUsers.map((p) => (
                        <div key={p.id} onClick={() => { openProfile(p); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F0EFE9" }}>
                          <Avatar p={p} size={28} fontSize={10} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(p)}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{p.city}</div></div>
                        </div>
                      ))}
                    </>}
                    {matchedRaces.length > 0 && <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løp</div>
                      {matchedRaces.map((race) => (
                        <div key={race.id} onClick={() => { openRace(race.id); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F0EFE9" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name}</div>
                          <div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                        </div>
                      ))}
                    </>}
                  </div>
                );
              })()}
            </div>

            {(() => {
              const raceGroups = {};
              entries.forEach((entry) => {
                const p = profiles.find((pr) => pr.id === entry.user_id);
                const race = races.find((r) => r.id === entry.race_id);
                if (p && race && race.date >= today && (followingIds.includes(p.id) || p.id === userId)) {
                  if (!raceGroups[race.id]) raceGroups[race.id] = { race, runners: [] };
                  raceGroups[race.id].runners.push({ profile: p, goal: entry.goal });
                }
              });
              const grouped = Object.values(raceGroups).sort((a, b) => a.race.date.localeCompare(b.race.date));

              if (grouped.length === 0) {
                return <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 15, color: "#C4C3BB", lineHeight: 1.6 }}>Følg løpere for å se deres planer her,<br />eller legg til egne løp fra Min profil.</div></div>;
              }

              return (
                <>
                  <h2 style={sectionTitle}>Oversikt</h2>
                  <div>
                    {grouped.map((group) => (
                      <div key={group.race.id} style={{ borderBottom: "1px solid #EDECE6" }}>
                        <div onClick={() => openRace(group.race.id)} style={{ padding: "16px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{group.race.name}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(group.race)} · {group.race.distance} · {formatDate(group.race.date)}</div>
                          </div>
                          <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                        </div>
                        <div style={{ paddingBottom: 12 }}>
                          {group.runners.map((r) => (
                            <div key={r.profile.id} style={{ padding: "5px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span onClick={() => openProfile(r.profile)} style={{ fontSize: 13, color: "#5A5A52", cursor: "pointer" }}>{fullName(r.profile)}</span>
                              {r.goal && <span style={{ fontSize: 11, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "2px 8px", borderRadius: 10 }}>{r.goal}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* PROFILE */}
        {view === "profile" && selectedProfile && (
          <div style={{ padding: "36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 28, fontWeight: 500 }}>← Tilbake</div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <Avatar p={selectedProfile} size={48} fontSize={17} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>{fullName(selectedProfile)}</div>
                  <div style={{ fontSize: 13, color: "#9B9B8E", marginTop: 1 }}>{selectedProfile.city}</div>
                </div>
              </div>
              {selectedProfile.id !== userId && !followingIds.includes(selectedProfile.id) && (
                <button onClick={() => toggleFollow(selectedProfile.id)} style={{ ...pillBtn(false, true), fontSize: 13, padding: "9px 24px" }}>Følg</button>
              )}
              {selectedProfile.id !== userId && followingIds.includes(selectedProfile.id) && (
                <span style={{ fontSize: 12, color: "#9B9B8E" }}>Følger</span>
              )}
              {selectedProfile.id === userId && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button onClick={() => { setShowAddRace(true); setManualMode(false); setSelectedExisting(null); setSearchQuery(""); }} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til løp</button>
                  <span onClick={() => { navigator.clipboard.writeText(`https://startlista.no/${fullName(profile).toLowerCase().replace(/\s+/g, "-")}`); alert("Lenke kopiert!"); }} style={{ fontSize: 12, color: "#9B9B8E", cursor: "pointer", textDecoration: "underline" }}>Del profil</span>
                </div>
              )}
            </div>

            {/* Add race panel */}
            {showAddRace && selectedProfile.id === userId && (
              <div style={{ background: "#fff", border: "1px solid #E2E0D8", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
                {!manualMode && !selectedExisting && (
                  <>
                    <input type="text" placeholder="Søk etter løp..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputStyle} autoFocus />
                    {searchQuery.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {filteredRaces.length === 0 ? <div style={{ fontSize: 13, color: "#C4C3BB", padding: "8px 0" }}>Ingen treff</div> : (
                          filteredRaces.map((race) => {
                            const already = myEntries.some((e) => e.race_id === race.id);
                            return (
                              <div key={race.id} onClick={() => !already && setSelectedExisting(race)} style={{ padding: "12px 0", borderBottom: "1px solid #F0EFE9", cursor: already ? "default" : "pointer", opacity: already ? 0.35 : 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name} {already && <span style={{ fontWeight: 400, fontSize: 11, color: "#C4C3BB" }}>(allerede lagt til)</span>}</div>
                                <div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={() => setManualMode(true)} style={pillBtn(false, false)}>Finner ikke løpet? Legg til manuelt</button>
                      <button onClick={() => { setShowAddRace(false); setSearchQuery(""); }} style={pillBtn(false, false)}>Avbryt</button>
                    </div>
                  </>
                )}
                {selectedExisting && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selectedExisting.name}</div>
                    <div style={{ fontSize: 12, color: "#9B9B8E", marginBottom: 14 }}>{raceLocation(selectedExisting)} · {selectedExisting.distance} · {formatDate(selectedExisting.date)}</div>
                    <TimePicker h={goalForExisting.h} m={goalForExisting.m} s={goalForExisting.s} onH={(v) => setGoalForExisting({ ...goalForExisting, h: v })} onM={(v) => setGoalForExisting({ ...goalForExisting, m: v })} onS={(v) => setGoalForExisting({ ...goalForExisting, s: v })} />
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={addExistingRace} style={{ ...pillBtn(false, true), fontSize: 13, padding: "9px 24px" }}>Legg til</button>
                      <button onClick={() => { setSelectedExisting(null); setGoalForExisting({ h: 0, m: 0, s: 0 }); }} style={pillBtn(false, false)}>Tilbake</button>
                    </div>
                  </>
                )}
                {manualMode && (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Legg til nytt løp</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Løpsnavn *</label>
                        <input type="text" placeholder="F.eks. Valencia Marathon" value={newRace.name} onChange={(e) => setNewRace({ ...newRace, name: e.target.value })} style={inputStyle} />
                        {getSuggestions(newRace.name).length > 0 && (
                          <div style={{ background: "#FFFBEB", border: "1px solid #E8DFB0", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: "#9B9B8E", marginBottom: 6 }}>Mente du?</div>
                            {getSuggestions(newRace.name).map((r) => (
                              <div key={r.id} onClick={() => { setManualMode(false); setSelectedExisting(r); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); }} style={{ padding: "6px 0", cursor: "pointer", fontSize: 14 }}>
                                <span style={{ fontWeight: 600 }}>{r.name}</span>
                                <span style={{ fontSize: 12, color: "#9B9B8E" }}> — {raceLocation(r)} · {formatDate(r.date)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Sted *</label><input type="text" placeholder="By" value={newRace.location} onChange={(e) => setNewRace({ ...newRace, location: e.target.value })} style={inputStyle} /></div>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Land</label><input type="text" placeholder="Land" value={newRace.country} onChange={(e) => setNewRace({ ...newRace, country: e.target.value })} style={inputStyle} /></div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Dato *</label><input type="date" value={newRace.date} onChange={(e) => setNewRace({ ...newRace, date: e.target.value })} style={inputStyle} /></div>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Distanse *</label>
                          <select value={["5 km", "10 km", "21.0975 km", "42.195 km"].includes(newRace.distance) ? newRace.distance : newRace.distance ? "annet" : ""} onChange={(e) => { if (e.target.value === "annet") setNewRace({ ...newRace, distance: "" }); else setNewRace({ ...newRace, distance: e.target.value }); }} style={selectStyle}>
                            <option value="">Velg distanse</option>
                            <option value="5 km">5 km</option>
                            <option value="10 km">10 km</option>
                            <option value="21.0975 km">Halvmaraton (21.0975 km)</option>
                            <option value="42.195 km">Maraton (42.195 km)</option>
                            <option value="annet">Annen distanse</option>
                          </select>
                          {!["5 km", "10 km", "21.0975 km", "42.195 km", ""].includes(newRace.distance) && (
                            <input type="text" placeholder="F.eks. 15 km" value={newRace.distance} onChange={(e) => setNewRace({ ...newRace, distance: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} autoFocus />
                          )}
                        </div>
                      </div>
                      <TimePicker h={newGoalH} m={newGoalM} s={newGoalS} onH={setNewGoalH} onM={setNewGoalM} onS={setNewGoalS} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                      <button onClick={addManualRace} disabled={!newRace.name || !newRace.location || !newRace.date || !newRace.distance} style={{ ...pillBtn(false, true), fontSize: 13, padding: "9px 24px", opacity: (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) ? 0.35 : 1 }}>Opprett og legg til</button>
                      <button onClick={() => { setManualMode(false); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); setNewGoalH(0); setNewGoalM(0); setNewGoalS(0); }} style={pillBtn(false, false)}>Tilbake</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Planned races */}
            <div>
              <h2 style={sectionTitle}>Planlagte løp</h2>
              {entries.filter((e) => e.user_id === selectedProfile.id && races.find((r) => r.id === e.race_id)?.date >= today).length === 0 ? (
                <div style={{ fontSize: 13, color: "#C4C3BB" }}>Ingen planlagte løp ennå</div>
              ) : (
                <div>
                  {[...entries.filter((e) => e.user_id === selectedProfile.id)].filter((e) => { const r = races.find((r) => r.id === e.race_id); return r && r.date >= today; }).sort((a, b) => { const rA = races.find((r) => r.id === a.race_id); const rB = races.find((r) => r.id === b.race_id); return rA.date.localeCompare(rB.date); }).map((entry) => {
                    const race = races.find((r) => r.id === entry.race_id);
                    if (!race) return null;
                    const isMe = selectedProfile.id === userId;
                    return (
                      <div key={entry.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div onClick={() => openRace(race.id)} style={{ cursor: "pointer" }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{race.name}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {editingGoalEntryId !== entry.id && entry.goal && (
                              <span onClick={() => isMe && startEditGoal(entry)} style={{ fontSize: 12, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "4px 10px", borderRadius: 12, cursor: isMe ? "pointer" : "default" }}>{entry.goal}</span>
                            )}
                            {editingGoalEntryId !== entry.id && !entry.goal && isMe && (
                              <span onClick={() => startEditGoal(entry)} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>+ mål</span>
                            )}
                          </div>
                        </div>
                        {editingGoalEntryId === entry.id && isMe && (
                          <div style={{ marginTop: 10 }}>
                            <TimePicker h={editGoalH} m={editGoalM} s={editGoalS} onH={setEditGoalH} onM={setEditGoalM} onS={setEditGoalS} label="Endre målsetning" />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => updateGoal(entry.id)} style={{ ...pillBtn(false, true), padding: "5px 14px", fontSize: 11 }}>Lagre</button>
                              <button onClick={() => setEditingGoalEntryId(null)} style={{ ...pillBtn(false, false), padding: "5px 14px", fontSize: 11 }}>Avbryt</button>
                            </div>
                          </div>
                        )}
                        {isMe && editingGoalEntryId !== entry.id && (
                          <div style={{ marginTop: 6 }}>
                            <span onClick={() => removeEntry(race.id)} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>Fjern fra listen</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed */}
            {(() => {
              const completed = entries.filter((e) => e.user_id === selectedProfile.id && races.find((r) => r.id === e.race_id)?.date < today);
              if (completed.length === 0) return null;
              return (
                <div style={{ marginTop: 36 }}>
                  <h2 style={sectionTitle}>Gjennomført</h2>
                  <div>
                    {completed.sort((a, b) => { const rA = races.find((r) => r.id === a.race_id); const rB = races.find((r) => r.id === b.race_id); return rB.date.localeCompare(rA.date); }).map((entry) => {
                      const race = races.find((r) => r.id === entry.race_id);
                      if (!race) return null;
                      return (
                        <div key={entry.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.45 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                          </div>
                          <span style={{ fontSize: 11, color: "#C4C3BB" }}>✓</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Following */}
            {selectedProfile.id === userId && followingIds.length > 0 && (
              <div style={{ marginTop: 36 }}>
                <h2 style={sectionTitle}>Følger</h2>
                <div>
                  {profiles.filter((p) => followingIds.includes(p.id)).map((p) => (
                    <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar p={p} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>{fullName(p)}</div>
                          <div style={{ fontSize: 12, color: "#9B9B8E" }}>{p.city}</div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleFollow(p.id); }} style={pillBtn(true, true)}>Følger</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            {selectedProfile.id === userId && (
              <div style={{ marginTop: 48 }}>
                <button onClick={() => setShowSettings(!showSettings)} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {showSettings ? "Skjul innstillinger" : "Innstillinger"}
                </button>

                {showSettings && (
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 24 }}>
                    {settingsMessage && <div style={{ fontSize: 12, color: "#2D5A3D", background: "#EFF5F0", padding: "10px 14px", borderRadius: 10 }}>{settingsMessage}</div>}

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre fylke</div>
                      {!editingFylke ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 14 }}>{profile.city}</span>
                          <button onClick={() => { setEditingFylke(true); setEditFylke(profile.city); }} style={{ ...pillBtn(false, false), padding: "4px 14px", fontSize: 11 }}>Endre</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <select value={editFylke} onChange={(e) => setEditFylke(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                            <option value="">Velg fylke</option>
                            {FYLKER.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <button onClick={updateFylke} style={{ ...pillBtn(false, true), padding: "7px 16px" }}>Lagre</button>
                          <button onClick={() => setEditingFylke(false)} style={{ ...pillBtn(false, false), padding: "7px 16px" }}>Avbryt</button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre passord</div>
                      {!changingPassword ? (
                        <button onClick={() => setChangingPassword(true)} style={{ ...pillBtn(false, false), padding: "4px 14px", fontSize: 11 }}>Endre passord</button>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="password" placeholder="Nytt passord (min. 6 tegn)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                          <button onClick={changePassword} style={{ ...pillBtn(false, true), padding: "7px 16px" }}>Lagre</button>
                          <button onClick={() => { setChangingPassword(false); setNewPassword(""); }} style={{ ...pillBtn(false, false), padding: "7px 16px" }}>Avbryt</button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Slett konto</div>
                      {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 11, color: "#C53030", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline", padding: 0 }}>Slett kontoen min permanent</button>
                      ) : (
                        <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 10, padding: 18 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#C53030", marginBottom: 8 }}>Er du sikker?</div>
                          <div style={{ fontSize: 12, color: "#7A7A6E", marginBottom: 14 }}>Alle dine data slettes permanent. Dette kan ikke angres.</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={deleteAccount} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: "7px 18px", borderRadius: 20, border: "1px solid #C53030", background: "#C53030", color: "#fff", cursor: "pointer" }}>Ja, slett kontoen</button>
                            <button onClick={() => setShowDeleteConfirm(false)} style={pillBtn(false, false)}>Avbryt</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ paddingTop: 8 }}>
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button>
                    </div>
                  </div>
                )}

                {!showSettings && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RACE DETAIL */}
        {view === "race" && selectedRace && (
          <div style={{ padding: "36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 28, fontWeight: 500 }}>← Tilbake</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>{selectedRace.name}</h1>
            <div style={{ fontSize: 14, color: "#9B9B8E", marginBottom: selectedRace.user_created ? 8 : 8 }}>{raceLocation(selectedRace)} · {selectedRace.distance} · {formatDate(selectedRace.date)}</div>
            {selectedRace.user_created && <div style={{ fontSize: 11, color: "#C4C3BB", marginBottom: 8 }}>Lagt til av bruker — verifiser dato hos arrangør</div>}
            <div style={{ fontSize: 12, color: "#C4C3BB", marginBottom: 20 }}>{entries.filter((e) => e.race_id === selectedRace.id).length} løpere registrert</div>

            {!myEntries.some((e) => e.race_id === selectedRace.id) ? (
              <div style={{ marginBottom: 28 }}>
                <button onClick={() => addRaceToMyList(selectedRace.id)} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til i mine løp</button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#9B9B8E", marginBottom: 28 }}>✓ Lagt til i dine løp</div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...sectionTitle, marginBottom: 0 }}>Påmeldte løpere</h2>
              <button onClick={() => setRaceSortByTime((v) => !v)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 14, border: "1px solid #E2E0D8", background: raceSortByTime ? "#2D5A3D" : "transparent", color: raceSortByTime ? "#fff" : "#9B9B8E", cursor: "pointer" }}>
                {raceSortByTime ? "Sortert etter tid" : "Sorter etter tid"}
              </button>
            </div>
            {(() => {
              const raceEntries = entries.filter((e) => e.race_id === selectedRace.id);
              if (raceEntries.length === 0) return <div style={{ fontSize: 13, color: "#C4C3BB" }}>Ingen registrerte løpere ennå</div>;

              let sorted;
              if (raceSortByTime) {
                sorted = [...raceEntries].sort((a, b) => {
                  const sa = parseGoalSeconds(a.goal);
                  const sb = parseGoalSeconds(b.goal);
                  if (sa && sb) return sa - sb;
                  if (sa) return -1;
                  if (sb) return 1;
                  return 0;
                });
              } else {
                // Default: following first, then rest
                const followingEntries = raceEntries.filter((e) => followingIds.includes(e.user_id) || e.user_id === userId);
                const otherEntries = raceEntries.filter((e) => !followingIds.includes(e.user_id) && e.user_id !== userId);
                sorted = [...followingEntries, ...otherEntries];
              }

              return (
                <div>
                  {sorted.map((entry) => {
                    const p = profiles.find((pr) => pr.id === entry.user_id);
                    if (!p) return null;
                    const isMe = p.id === userId;
                    const isFollowing = followingIds.includes(p.id);
                    return (
                      <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar p={p} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>{fullName(p)} {isMe && <span style={{ fontWeight: 400, color: "#C4C3BB" }}>(deg)</span>}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{p.city}{entry.goal && ` · Mål: ${entry.goal}`}</div>
                          </div>
                        </div>
                        {!isMe && <span style={{ color: "#D4D3CC", fontSize: 16, cursor: "pointer" }} onClick={() => openProfile(p)}>›</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      <footer style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "#C4C3BB", borderTop: "1px solid #EDECE6" }}>
        <div>startlista · laget for løpere som vil finne hverandre</div>
        <div style={{ marginTop: 6 }}><a href="/personvern" style={{ color: "#C4C3BB", textDecoration: "underline" }}>Personvern</a></div>
      </footer>
    </div>
  );
}
