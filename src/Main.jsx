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
  if (a.length < 3) return false;
  if (b.includes(a) || a.includes(b)) return true;
  let matches = 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / shorter.length > 0.7;
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

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editingCity, setEditingCity] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  // Edit goal state
  const [editingGoalEntryId, setEditingGoalEntryId] = useState(null);
  const [editGoalValue, setEditGoalValue] = useState("");

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
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 600, color: "#2D5A3D" }}>startlista</span>
      </div>
    );
  }

  const fullName = (p) => `${p.first_name} ${p.last_name}`;
  const myEntries = entries.filter((e) => e.user_id === userId);
  const followingIds = follows;
  const today = new Date().toISOString().split("T")[0];

  const toggleFollow = async (targetId) => {
    if (followingIds.includes(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      setFollows((prev) => prev.filter((id) => id !== targetId));
    } else {
      await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
      setFollows((prev) => [...prev, targetId]);
    }
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
    const { data: raceData } = await supabase.from("races").insert({
      name: capitalize(newRace.name), location: capitalize(newRace.location),
      date: newRace.date, distance: newRace.distance,
      country: newRace.country ? capitalize(newRace.country) : "", user_created: true,
    }).select().single();
    if (raceData) {
      setRaces((prev) => [...prev, raceData]);
      const { data: entryData } = await supabase.from("entries").insert({ user_id: userId, race_id: raceData.id, goal: newRace.goal }).select().single();
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

  const openProfile = (p) => { setSelectedProfile(p); setView("profile"); setGlobalSearch(""); setShowSettings(false); };
  const openRace = (raceId) => { setSelectedRace(races.find((r) => r.id === raceId)); setView("race"); setGlobalSearch(""); };
  const goRaces = () => { setView("races"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); };
  const goFeed = () => { setView("feed"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); };

  const raceLocation = (race) => `${race.location}${race.country && race.country !== "Norge" ? `, ${race.country}` : ""}`;

  const filteredRaces = searchQuery.length > 0
    ? races.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.location.toLowerCase().includes(searchQuery.toLowerCase()) || (r.country && r.country.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  const getSuggestions = (name) => {
    if (!name || name.length < 3) return [];
    return races.filter((r) => fuzzyMatch(name, r.name) && !myEntries.some((e) => e.race_id === r.id));
  };

  const inputStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "10px 12px", border: "1px solid #E2E0D8", borderRadius: 8, background: "#fff", color: "#1A1A1A", width: "100%", boxSizing: "border-box", outline: "none" };
  const labelStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#7A7A6E", marginBottom: 4, display: "block" };
  const sectionTitle = { fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.5px", color: "#9B9B8E", marginBottom: 16 };
  const pillBtn = (active, green) => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, padding: "6px 16px", borderRadius: 20,
    border: active ? "1px solid #E2E0D8" : `1px solid ${green ? "#2D5A3D" : "#E2E0D8"}`,
    background: active ? "transparent" : green ? "#2D5A3D" : "transparent",
    color: active ? "#7A7A6E" : green ? "#fff" : "#7A7A6E", cursor: "pointer", whiteSpace: "nowrap",
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
        <span style={{ fontSize: 11, fontWeight: 500, color: "#9B9B8E", marginLeft: 4 }}>+{participants.length - 3}</span>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A" }}>

      <header style={{ borderBottom: "1px solid #E2E0D8", background: "#FAFAF7", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div onClick={goRaces} style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 20, letterSpacing: "-0.5px", color: "#2D5A3D" }}>startlista</span>
            <span style={{ fontSize: 11, color: "#9B9B8E" }}>beta</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Løp", v: "races", action: goRaces },
              { label: "Oversikt", v: "feed", action: goFeed },
              { label: "Min profil", v: "myprofile", action: () => openProfile(profile) },
            ].map((tab) => (
              <span key={tab.v} onClick={tab.action} style={{
                fontSize: 14, cursor: "pointer",
                color: (view === tab.v || (tab.v === "myprofile" && view === "profile" && selectedProfile?.id === userId)) ? "#2D5A3D" : "#7A7A6E",
                fontWeight: (view === tab.v || (tab.v === "myprofile" && view === "profile" && selectedProfile?.id === userId)) ? 600 : 400,
              }}>{tab.label}</span>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px" }}>

        {/* Universal search */}
        {(view === "feed" || view === "races") && (
          <div style={{ padding: "20px 0 0", position: "relative" }}>
            <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputStyle} />
            {globalSearch.length > 0 && (() => {
              const q = globalSearch.toLowerCase();
              const matchedUsers = profiles.filter((p) => fullName(p).toLowerCase().includes(q) || p.city.toLowerCase().includes(q));
              const matchedRaces = races.filter((r) => r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
              if (matchedUsers.length === 0 && matchedRaces.length === 0) return <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 8, padding: 12, fontSize: 13, color: "#9B9B8E", zIndex: 50, marginTop: 4 }}>Ingen treff</div>;
              return (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 8, zIndex: 50, marginTop: 4, maxHeight: 300, overflowY: "auto" }}>
                  {matchedUsers.length > 0 && (
                    <>
                      <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#9B9B8E" }}>Løpere</div>
                      {matchedUsers.map((p) => (
                        <div key={p.id} onClick={() => { openProfile(p); setGlobalSearch(""); }} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F0EFE9" }}>
                          <Avatar p={p} size={28} fontSize={10} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(p)}</div><div style={{ fontSize: 11, color: "#7A7A6E" }}>{p.city}</div></div>
                        </div>
                      ))}
                    </>
                  )}
                  {matchedRaces.length > 0 && (
                    <>
                      <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#9B9B8E" }}>Løp</div>
                      {matchedRaces.map((race) => (
                        <div key={race.id} onClick={() => { openRace(race.id); setGlobalSearch(""); }} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #F0EFE9" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name}</div>
                          <div style={{ fontSize: 11, color: "#7A7A6E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* RACES LIST */}
        {view === "races" && (
          <div style={{ padding: "20px 0 40px" }}>
            <h2 style={sectionTitle}>Kommende løp</h2>
            <div>
              {races.filter((r) => r.date >= today).map((race) => {
                const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                return (
                  <div key={race.id} onClick={() => openRace(race.id)} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div>
                      <div style={{ fontSize: 12, color: "#7A7A6E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {ps.length > 0 && <AvatarStack participants={ps} />}
                      <span style={{ color: "#C4C3BB", fontSize: 16 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "36px 0 0" }}>
              <h2 style={sectionTitle}>Løpere</h2>
              <div>
                {profiles.filter((p) => p.id !== userId).map((p) => (
                  <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar p={p} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{fullName(p)}</div>
                        <div style={{ fontSize: 12, color: "#7A7A6E" }}>{p.city} · {entries.filter((e) => e.user_id === p.id).length} planlagte løp</div>
                      </div>
                    </div>
                    <span style={{ color: "#C4C3BB", fontSize: 16, cursor: "pointer" }} onClick={() => openProfile(p)}>›</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FEED / OVERSIKT */}
        {view === "feed" && (
          <div style={{ padding: "20px 0 40px" }}>
            {(() => {
              const raceGroups = {};
              entries.forEach((entry) => {
                const p = profiles.find((pr) => pr.id === entry.user_id);
                const race = races.find((r) => r.id === entry.race_id);
                if (p && race && (followingIds.includes(p.id) || p.id === userId)) {
                  if (!raceGroups[race.id]) raceGroups[race.id] = { race, runners: [] };
                  raceGroups[race.id].runners.push({ profile: p, goal: entry.goal });
                }
              });
              const grouped = Object.values(raceGroups).sort((a, b) => a.race.date.localeCompare(b.race.date));

              if (followingIds.length === 0) {
                const upcoming = races.filter((r) => r.date >= today);
                return (
                  <>
                    <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#2D5A3D", marginBottom: 6 }}>Velkommen til startlista</div>
                      <div style={{ fontSize: 14, color: "#7A7A6E", lineHeight: 1.5 }}>Din og dine løpevenners terminliste. Se hvem som skal løpe hva, og del dine egne planer.</div>
                    </div>
                    <h2 style={sectionTitle}>Kommende løp</h2>
                    <div>
                      {upcoming.map((race) => {
                        const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
                        return (
                          <div key={race.id} onClick={() => openRace(race.id)} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div>
                              <div style={{ fontSize: 12, color: "#7A7A6E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {ps.length > 0 && <AvatarStack participants={ps} />}
                              <span style={{ color: "#C4C3BB", fontSize: 16 }}>›</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              }

              return (
                <>
                  <h2 style={sectionTitle}>Oversikt</h2>
                  <div>
                    {grouped.map((group) => (
                      <div key={group.race.id} style={{ borderBottom: "1px solid #EDECE6" }}>
                        <div onClick={() => openRace(group.race.id)} style={{ padding: "14px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{group.race.name}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(group.race)} · {group.race.distance} · {formatDate(group.race.date)}</div>
                          </div>
                          <span style={{ color: "#C4C3BB", fontSize: 16 }}>›</span>
                        </div>
                        <div style={{ paddingBottom: 10 }}>
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
          <div style={{ padding: "32px 0 40px" }}>
            <div onClick={goFeed} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 24 }}>← Tilbake</div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <Avatar p={selectedProfile} size={44} fontSize={16} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fullName(selectedProfile)}</div>
                  <div style={{ fontSize: 13, color: "#9B9B8E" }}>{selectedProfile.city}</div>
                </div>
              </div>
              {selectedProfile.id !== userId && !followingIds.includes(selectedProfile.id) && (
                <button onClick={() => toggleFollow(selectedProfile.id)} style={{ ...pillBtn(false, true), fontSize: 13, padding: "8px 20px" }}>Følg</button>
              )}
              {selectedProfile.id !== userId && followingIds.includes(selectedProfile.id) && (
                <span style={{ fontSize: 12, color: "#9B9B8E" }}>Følger</span>
              )}
              {selectedProfile.id === userId && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => { setShowAddRace(true); setManualMode(false); setSelectedExisting(null); setSearchQuery(""); }} style={{ fontSize: 13, fontWeight: 500, padding: "8px 20px", borderRadius: 20, border: "1px solid #2D5A3D", background: "#2D5A3D", color: "#fff", cursor: "pointer" }}>+ Legg til løp</button>
                  <span onClick={() => { navigator.clipboard.writeText(`https://startlista.no/${fullName(profile).toLowerCase().replace(/\s+/g, "-")}`); alert("Lenke kopiert!"); }} style={{ fontSize: 12, color: "#9B9B8E", cursor: "pointer", textDecoration: "underline" }}>Del profil</span>
                </div>
              )}
            </div>

            {/* Add race panel */}
            {showAddRace && selectedProfile.id === userId && (
              <div style={{ background: "#fff", border: "1px solid #E2E0D8", borderRadius: 12, padding: 20, marginBottom: 24 }}>
                {!manualMode && !selectedExisting && (
                  <>
                    <input type="text" placeholder="Søk etter løp..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputStyle} autoFocus />
                    {searchQuery.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {filteredRaces.length === 0 ? <div style={{ fontSize: 13, color: "#9B9B8E", padding: "8px 0" }}>Ingen treff</div> : (
                          filteredRaces.map((race) => {
                            const already = myEntries.some((e) => e.race_id === race.id);
                            return (
                              <div key={race.id} onClick={() => !already && setSelectedExisting(race)} style={{ padding: "10px 0", borderBottom: "1px solid #F0EFE9", cursor: already ? "default" : "pointer", opacity: already ? 0.4 : 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{race.name} {already && <span style={{ fontWeight: 400, fontSize: 11, color: "#9B9B8E" }}>(allerede lagt til)</span>}</div>
                                <div style={{ fontSize: 11, color: "#7A7A6E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => setManualMode(true)} style={pillBtn(false, false)}>Finner ikke løpet? Legg til manuelt</button>
                      <button onClick={() => { setShowAddRace(false); setSearchQuery(""); }} style={pillBtn(false, false)}>Avbryt</button>
                    </div>
                  </>
                )}
                {selectedExisting && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selectedExisting.name}</div>
                    <div style={{ fontSize: 12, color: "#7A7A6E", marginBottom: 12 }}>{raceLocation(selectedExisting)} · {selectedExisting.distance} · {formatDate(selectedExisting.date)}</div>
                    <label style={labelStyle}>Målsetning (valgfritt)</label>
                    <input type="text" placeholder="F.eks. Sub 3:30" value={goalForExisting} onChange={(e) => setGoalForExisting(e.target.value)} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={addExistingRace} style={{ ...pillBtn(false, true), fontSize: 13, padding: "8px 20px" }}>Legg til</button>
                      <button onClick={() => { setSelectedExisting(null); setGoalForExisting(""); }} style={pillBtn(false, false)}>Tilbake</button>
                    </div>
                  </>
                )}
                {manualMode && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Legg til nytt løp</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Løpsnavn *</label>
                        <input type="text" placeholder="F.eks. Valencia Marathon" value={newRace.name} onChange={(e) => setNewRace({ ...newRace, name: e.target.value })} style={inputStyle} />
                        {getSuggestions(newRace.name).length > 0 && (
                          <div style={{ background: "#FFFBEB", border: "1px solid #E8DFB0", borderRadius: 8, padding: "10px 12px", marginTop: 6 }}>
                            <div style={{ fontSize: 12, color: "#7A7A6E", marginBottom: 6 }}>Mente du?</div>
                            {getSuggestions(newRace.name).map((r) => (
                              <div key={r.id} onClick={() => { setManualMode(false); setSelectedExisting(r); setNewRace({ name: "", location: "", date: "", distance: "", country: "", goal: "" }); }} style={{ padding: "6px 0", cursor: "pointer", fontSize: 14 }}>
                                <span style={{ fontWeight: 600 }}>{r.name}</span>
                                <span style={{ fontSize: 12, color: "#9B9B8E" }}> — {raceLocation(r)} · {formatDate(r.date)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Sted *</label><input type="text" placeholder="By" value={newRace.location} onChange={(e) => setNewRace({ ...newRace, location: e.target.value })} style={inputStyle} /></div>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Land</label><input type="text" placeholder="Land" value={newRace.country} onChange={(e) => setNewRace({ ...newRace, country: e.target.value })} style={inputStyle} /></div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Dato *</label><input type="date" value={newRace.date} onChange={(e) => setNewRace({ ...newRace, date: e.target.value })} style={inputStyle} /></div>
                        <div style={{ flex: 1 }}><label style={labelStyle}>Distanse *</label><input type="text" placeholder="F.eks. 42.2 km" value={newRace.distance} onChange={(e) => setNewRace({ ...newRace, distance: e.target.value })} style={inputStyle} /></div>
                      </div>
                      <div><label style={labelStyle}>Målsetning (valgfritt)</label><input type="text" placeholder="F.eks. Sub 3:30" value={newRace.goal} onChange={(e) => setNewRace({ ...newRace, goal: e.target.value })} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={addManualRace} disabled={!newRace.name || !newRace.location || !newRace.date || !newRace.distance} style={{
                        ...pillBtn(false, true), fontSize: 13, padding: "8px 20px",
                        opacity: (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) ? 0.4 : 1,
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
              {entries.filter((e) => e.user_id === selectedProfile.id).length === 0 ? (
                <div style={{ fontSize: 13, color: "#9B9B8E" }}>Ingen planlagte løp ennå</div>
              ) : (
                <div>
                  {[...entries.filter((e) => e.user_id === selectedProfile.id)].sort((a, b) => {
                    const rA = races.find((r) => r.id === a.race_id);
                    const rB = races.find((r) => r.id === b.race_id);
                    if (!rA || !rB) return 0;
                    return rA.date.localeCompare(rB.date);
                  }).map((entry) => {
                    const race = races.find((r) => r.id === entry.race_id);
                    if (!race) return null;
                    const isMe = selectedProfile.id === userId;
                    return (
                      <div key={entry.id} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div onClick={() => openRace(race.id)} style={{ cursor: "pointer" }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div>
                            <div style={{ fontSize: 12, color: "#7A7A6E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {editingGoalEntryId !== entry.id && entry.goal && (
                              <span onClick={() => isMe && (setEditingGoalEntryId(entry.id), setEditGoalValue(entry.goal))} style={{ fontSize: 12, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "4px 10px", borderRadius: 12, cursor: isMe ? "pointer" : "default" }}>{entry.goal}</span>
                            )}
                            {editingGoalEntryId !== entry.id && !entry.goal && isMe && (
                              <span onClick={() => { setEditingGoalEntryId(entry.id); setEditGoalValue(""); }} style={{ fontSize: 11, color: "#C4C3BB", cursor: "pointer" }}>+ mål</span>
                            )}
                          </div>
                        </div>
                        {/* Edit goal inline */}
                        {editingGoalEntryId === entry.id && isMe && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                            <input type="text" placeholder="Målsetning (valgfritt)" value={editGoalValue} onChange={(e) => setEditGoalValue(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 13 }} autoFocus />
                            <button onClick={() => updateGoal(entry.id, editGoalValue)} style={{ ...pillBtn(false, true), padding: "4px 12px", fontSize: 11 }}>Lagre</button>
                            <button onClick={() => setEditingGoalEntryId(null)} style={{ ...pillBtn(false, false), padding: "4px 12px", fontSize: 11 }}>Avbryt</button>
                          </div>
                        )}
                        {/* Remove entry */}
                        {isMe && editingGoalEntryId !== entry.id && (
                          <div style={{ marginTop: 4 }}>
                            <span onClick={() => removeEntry(race.id)} style={{ fontSize: 11, color: "#C4C3BB", cursor: "pointer" }}>Fjern fra listen</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Following */}
            {selectedProfile.id === userId && followingIds.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <h2 style={sectionTitle}>Følger</h2>
                <div>
                  {profiles.filter((p) => followingIds.includes(p.id)).map((p) => (
                    <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar p={p} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{fullName(p)}</div>
                          <div style={{ fontSize: 12, color: "#7A7A6E" }}>{p.city}</div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleFollow(p.id); }} style={pillBtn(true, true)}>Følger</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings section - own profile only */}
            {selectedProfile.id === userId && (
              <div style={{ marginTop: 40 }}>
                <button onClick={() => setShowSettings(!showSettings)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  {showSettings ? "Skjul innstillinger" : "Innstillinger"}
                </button>

                {showSettings && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>

                    {settingsMessage && (
                      <div style={{ fontSize: 12, color: "#2D5A3D", background: "#EFF5F0", padding: "8px 12px", borderRadius: 8 }}>{settingsMessage}</div>
                    )}

                    {/* Edit city */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre by</div>
                      {!editingCity ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 14 }}>{profile.city}</span>
                          <button onClick={() => { setEditingCity(true); setEditCity(profile.city); }} style={{ ...pillBtn(false, false), padding: "4px 12px", fontSize: 11 }}>Endre</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                          <button onClick={updateCity} style={{ ...pillBtn(false, true), padding: "6px 14px" }}>Lagre</button>
                          <button onClick={() => setEditingCity(false)} style={{ ...pillBtn(false, false), padding: "6px 14px" }}>Avbryt</button>
                        </div>
                      )}
                    </div>

                    {/* Change password */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre passord</div>
                      {!changingPassword ? (
                        <button onClick={() => setChangingPassword(true)} style={{ ...pillBtn(false, false), padding: "4px 12px", fontSize: 11 }}>Endre passord</button>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="password" placeholder="Nytt passord (min. 6 tegn)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                          <button onClick={changePassword} style={{ ...pillBtn(false, true), padding: "6px 14px" }}>Lagre</button>
                          <button onClick={() => { setChangingPassword(false); setNewPassword(""); }} style={{ ...pillBtn(false, false), padding: "6px 14px" }}>Avbryt</button>
                        </div>
                      )}
                    </div>

                    {/* Delete account */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Slett konto</div>
                      {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 11, color: "#C53030", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline", padding: 0 }}>Slett kontoen min permanent</button>
                      ) : (
                        <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 8, padding: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#C53030", marginBottom: 8 }}>Er du sikker?</div>
                          <div style={{ fontSize: 12, color: "#7A7A6E", marginBottom: 12 }}>Alle dine data — profil, løp og følginger — slettes permanent. Dette kan ikke angres.</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={deleteAccount} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: "6px 16px", borderRadius: 20, border: "1px solid #C53030", background: "#C53030", color: "#fff", cursor: "pointer" }}>Ja, slett kontoen</button>
                            <button onClick={() => setShowDeleteConfirm(false)} style={pillBtn(false, false)}>Avbryt</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logout */}
                    <div style={{ paddingTop: 8 }}>
                      <button onClick={handleLogout} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Logg ut</button>
                    </div>
                  </div>
                )}

                {!showSettings && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={handleLogout} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Logg ut</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RACE DETAIL */}
        {view === "race" && selectedRace && (
          <div style={{ padding: "32px 0 40px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 24 }}>← Tilbake</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>{selectedRace.name}</h1>
            <div style={{ fontSize: 14, color: "#7A7A6E", marginBottom: selectedRace.user_created ? 8 : 32 }}>{raceLocation(selectedRace)} · {selectedRace.distance} · {formatDate(selectedRace.date)}</div>
            {selectedRace.user_created && <div style={{ fontSize: 11, color: "#C4C3BB", marginBottom: 32 }}>Lagt til av bruker — verifiser dato hos arrangør</div>}

            <h2 style={sectionTitle}>Påmeldte løpere</h2>
            {(() => {
              const raceEntries = entries.filter((e) => e.race_id === selectedRace.id);
              if (raceEntries.length === 0) return <div style={{ fontSize: 13, color: "#9B9B8E" }}>Ingen registrerte løpere ennå</div>;
              return (
                <div>
                  {raceEntries.map((entry) => {
                    const p = profiles.find((pr) => pr.id === entry.user_id);
                    if (!p) return null;
                    const isMe = p.id === userId;
                    return (
                      <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div onClick={() => openProfile(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar p={p} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{fullName(p)} {isMe && <span style={{ fontWeight: 400, color: "#9B9B8E" }}>(deg)</span>}</div>
                            <div style={{ fontSize: 12, color: "#7A7A6E" }}>{p.city}{entry.goal && ` · Mål: ${entry.goal}`}</div>
                          </div>
                        </div>
                        {!isMe && <span style={{ color: "#C4C3BB", fontSize: 16, cursor: "pointer" }} onClick={() => openProfile(p)}>›</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      <footer style={{ marginTop: 60, padding: "20px", textAlign: "center", fontSize: 11, color: "#C4C3BB" }}>
        <div>startlista · laget for løpere som vil finne hverandre</div>
        <div style={{ marginTop: 6 }}><a href="/personvern" style={{ color: "#C4C3BB", textDecoration: "underline" }}>Personvern</a></div>
      </footer>
    </div>
  );
}
