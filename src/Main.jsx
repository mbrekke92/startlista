import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getInitials = (first, last) => `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();
const COLORS = ["#2D5A3D", "#8B4513", "#4A5568", "#6B3A5D", "#2C5282", "#744210"];
const colorFor = (id) => COLORS[id.charCodeAt(0) % COLORS.length];
const capitalize = (str) => str.replace(/\b\w/g, (c) => c.toUpperCase());

const fuzzyMatch = (input, target) => {
  const a = input.toLowerCase().replace(/[^a-zæøå0-9]/g, "");
  const b = target.toLowerCase().replace(/[^a-zæøå0-9]/g, "");
  if (a.length < 4) return false;
  if (b.includes(a) || a.includes(b)) return true;
  // Only match if strings are very similar
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
  const [goalForExisting, setGoalForExisting] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editingCity, setEditingCity] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [editingGoalEntryId, setEditingGoalEntryId] = useState(null);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [fadeKey, setFadeKey] = useState(0);

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
      setProfile(profileRes.data);
      setProfiles(profilesRes.data || []);
      setRaces(racesRes.data || []);
      setEntries(entriesRes.data || []);
      setFollows((followsRes.data || []).map((f) => f.following_id));
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

  const navigate = (fn) => { setFadeKey((k) => k + 1); fn(); };

  const toggleFollow = async (targetId) => {
    if (followingIds.includes(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      setFollows((prev) => prev.filter((id) => id !== targetId));
    } else {
      await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
      setFollows((prev) => [...prev, targetId]);
    }
  };

  const addRaceToMyList = async (raceId) => {
    if (myEntries.some((e) => e.race_id === raceId)) return;
    const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: raceId, goal: "" }).select().single();
    if (data) setEntries((prev) => [...prev, data]);
  };

  const addExistingRace = async () => {
    if (!selectedExisting) return;
    if (myEntries.some((e) => e.race_id === selectedExisting.id)) return;
    const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: selectedExisting.id, goal: goalForExisting }).select().single();
    if (data) setEntries((prev) => [...prev, data]);
    setShowAddRace(false); setSelectedExisting(null); setGoalForExisting(""); setSearchQuery("");
  };

  const addManualRace = async () => {
    if (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) return;
    const { data: raceData, error: raceError } = await supabase.from("races").insert({
      name: capitalize(newRace.name), location: capitalize(newRace.location),
      date: newRace.date, distance: newRace.distance,
      country: newRace.country ? capitalize(newRace.country) : "", user_created: true,
    }).select().single();
    if (raceError) { console.error("Race insert error:", raceError); return; }
    if (raceData) {
      setRaces((prev) => [...prev, raceData]);
      const { data: entryData, error: entryError } = await supabase.from("entries").insert({ user_id: userId, race_id: raceData.id, goal: newRace.goal || "" }).select().single();
      if (entryError) { console.error("Entry insert error:", entryError); return; }
      if (entryData) setEntries((prev) => [...prev, entryData]);
    }
    setShowAddRace(false); setManualMode(false); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); setSearchQuery("");
  };

  const removeEntry = async (raceId) => {
    await supabase.from("entries").delete().eq("user_id", userId).eq("race_id", raceId);
    setEntries((prev) => prev.filter((e) => !(e.user_id === userId && e.race_id === raceId)));
  };

  const updateGoal = async (entryId, newGoal) => {
    await supabase.from("entries").update({ goal: newGoal }).eq("id", entryId);
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, goal: newGoal } : e));
    setEditingGoalEntryId(null); setEditGoalValue("");
  };

  const updateCity = async () => {
    if (!editCity.trim()) return;
    await supabase.from("profiles").update({ city: editCity.trim() }).eq("id", userId);
    setProfile((prev) => ({ ...prev, city: editCity.trim() }));
    setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, city: editCity.trim() } : p));
    setEditingCity(false);
    setSettingsMessage("By oppdatert");
    setTimeout(() => setSettingsMessage(""), 2000);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setSettingsMessage("Passordet må være minst 6 tegn"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setSettingsMessage(error.message);
    else { setSettingsMessage("Passord endret"); setNewPassword(""); setChangingPassword(false); }
    setTimeout(() => setSettingsMessage(""), 3000);
  };

  const deleteAccount = async () => {
    await supabase.rpc("delete_user");
    await supabase.auth.signOut();
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const openProfile = (p) => navigate(() => { setSelectedProfile(p); setView("profile"); setGlobalSearch(""); setShowSettings(false); });
  const openRace = (raceId) => navigate(() => { setSelectedRace(races.find((r) => r.id === raceId)); setView("race"); setGlobalSearch(""); });
  const goRaces = () => navigate(() => { setView("races"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); });
  const goFeed = () => navigate(() => { setView("feed"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); });

  const raceLocation = (race) => `${race.location}${race.country && race.country !== "Norge" ? `, ${race.country}` : ""}`;

  const filteredRaces = searchQuery.length > 0
    ? races.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.location.toLowerCase().includes(searchQuery.toLowerCase()) || (r.country && r.country.toLowerCase().includes(searchQuery.toLowerCase()))).slice(0, 5)
    : [];

  const getSuggestions = (name) => {
    if (!name || name.length < 4) return [];
    return races.filter((r) => fuzzyMatch(name, r.name) && !myEntries.some((e) => e.race_id === r.id)).slice(0, 3);
  };

  const inputStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "12px 14px", border: "1px solid #E2E0D8", borderRadius: 10, background: "#fff", color: "#1A1A1A", width: "100%", boxSizing: "border-box", outline: "none", transition: "border-color 0.2s ease" };
  const labelStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#9B9B8E", marginBottom: 5, display: "block" };
  const sectionTitle = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#C4C3BB", marginBottom: 16 };
  const pillBtn = (active, green) => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, padding: "7px 18px", borderRadius: 20,
    border: active ? "1px solid #E2E0D8" : `1px solid ${green ? "#2D5A3D" : "#E2E0D8"}`,
    background: active ? "transparent" : green ? "#2D5A3D" : "transparent",
    color: active ? "#9B9B8E" : green ? "#fff" : "#9B9B8E", cursor: "pointer", whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  });

  const Avatar = ({ p, size = 36, fontSize = 13 }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: colorFor(p.id),
      color: "#fff", fontSize, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{getInitials(p.first_name, p.last_name)}</div>
  );

  const AvatarStack = ({ participants }) => (
    <div style={{ display: "flex", alignItems: "center" }}>
      {participants.slice(0, 3).map((p, i) => (
        <div key={p.id} style={{
          width: 26, height: 26, borderRadius: "50%", background: colorFor(p.id),
          color: "#fff", fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: i > 0 ? -8 : 0, border: "2px solid #FAFAF7",
        }}>{getInitials(p.first_name, p.last_name)}</div>
      ))}
      {participants.length > 3 && (
        <span style={{ fontSize: 11, fontWeight: 500, color: "#C4C3BB", marginLeft: 4 }}>+{participants.length - 3}</span>
      )}
    </div>
  );

  const RaceRow = ({ race, onClick, rightContent }) => (
    <div onClick={onClick} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.15s ease" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{race.name}</div>
        <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
      </div>
      {rightContent || <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A" }}>

      {/* Frosted glass header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(250,250,247,0.85)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(226,224,216,0.6)",
      }}>
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
              return (
                <span key={tab.v} onClick={tab.action} style={{
                  fontSize: 13, cursor: "pointer", transition: "color 0.2s ease",
                  color: isActive ? "#2D5A3D" : "#C4C3BB",
                  fontWeight: isActive ? 600 : 400,
                }}>{tab.label}</span>
              );
            })}
          </div>
        </div>
      </header>

      <main key={fadeKey} style={{
        maxWidth: 640, margin: "0 auto", padding: "0 20px",
        animation: "fadeIn 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}>
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {/* Universal search */}
        {(view === "feed" || view === "races") && (
          <div style={{ padding: "24px 0 0", position: "relative" }}>
            <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputStyle} />
            {globalSearch.length > 0 && (() => {
              const q = globalSearch.toLowerCase();
              const matchedUsers = profiles.filter((p) => fullName(p).toLowerCase().includes(q) || p.city.toLowerCase().includes(q));
              const matchedRaces = races.filter((r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
              if (matchedUsers.length === 0 && matchedRaces.length === 0) return <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, padding: 14, fontSize: 13, color: "#9B9B8E", zIndex: 50, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>Ingen treff</div>;
              return (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, zIndex: 50, marginTop: 4, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
                  {matchedUsers.length > 0 && (
                    <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løpere</div>
                      {matchedUsers.map((p) => (
                        <div key={p.id} onClick={() => { openProfile(p); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F0EFE9", transition: "background 0.15s ease" }}>
                          <Avatar p={p} size={28} fontSize={10} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(p)}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{p.city}</div></div>
                        </div>
                      ))}
                    </>
                  )}
                  {matchedRaces.length > 0 && (
                    <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løp</div>
                      {matchedRaces.map((race) => (
                        <div key={race.id} onClick={() => { openRace(race.id); setGlobalSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F0EFE9" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name}</div>
                          <div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* LØP */}
        {view === "races" && (
          <div style={{ padding: "24px 0 60px" }}>
            <div style={{ textAlign: "center", padding: "32px 0 36px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.8px", marginBottom: 8 }}>Velkommen til startlista</div>
              <div style={{ fontSize: 15, color: "#9B9B8E", lineHeight: 1.5 }}>Din og dine løpevenners terminliste.</div>
            </div>

            {/* Races where you or people you follow are signed up */}
            {(() => {
              const relevantRaces = races.filter((r) => r.date >= today && entries.some((e) => e.race_id === r.id && (e.user_id === userId || followingIds.includes(e.user_id))));
              if (relevantRaces.length > 0) {
                return (
                  <>
                    <h2 style={sectionTitle}>Dine løp</h2>
                    <div>
                      {relevantRaces.map((race) => {
                        const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                        return (
                          <RaceRow key={race.id} race={race} onClick={() => openRace(race.id)} rightContent={
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {ps.length > 0 && <AvatarStack participants={ps} />}
                              <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                            </div>
                          } />
                        );
                      })}
                    </div>
                  </>
                );
              }
              return null;
            })()}

            {/* A few upcoming popular races */}
            {(() => {
              const myRaceIds = entries.filter((e) => e.user_id === userId || followingIds.includes(e.user_id)).map((e) => e.race_id);
              const otherRaces = races.filter((r) => r.date >= today && !myRaceIds.includes(r.id)).slice(0, 6);
              return (
                <>
                  <h2 style={{ ...sectionTitle, marginTop: 36 }}>Kommende løp</h2>
                  <div>
                    {otherRaces.map((race) => {
                      const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                      return (
                        <RaceRow key={race.id} race={race} onClick={() => openRace(race.id)} rightContent={
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {ps.length > 0 && <AvatarStack participants={ps} />}
                            <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                          </div>
                        } />
                      );
                    })}
                  </div>
                  <div style={{ textAlign: "center", paddingTop: 16 }}>
                    <span style={{ fontSize: 12, color: "#C4C3BB" }}>Bruk søkefeltet for å finne flere løp</span>
                  </div>
                </>
              );
            })()}

            <div style={{ padding: "48px 0 0" }}>
              <h2 style={sectionTitle}>Løpere</h2>
              <div>
                {profiles.filter((p) => p.id !== userId).map((p) => (
                  <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar p={p} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>{fullName(p)}</div>
                        <div style={{ fontSize: 12, color: "#9B9B8E" }}>{p.city} · {entries.filter((e) => e.user_id === p.id).length} planlagte løp</div>
                      </div>
                    </div>
                    <span style={{ color: "#D4D3CC", fontSize: 16, cursor: "pointer" }} onClick={() => openProfile(p)}>›</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OVERSIKT */}
        {view === "feed" && (
          <div style={{ padding: "24px 0 60px" }}>
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
                return (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 15, color: "#C4C3BB", lineHeight: 1.6 }}>Følg løpere for å se deres planer her,<br />eller legg til egne løp fra Min profil.</div>
                  </div>
                );
              }

              return (
                <>
                  <div style={{ padding: "8px 0 0" }}>
                    <h2 style={sectionTitle}>Oversikt</h2>
                  </div>
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
                              <span onClick={() => openProfile(r.profile)} style={{ fontSize: 13, color: "#7A7A6E", cursor: "pointer" }}>{fullName(r.profile)}</span>
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
            <div onClick={goFeed} style={{ fontSize: 13, color: "#C4C3BB", cursor: "pointer", marginBottom: 28 }}>← Tilbake</div>

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
                <span style={{ fontSize: 12, color: "#C4C3BB" }}>Følger</span>
              )}
              {selectedProfile.id === userId && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button onClick={() => { setShowAddRace(true); setManualMode(false); setSelectedExisting(null); setSearchQuery(""); }} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(45,90,61,0.2)", transition: "all 0.2s ease" }}>+ Legg til løp</button>
                  <span onClick={() => { navigator.clipboard.writeText(`https://startlista.no/${fullName(profile).toLowerCase().replace(/\s+/g, "-")}`); alert("Lenke kopiert!"); }} style={{ fontSize: 12, color: "#C4C3BB", cursor: "pointer", textDecoration: "underline" }}>Del profil</span>
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
                    <label style={labelStyle}>Målsetning (valgfritt)</label>
                    <input type="text" placeholder="F.eks. Sub 3:30" value={goalForExisting} onChange={(e) => setGoalForExisting(e.target.value)} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={addExistingRace} style={{ ...pillBtn(false, true), fontSize: 13, padding: "9px 24px" }}>Legg til</button>
                      <button onClick={() => { setSelectedExisting(null); setGoalForExisting(""); }} style={pillBtn(false, false)}>Tilbake</button>
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
                        <div style={{ flex: 1 }}><label style={labelStyle}>Distanse *</label><input type="text" placeholder="F.eks. 42.2 km" value={newRace.distance} onChange={(e) => setNewRace({ ...newRace, distance: e.target.value })} style={inputStyle} /></div>
                      </div>
                      <div><label style={labelStyle}>Målsetning (valgfritt)</label><input type="text" placeholder="F.eks. Sub 3:30" value={newRace.goal} onChange={(e) => setNewRace({ ...newRace, goal: e.target.value })} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                      <button onClick={addManualRace} disabled={!newRace.name || !newRace.location || !newRace.date || !newRace.distance} style={{
                        ...pillBtn(false, true), fontSize: 13, padding: "9px 24px",
                        opacity: (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) ? 0.35 : 1,
                      }}>Opprett og legg til</button>
                      <button onClick={() => { setManualMode(false); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); }} style={pillBtn(false, false)}>Tilbake</button>
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
                  {[...entries.filter((e) => e.user_id === selectedProfile.id)].filter((e) => {
                    const race = races.find((r) => r.id === e.race_id);
                    return race && race.date >= today;
                  }).sort((a, b) => {
                    const rA = races.find((r) => r.id === a.race_id);
                    const rB = races.find((r) => r.id === b.race_id);
                    return rA.date.localeCompare(rB.date);
                  }).map((entry) => {
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
                              <span onClick={() => isMe && (setEditingGoalEntryId(entry.id), setEditGoalValue(entry.goal))} style={{ fontSize: 12, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "4px 10px", borderRadius: 12, cursor: isMe ? "pointer" : "default" }}>{entry.goal}</span>
                            )}
                            {editingGoalEntryId !== entry.id && !entry.goal && isMe && (
                              <span onClick={() => { setEditingGoalEntryId(entry.id); setEditGoalValue(""); }} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>+ mål</span>
                            )}
                          </div>
                        </div>
                        {editingGoalEntryId === entry.id && isMe && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                            <input type="text" placeholder="Målsetning (valgfritt)" value={editGoalValue} onChange={(e) => setEditGoalValue(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 13 }} autoFocus />
                            <button onClick={() => updateGoal(entry.id, editGoalValue)} style={{ ...pillBtn(false, true), padding: "5px 14px", fontSize: 11 }}>Lagre</button>
                            <button onClick={() => setEditingGoalEntryId(null)} style={{ ...pillBtn(false, false), padding: "5px 14px", fontSize: 11 }}>Avbryt</button>
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
                    {completed.sort((a, b) => {
                      const rA = races.find((r) => r.id === a.race_id);
                      const rB = races.find((r) => r.id === b.race_id);
                      return rB.date.localeCompare(rA.date);
                    }).map((entry) => {
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
                <button onClick={() => setShowSettings(!showSettings)} style={{ fontSize: 12, color: "#C4C3BB", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>
                  {showSettings ? "Skjul innstillinger" : "Innstillinger"}
                </button>

                {showSettings && (
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 24 }}>
                    {settingsMessage && <div style={{ fontSize: 12, color: "#2D5A3D", background: "#EFF5F0", padding: "10px 14px", borderRadius: 10 }}>{settingsMessage}</div>}

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#9B9B8E", marginBottom: 8 }}>Endre by</div>
                      {!editingCity ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 14 }}>{profile.city}</span>
                          <button onClick={() => { setEditingCity(true); setEditCity(profile.city); }} style={{ ...pillBtn(false, false), padding: "4px 14px", fontSize: 11 }}>Endre</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                          <button onClick={updateCity} style={{ ...pillBtn(false, true), padding: "7px 16px" }}>Lagre</button>
                          <button onClick={() => setEditingCity(false)} style={{ ...pillBtn(false, false), padding: "7px 16px" }}>Avbryt</button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#9B9B8E", marginBottom: 8 }}>Endre passord</div>
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#9B9B8E", marginBottom: 8 }}>Slett konto</div>
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
                      <button onClick={handleLogout} style={{ fontSize: 12, color: "#C4C3BB", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button>
                    </div>
                  </div>
                )}

                {!showSettings && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={handleLogout} style={{ fontSize: 12, color: "#C4C3BB", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RACE DETAIL */}
        {view === "race" && selectedRace && (
          <div style={{ padding: "36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#C4C3BB", cursor: "pointer", marginBottom: 28 }}>← Tilbake</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>{selectedRace.name}</h1>
            <div style={{ fontSize: 14, color: "#9B9B8E", marginBottom: selectedRace.user_created ? 8 : 20 }}>{raceLocation(selectedRace)} · {selectedRace.distance} · {formatDate(selectedRace.date)}</div>
            {selectedRace.user_created && <div style={{ fontSize: 11, color: "#D4D3CC", marginBottom: 20 }}>Lagt til av bruker — verifiser dato hos arrangør</div>}

            {!myEntries.some((e) => e.race_id === selectedRace.id) ? (
              <div style={{ marginBottom: 28 }}>
                <button onClick={() => addRaceToMyList(selectedRace.id)} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(45,90,61,0.2)", transition: "all 0.2s ease" }}>+ Legg til i mine løp</button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#C4C3BB", marginBottom: 28 }}>✓ Lagt til i dine løp</div>
            )}

            <h2 style={sectionTitle}>Påmeldte løpere</h2>
            {(() => {
              const raceEntries = entries.filter((e) => e.race_id === selectedRace.id);
              if (raceEntries.length === 0) return <div style={{ fontSize: 13, color: "#C4C3BB" }}>Ingen registrerte løpere ennå</div>;
              return (
                <div>
                  {raceEntries.map((entry) => {
                    const p = profiles.find((pr) => pr.id === entry.user_id);
                    if (!p) return null;
                    const isMe = p.id === userId;
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
