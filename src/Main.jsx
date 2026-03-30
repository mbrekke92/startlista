import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const mo = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];
  return d.getDate() + ". " + mo[d.getMonth()] + " " + d.getFullYear();
};

const getInitials = (first, last) => {
  return ((first || "")[0] || "").toUpperCase() + ((last || "")[0] || "").toUpperCase();
};

const COLORS = ["#2D5A3D","#8B4513","#4A5568","#6B3A5D","#2C5282","#744210"];
const colorFor = (id) => COLORS[id.charCodeAt(0) % COLORS.length];

const capitalize = (str) => {
  return str.split(" ").map((w) => {
    if (w.length === 0) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
};

const FYLKER = ["Agder","Innlandet","Møre og Romsdal","Nordland","Oslo","Rogaland","Troms","Trøndelag","Vestfold og Telemark","Vestland","Viken"];

const parseGoalSeconds = (goal) => {
  if (!goal) return null;
  const parts = goal.replace(/\s/g, "").split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1 && parts[0] > 0) return parts[0] * 60;
  return null;
};

const formatGoalTime = (h, m, s) => {
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
};

const getMatchTolerance = (dist) => {
  const d = (dist || "").toLowerCase();
  if (d.includes("42") || d.includes("maraton")) return 300;
  if (d.includes("21") || d.includes("halv")) return 300;
  return 120;
};

const getDistanceCategory = (dist) => {
  const d = (dist || "").toLowerCase();
  if (d.includes("42") || (d.includes("maraton") && !d.includes("halv"))) return "maraton";
  if (d.includes("21") || d.includes("halv")) return "halvmaraton";
  if (d.includes("10")) return "10 km";
  if (d.includes("5")) return "5 km";
  return null;
};

const daysUntil = (dateStr) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr + "T00:00:00") - now) / 86400000);
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

const getTempoGroups = (raceEntries, distance) => {
  const withGoals = raceEntries.map((e) => ({ ...e, secs: parseGoalSeconds(e.goal) })).filter((e) => e.secs);
  if (withGoals.length < 2) return [];
  const d = (distance || "").toLowerCase();
  var groups;
  if (d.includes("42") || d.includes("maraton")) {
    groups = [
      { label: "Sub 3:00", min: 0, max: 10800 },
      { label: "3:00–3:30", min: 10800, max: 12600 },
      { label: "3:30–4:00", min: 12600, max: 14400 },
      { label: "4:00–4:30", min: 14400, max: 16200 },
      { label: "4:30+", min: 16200, max: 99999 }
    ];
  } else if (d.includes("21") || d.includes("halv")) {
    groups = [
      { label: "Sub 1:30", min: 0, max: 5400 },
      { label: "1:30–1:45", min: 5400, max: 6300 },
      { label: "1:45–2:00", min: 6300, max: 7200 },
      { label: "2:00+", min: 7200, max: 99999 }
    ];
  } else {
    groups = [
      { label: "Sub 35", min: 0, max: 2100 },
      { label: "35–40", min: 2100, max: 2400 },
      { label: "40–45", min: 2400, max: 2700 },
      { label: "45–50", min: 2700, max: 3000 },
      { label: "50+", min: 3000, max: 99999 }
    ];
  }
  return groups.map((g) => ({ ...g, count: withGoals.filter((e) => e.secs >= g.min && e.secs < g.max).length })).filter((g) => g.count > 0);
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
  const [newRace, setNewRace] = useState({ name: "", location: "", date: "", distance: "", country: "" });
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
  const [editingResultId, setEditingResultId] = useState(null);
  const [resultH, setResultH] = useState(0);
  const [resultM, setResultM] = useState(0);
  const [resultS, setResultS] = useState(0);
  const carouselRef = useRef(null);
  const userId = session.user.id;

  useEffect(() => {
    const load = async () => {
      const [profileRes, profilesRes, racesRes, entriesRes, followsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*"),
        supabase.from("races").select("*").order("date"),
        supabase.from("entries").select("*"),
        supabase.from("follows").select("*").eq("follower_id", userId)
      ]);
      var p = profileRes.data;
      setProfile(p);
      setProfiles(profilesRes.data || []);
      setRaces(racesRes.data || []);
      setEntries(entriesRes.data || []);
      setFollows((followsRes.data || []).map(function(f) { return f.following_id; }));
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

  var fullName = function(p) { return p.first_name + " " + p.last_name; };
  var myEntries = entries.filter(function(e) { return e.user_id === userId; });
  var followingIds = follows;
  var today = new Date().toISOString().split("T")[0];
  var totalUsers = profiles.length;

  var nav = function(fn) { setFadeKey(function(k) { return k + 1; }); fn(); };
  var goalStr = function(h, m, s) { return (h === 0 && m === 0 && s === 0) ? "" : formatGoalTime(h, m, s); };
  var raceLocation = function(race) { return race.location + (race.country && race.country !== "Norge" ? ", " + race.country : ""); };

  var saveFylke = async function() {
    if (!selectedFylke) return;
    await supabase.from("profiles").update({ city: selectedFylke }).eq("id", userId);
    setProfile(function(prev) { return { ...prev, city: selectedFylke }; });
    setProfiles(function(prev) { return prev.map(function(p) { return p.id === userId ? { ...p, city: selectedFylke } : p; }); });
    setNeedsFylke(false);
  };

  var toggleFollow = async function(tid) {
    if (followingIds.includes(tid)) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", tid);
      setFollows(function(prev) { return prev.filter(function(id) { return id !== tid; }); });
    } else {
      await supabase.from("follows").insert({ follower_id: userId, following_id: tid });
      setFollows(function(prev) { return [...prev, tid]; });
    }
  };

  var addRaceToMyList = async function(raceId) {
    if (myEntries.some(function(e) { return e.race_id === raceId; })) return;
    var res = await supabase.from("entries").insert({ user_id: userId, race_id: raceId, goal: "", result: "" }).select().single();
    if (res.data) setEntries(function(prev) { return [...prev, res.data]; });
  };

  var addExistingRace = async function() {
    if (!selectedExisting || myEntries.some(function(e) { return e.race_id === selectedExisting.id; })) return;
    var goal = goalStr(goalForExisting.h, goalForExisting.m, goalForExisting.s);
    var res = await supabase.from("entries").insert({ user_id: userId, race_id: selectedExisting.id, goal: goal, result: "" }).select().single();
    if (res.data) setEntries(function(prev) { return [...prev, res.data]; });
    setShowAddRace(false);
    setSelectedExisting(null);
    setGoalForExisting({ h: 0, m: 0, s: 0 });
    setSearchQuery("");
  };

  var addManualRace = async function() {
    if (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) return;
    var goal = goalStr(newGoalH, newGoalM, newGoalS);
    var raceRes = await supabase.from("races").insert({
      name: capitalize(newRace.name), location: capitalize(newRace.location),
      date: newRace.date, distance: newRace.distance,
      country: newRace.country ? capitalize(newRace.country) : "", user_created: true
    }).select().single();
    if (raceRes.error) return;
    if (raceRes.data) {
      setRaces(function(prev) { return [...prev, raceRes.data]; });
      var entryRes = await supabase.from("entries").insert({ user_id: userId, race_id: raceRes.data.id, goal: goal, result: "" }).select().single();
      if (entryRes.data) setEntries(function(prev) { return [...prev, entryRes.data]; });
    }
    setShowAddRace(false);
    setManualMode(false);
    setNewRace({ name: "", location: "", date: "", distance: "", country: "" });
    setNewGoalH(0); setNewGoalM(0); setNewGoalS(0);
    setSearchQuery("");
  };

  var removeEntry = async function(raceId) {
    await supabase.from("entries").delete().eq("user_id", userId).eq("race_id", raceId);
    setEntries(function(prev) { return prev.filter(function(e) { return !(e.user_id === userId && e.race_id === raceId); }); });
  };

  var updateGoal = async function(entryId) {
    var goal = goalStr(editGoalH, editGoalM, editGoalS);
    await supabase.from("entries").update({ goal: goal }).eq("id", entryId);
    setEntries(function(prev) { return prev.map(function(e) { return e.id === entryId ? { ...e, goal: goal } : e; }); });
    setEditingGoalEntryId(null);
  };

  var startEditGoal = function(entry) {
    var secs = parseGoalSeconds(entry.goal);
    if (secs) { setEditGoalH(Math.floor(secs / 3600)); setEditGoalM(Math.floor((secs % 3600) / 60)); setEditGoalS(secs % 60); }
    else { setEditGoalH(0); setEditGoalM(0); setEditGoalS(0); }
    setEditingGoalEntryId(entry.id);
  };

  var updateResult = async function(entryId) {
    var result = goalStr(resultH, resultM, resultS);
    await supabase.from("entries").update({ result: result }).eq("id", entryId);
    setEntries(function(prev) { return prev.map(function(e) { return e.id === entryId ? { ...e, result: result } : e; }); });
    setEditingResultId(null);
  };

  var startEditResult = function(entry) {
    var secs = parseGoalSeconds(entry.result);
    if (secs) { setResultH(Math.floor(secs / 3600)); setResultM(Math.floor((secs % 3600) / 60)); setResultS(secs % 60); }
    else { setResultH(0); setResultM(0); setResultS(0); }
    setEditingResultId(entry.id);
  };

  var updateFylke = async function() {
    if (!editFylke) return;
    await supabase.from("profiles").update({ city: editFylke }).eq("id", userId);
    setProfile(function(prev) { return { ...prev, city: editFylke }; });
    setProfiles(function(prev) { return prev.map(function(p) { return p.id === userId ? { ...p, city: editFylke } : p; }); });
    setEditingFylke(false);
    setSettingsMessage("Fylke oppdatert");
    setTimeout(function() { setSettingsMessage(""); }, 2000);
  };

  var changePasswordFn = async function() {
    if (newPassword.length < 6) { setSettingsMessage("Minst 6 tegn"); return; }
    var res = await supabase.auth.updateUser({ password: newPassword });
    if (res.error) setSettingsMessage(res.error.message);
    else { setSettingsMessage("Passord endret"); setNewPassword(""); setChangingPassword(false); }
    setTimeout(function() { setSettingsMessage(""); }, 3000);
  };

  var deleteAccount = async function() { await supabase.rpc("delete_user"); await supabase.auth.signOut(); };
  var handleLogout = async function() { await supabase.auth.signOut(); };

  var openProfile = function(p) { nav(function() { setSelectedProfile(p); setView("profile"); setGlobalSearch(""); setShowSettings(false); }); };
  var openRace = function(raceId) { nav(function() { setSelectedRace(races.find(function(r) { return r.id === raceId; })); setView("race"); setGlobalSearch(""); setRaceSortByTime(false); }); };
  var goRaces = function() { nav(function() { setView("races"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); setShowAllRaces(false); }); };
  var goFeed = function() { nav(function() { setView("feed"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); }); };

  var filteredRaces = searchQuery.length > 0 ? races.filter(function(r) { return r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.location.toLowerCase().includes(searchQuery.toLowerCase()); }) : [];
  var getSuggestions = function(name) { if (!name || name.length < 4) return []; return races.filter(function(r) { return fuzzyMatch(name, r.name) && !myEntries.some(function(e) { return e.race_id === r.id; }); }).slice(0, 3); };
  var scrollCarousel = function(dir) { if (carouselRef.current) carouselRef.current.scrollBy({ left: dir * 280, behavior: "smooth" }); };

  var getRaceSuggestions = function() {
    var myRaceIds = myEntries.map(function(e) { return e.race_id; });
    return races.filter(function(r) { return r.date >= today && !myRaceIds.includes(r.id); }).map(function(race) {
      var re = entries.filter(function(e) { return e.race_id === race.id; });
      var ps = re.map(function(e) { return profiles.find(function(p) { return p.id === e.user_id; }); }).filter(Boolean);
      var fp = ps.filter(function(p) { return followingIds.includes(p.id); });
      var sap = ps.filter(function(p) { return p.city === profile.city && p.id !== userId; });
      var rdc = getDistanceCategory(race.distance);
      var mgfd = myEntries.map(function(e) { var r = races.find(function(r) { return r.id === e.race_id; }); return { dist: r ? getDistanceCategory(r.distance) : null, secs: parseGoalSeconds(e.goal) }; }).filter(function(g) { return g.secs && g.dist === rdc; });
      var sgc = 0;
      var tol = getMatchTolerance(race.distance);
      re.forEach(function(e) { if (e.user_id === userId) return; var ts = parseGoalSeconds(e.goal); if (!ts) return; mgfd.forEach(function(mg) { if (Math.abs(ts - mg.secs) <= tol) sgc++; }); });
      var score = fp.length * 3 + sap.length * 2 + sgc * 2 + ps.length * 0.1;
      if (score === 0 && ps.length === 0) return null;
      return { race: race, participants: ps, followingParticipants: fp, sameAreaParticipants: sap, sameGoalCount: sgc, sameGoalDist: rdc, score: score, total: ps.length };
    }).filter(Boolean).sort(function(a, b) { return b.score - a.score; }).slice(0, 5);
  };

  var getHeroRace = function() {
    // Priority 1: My own next race
    var myRaces = races.filter(function(r) { return r.date >= today && entries.some(function(e) { return e.race_id === r.id && e.user_id === userId; }); }).sort(function(a, b) {
      if (a.date === b.date) {
        var countA = entries.filter(function(e) { return e.race_id === a.id; }).length;
        var countB = entries.filter(function(e) { return e.race_id === b.id; }).length;
        return countB - countA;
      }
      return a.date.localeCompare(b.date);
    });
    // Priority 2: Next race where someone I follow is signed up
    var followingRaces = races.filter(function(r) { return r.date >= today && !myRaces.some(function(mr) { return mr.id === r.id; }) && entries.some(function(e) { return e.race_id === r.id && followingIds.includes(e.user_id); }); }).sort(function(a, b) {
      if (a.date === b.date) {
        var countA = entries.filter(function(e) { return e.race_id === a.id; }).length;
        var countB = entries.filter(function(e) { return e.race_id === b.id; }).length;
        return countB - countA;
      }
      return a.date.localeCompare(b.date);
    });
    var race = myRaces.length > 0 ? myRaces[0] : (followingRaces.length > 0 ? followingRaces[0] : null);
    if (!race) return null;
    var ps = entries.filter(function(e) { return e.race_id === race.id; }).map(function(e) { return profiles.find(function(p) { return p.id === e.user_id; }); }).filter(Boolean);
    var isOwn = myRaces.length > 0 && myRaces[0].id === race.id;
    return { race: race, participants: ps, days: daysUntil(race.date), isOwn: isOwn };
  };

  var getNextSharedRace = function() {
    var shared = [];
    races.filter(function(r) { return r.date >= today; }).forEach(function(race) {
      var re = entries.filter(function(e) { return e.race_id === race.id; });
      var meIn = re.some(function(e) { return e.user_id === userId; });
      var friends = re.filter(function(e) { return followingIds.includes(e.user_id); }).map(function(e) { return profiles.find(function(p) { return p.id === e.user_id; }); }).filter(Boolean);
      if (meIn && friends.length > 0) shared.push({ race: race, friends: friends, days: daysUntil(race.date) });
    });
    shared.sort(function(a, b) { return a.days - b.days; });
    return shared[0] || null;
  };

  var iS = { fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: "12px 14px", border: "1px solid #E2E0D8", borderRadius: 10, background: "#fff", color: "#1A1A1A", width: "100%", boxSizing: "border-box", outline: "none" };
  var lS = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#9B9B8E", marginBottom: 5, display: "block" };
  var sT = { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#C4C3BB", marginBottom: 16 };
  var pill = function(active, green) { return { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, padding: "7px 18px", borderRadius: 20, border: active ? "1px solid #E2E0D8" : "1px solid " + (green ? "#2D5A3D" : "#E2E0D8"), background: active ? "transparent" : (green ? "#2D5A3D" : "transparent"), color: active ? "#9B9B8E" : (green ? "#fff" : "#9B9B8E"), cursor: "pointer", whiteSpace: "nowrap" }; };
  var selS = { ...iS, appearance: "none", WebkitAppearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239B9B8E' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36 };

  var Av = function({ p, size, fontSize: fs }) {
    size = size || 36; fs = fs || 13;
    return <div style={{ width: size, height: size, borderRadius: "50%", background: colorFor(p.id), color: "#fff", fontSize: fs, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{getInitials(p.first_name, p.last_name)}</div>;
  };

  var AvStack = function({ participants, max }) {
    max = max || 3;
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        {participants.slice(0, max).map(function(p, i) {
          return <div key={p.id} style={{ width: 26, height: 26, borderRadius: "50%", background: colorFor(p.id), color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -8 : 0, border: "2px solid #FAFAF7", fontFamily: "'DM Sans', sans-serif" }}>{getInitials(p.first_name, p.last_name)}</div>;
        })}
        {participants.length > max && <span style={{ fontSize: 11, fontWeight: 500, color: "#C4C3BB", marginLeft: 4 }}>+{participants.length - max}</span>}
      </div>
    );
  };

  var TP = function({ h, m, s, onH, onM, onS, label }) {
    label = label || "Målsetning (valgfritt)";
    return (
      <div>
        <label style={lS}>{label}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><select value={h} onChange={function(e) { onH(Number(e.target.value)); }} style={{ ...selS, padding: "10px 12px" }}>{Array.from({ length: 7 }, function(_, i) { return <option key={i} value={i}>{i} t</option>; })}</select></div>
          <div style={{ flex: 1 }}><select value={m} onChange={function(e) { onM(Number(e.target.value)); }} style={{ ...selS, padding: "10px 12px" }}>{Array.from({ length: 60 }, function(_, i) { return <option key={i} value={i}>{String(i).padStart(2, "0")} min</option>; })}</select></div>
          <div style={{ flex: 1 }}><select value={s} onChange={function(e) { onS(Number(e.target.value)); }} style={{ ...selS, padding: "10px 12px" }}>{Array.from({ length: 60 }, function(_, i) { return <option key={i} value={i}>{String(i).padStart(2, "0")} sek</option>; })}</select></div>
        </div>
      </div>
    );
  };

  var ShareRace = function({ race }) {
    return <span onClick={function() { var url = "https://startlista.no"; var text = "Skal du løpe " + race.name + "? Se hvem som er påmeldt og har samme målsetning som deg på startlista.no"; if (navigator.share) { navigator.share({ title: race.name, text: text, url: url }); } else { navigator.clipboard.writeText(text); alert("Tekst kopiert!"); } }} style={{ fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Del løpet →</span>;
  };

  var SearchDropdown = function({ search, setSearch, onProfile, onRace }) {
    if (search.length === 0) return null;
    var q = search.toLowerCase();
    var mu = profiles.filter(function(p) { return fullName(p).toLowerCase().includes(q) || p.city.toLowerCase().includes(q); });
    var mr = races.filter(function(r) { return r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q); });
    if (!mu.length && !mr.length) {
      return (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, padding: 14, zIndex: 50, marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, color: "#9B9B8E", marginBottom: 8 }}>Ingen treff</div>
          <div onClick={function() { setSearch(""); openProfile(profile); setTimeout(function() { setShowAddRace(true); setManualMode(true); }, 100); }} style={{ fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Finner ikke løpet? Legg til manuelt →</div>
        </div>
      );
    }
    return (
      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E0D8", borderRadius: 10, zIndex: 50, marginTop: 4, maxHeight: 340, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
        {mu.length > 0 && <div>
          <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løpere</div>
          {mu.map(function(p) { return <div key={p.id} onClick={function() { onProfile(p); setSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #F0EFE9" }}><Av p={p} size={28} fontSize={10} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>{fullName(p)}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{p.city}</div></div></div>; })}
        </div>}
        {mr.length > 0 && <div>
          <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#C4C3BB" }}>Løp</div>
          {mr.map(function(race) { return <div key={race.id} onClick={function() { onRace(race.id); setSearch(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F0EFE9" }}><div style={{ fontWeight: 600, fontSize: 14 }}>{race.name}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>; })}
        </div>}
        <div onClick={function() { setSearch(""); openProfile(profile); setTimeout(function() { setShowAddRace(true); setManualMode(true); }, 100); }} style={{ padding: "10px 14px", borderTop: "1px solid #F0EFE9", fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Finner ikke løpet? Legg til manuelt →</div>
      </div>
    );
  };

  // Fylke prompt
  if (needsFylke) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 380, width: "100%", padding: "0 20px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#2D5A3D", marginBottom: 8 }}>startlista</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Velg fylke</div>
          <div style={{ fontSize: 14, color: "#9B9B8E", lineHeight: 1.5, marginBottom: 24 }}>Vi har oppdatert profilen. Velg fylket ditt for å finne løpere i ditt område.</div>
          <select value={selectedFylke} onChange={function(e) { setSelectedFylke(e.target.value); }} style={{ ...selS, marginBottom: 16 }}><option value="">Velg fylke</option>{FYLKER.map(function(f) { return <option key={f} value={f}>{f}</option>; })}</select>
          <button onClick={saveFylke} disabled={!selectedFylke} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "12px", borderRadius: 8, border: "none", background: "#2D5A3D", color: "#fff", cursor: selectedFylke ? "pointer" : "default", opacity: selectedFylke ? 1 : 0.4, width: "100%" }}>Lagre</button>
        </div>
      </div>
    );
  }

  var hero = getHeroRace();
  var nextShared = getNextSharedRace();

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "'DM Sans', sans-serif", color: "#1A1A1A" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,250,247,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(226,224,216,0.6)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div onClick={goRaces} style={{ cursor: "pointer" }}><span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px", color: "#2D5A3D" }}>startlista</span></div>
          <div style={{ display: "flex", gap: 18 }}>
            {[{ label: "Løp", v: "races", action: goRaces }, { label: "Oversikt", v: "feed", action: goFeed }, { label: "Min profil", v: "myprofile", action: function() { openProfile(profile); } }].map(function(tab) {
              var isA = view === tab.v || (tab.v === "myprofile" && view === "profile" && selectedProfile && selectedProfile.id === userId);
              return <span key={tab.v} onClick={tab.action} style={{ fontSize: 13, cursor: "pointer", color: isA ? "#2D5A3D" : "#9B9B8E", fontWeight: isA ? 600 : 500 }}>{tab.label}</span>;
            })}
          </div>
        </div>
      </header>

      <main key={fadeKey} style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px", animation: "fadeIn 0.35s ease" }}>
        <style>{"@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}"}</style>

        {/* ═══ LØP ═══ */}
        {view === "races" && (
          <div style={{ padding: "24px 0 60px" }}>
            <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.8px", marginBottom: 8 }}>Velkommen til startlista</div>
              <div style={{ fontSize: 15, color: "#9B9B8E", lineHeight: 1.5 }}>Din og dine løpevenners terminliste.</div>
              <div style={{ fontSize: 12, color: "#C4C3BB", marginTop: 8 }}>{totalUsers} løpere registrert</div>
            </div>

            <div style={{ position: "relative", marginBottom: 28 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={function(e) { setGlobalSearch(e.target.value); }} style={iS} />
              <SearchDropdown search={globalSearch} setSearch={setGlobalSearch} onProfile={openProfile} onRace={openRace} />
            </div>

            {/* Hero */}
            {hero && (function() {
              var totalCount = entries.filter(function(e) { return e.race_id === hero.race.id; }).length;
              var followingPs = hero.participants.filter(function(p) { return followingIds.includes(p.id) || p.id === userId; });
              return (
              <div onClick={function() { openRace(hero.race.id); }} style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #2D5A3D 100%)", borderRadius: 16, padding: "28px 24px", marginBottom: 28, cursor: "pointer", color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{hero.isOwn ? "Neste løp" : "Neste løp fra de du følger"}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>{hero.race.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px" }}>{hero.days}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{hero.days === 1 ? "dag" : "dager"}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>{raceLocation(hero.race)} · {hero.race.distance} · {formatDate(hero.race.date)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex" }}>{followingPs.slice(0, 5).map(function(p, i) { return <div key={p.id} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -8 : 0, border: "2px solid rgba(26,26,26,0.5)" }}>{getInitials(p.first_name, p.last_name)}</div>; })}</div>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{totalCount} påmeldt{followingPs.length > 0 ? " · " + followingPs.length + " du følger" : ""}</span>
                </div>
              </div>
              );
            })()}

            {/* Following races */}
            {(function() {
              var relevant = races.filter(function(r) { return r.date >= today && entries.some(function(e) { return e.race_id === r.id && (e.user_id === userId || followingIds.includes(e.user_id)); }); }).filter(function(r) { return !hero || r.id !== hero.race.id; });
              var visible = showAllRaces ? relevant : relevant.slice(0, 10);
              if (!relevant.length) return null;
              return (
                <div>
                  <h2 style={sT}>Løp fra de du følger</h2>
                  <div>{visible.map(function(race) {
                    var ps = entries.filter(function(e) { return e.race_id === race.id && (e.user_id === userId || followingIds.includes(e.user_id)); }).map(function(e) { return profiles.find(function(p) { return p.id === e.user_id; }); }).filter(Boolean);
                    return (
                      <div key={race.id} onClick={function() { openRace(race.id); }} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{race.name}</div><div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{ps.length > 0 && <AvStack participants={ps} />}<span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span></div>
                      </div>
                    );
                  })}</div>
                  {relevant.length > 10 && !showAllRaces && <div style={{ textAlign: "center", paddingTop: 12 }}><button onClick={function() { setShowAllRaces(true); }} style={{ ...pill(false, false), fontSize: 13 }}>Se alle løp ({relevant.length})</button></div>}
                </div>
              );
            })()}

            {/* Carousel */}
            {(function() {
              var sug = getRaceSuggestions();
              if (!sug.length) return null;
              return (
                <div style={{ marginTop: 40 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>Forslag til løp</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={function() { scrollCarousel(-1); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #E2E0D8", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#9B9B8E" }}>‹</button>
                      <button onClick={function() { scrollCarousel(1); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #E2E0D8", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#9B9B8E" }}>›</button>
                    </div>
                  </div>
                  <div ref={carouselRef} style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", paddingBottom: 8 }}>
                    {sug.map(function(s) {
                      return (
                        <div key={s.race.id} onClick={function() { openRace(s.race.id); }} style={{ minWidth: 260, maxWidth: 260, scrollSnapAlign: "start", cursor: "pointer", background: "#fff", borderRadius: 16, border: "1px solid #EDECE6", padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                          <div style={{ fontSize: 11, color: "#9B9B8E", marginBottom: 6 }}>{s.total} løpere registrert</div>
                          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12 }}>{s.race.name}</div>
                          <div style={{ fontSize: 11, color: "#7A7A6E", marginBottom: 14 }}>{raceLocation(s.race)} · {formatDate(s.race.date)}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                            {s.followingParticipants.length > 0 && <div style={{ fontSize: 12, color: "#5A5A52" }}>{s.followingParticipants.length} du følger skal løpe</div>}
                            {s.sameAreaParticipants.length > 0 && <div style={{ fontSize: 12, color: "#5A5A52" }}>{s.sameAreaParticipants.length} {s.sameAreaParticipants.length === 1 ? "løper" : "løpere"} fra {profile.city}</div>}
                            {s.sameGoalCount > 0 && <div style={{ fontSize: 12, color: "#5A5A52" }}>{s.sameGoalCount} med samme tidsmål{s.sameGoalDist ? " på " + s.sameGoalDist : ""}</div>}
                          </div>
                          {s.participants.length > 0 && <AvStack participants={s.participants} max={5} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Populært nå */}
            {(function() {
              var upcomingRaces = races.filter(function(r) { return r.date >= today; });
              var ranked = upcomingRaces.map(function(race) {
                var total = entries.filter(function(e) { return e.race_id === race.id; }).length;
                return { race: race, total: total };
              }).filter(function(r) { return r.total >= 2; }).sort(function(a, b) { return b.total - a.total; }).slice(0, 3);
              if (!ranked.length) return null;
              return (
                <div style={{ marginTop: 40 }}>
                  <h2 style={sT}>Populært nå</h2>
                  {ranked.map(function(item, i) {
                    return (
                      <div key={item.race.id} onClick={function() { openRace(item.race.id); }} style={{ padding: "14px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: i === 0 ? "#9A7B4F" : i === 1 ? "#6B7280" : "#8B6914", color: "#fff", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.2px" }}>{item.race.name}</div>
                            <div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(item.race)} · {formatDate(item.race.date)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#2D5A3D" }}>{item.total}</div>
                          <div style={{ fontSize: 10, color: "#9B9B8E" }}>påmeldt</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Upcoming */}
            {(function() {
              var myIds = entries.filter(function(e) { return e.user_id === userId || followingIds.includes(e.user_id); }).map(function(e) { return e.race_id; });
              var other = races.filter(function(r) { return r.date >= today && !myIds.includes(r.id); }).slice(0, 6);
              if (!other.length) return null;
              return (
                <div style={{ marginTop: 40 }}>
                  <h2 style={sT}>Kommende løp</h2>
                  {other.map(function(race) {
                    var ps = entries.filter(function(e) { return e.race_id === race.id && (e.user_id === userId || followingIds.includes(e.user_id)); }).map(function(e) { return profiles.find(function(p) { return p.id === e.user_id; }); }).filter(Boolean);
                    return (
                      <div key={race.id} onClick={function() { openRace(race.id); }} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div><div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{ps.length > 0 && <AvStack participants={ps} />}<span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span></div>
                      </div>
                    );
                  })}
                  <div style={{ textAlign: "center", paddingTop: 12 }}><span style={{ fontSize: 12, color: "#C4C3BB" }}>Bruk søkefeltet for å finne flere løp</span></div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ OVERSIKT ═══ */}
        {view === "feed" && (
          <div style={{ padding: "24px 0 60px" }}>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={function(e) { setGlobalSearch(e.target.value); }} style={iS} />
              <SearchDropdown search={globalSearch} setSearch={setGlobalSearch} onProfile={openProfile} onRace={openRace} />
            </div>

            {nextShared && (
              <div onClick={function() { openRace(nextShared.race.id); }} style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #2D5A3D 100%)", borderRadius: 16, padding: "24px 22px", marginBottom: 24, cursor: "pointer", color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Om {nextShared.days} {nextShared.days === 1 ? "dag" : "dager"} løper du og {nextShared.friends[0] ? fullName(nextShared.friends[0]) : ""}{nextShared.friends.length > 1 ? " +" + (nextShared.friends.length - 1) : ""}</div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>{nextShared.race.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{raceLocation(nextShared.race)} · {nextShared.race.distance}</div>
              </div>
            )}

            {(function() {
              var rg = {};
              entries.forEach(function(entry) {
                var p = profiles.find(function(pr) { return pr.id === entry.user_id; });
                var race = races.find(function(r) { return r.id === entry.race_id; });
                if (p && race && race.date >= today && (followingIds.includes(p.id) || p.id === userId)) {
                  if (!rg[race.id]) rg[race.id] = { race: race, runners: [] };
                  rg[race.id].runners.push({ profile: p, goal: entry.goal });
                }
              });
              var grouped = Object.values(rg).sort(function(a, b) { return a.race.date.localeCompare(b.race.date); });
              if (!grouped.length) return <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 15, color: "#C4C3BB", lineHeight: 1.6 }}>Følg løpere for å se deres planer her,<br />eller legg til egne løp fra Min profil.</div></div>;
              return (
                <div>
                  <h2 style={sT}>Oversikt</h2>
                  {grouped.map(function(group) {
                    return (
                      <div key={group.race.id} style={{ borderBottom: "1px solid #EDECE6" }}>
                        <div onClick={function() { openRace(group.race.id); }} style={{ padding: "16px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{group.race.name}</div><div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(group.race)} · {group.race.distance} · {formatDate(group.race.date)}</div></div>
                          <span style={{ color: "#D4D3CC", fontSize: 16 }}>›</span>
                        </div>
                        <div style={{ paddingBottom: 12 }}>{group.runners.map(function(r) {
                          return <div key={r.profile.id} style={{ padding: "5px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span onClick={function() { openProfile(r.profile); }} style={{ fontSize: 13, color: "#5A5A52", cursor: "pointer" }}>{fullName(r.profile)}</span>{r.goal && <span style={{ fontSize: 11, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "2px 8px", borderRadius: 10 }}>{r.goal}</span>}</div>;
                        })}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {view === "profile" && selectedProfile && (
          <div style={{ padding: "36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 28, fontWeight: 500 }}>← Tilbake</div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <Av p={selectedProfile} size={52} fontSize={18} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>{fullName(selectedProfile)}</div>
                  <div style={{ fontSize: 13, color: "#9B9B8E", marginTop: 2 }}>{selectedProfile.city}</div>
                </div>
              </div>

              {/* Stats boxes */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <div style={{ flex: 1, background: "#fff", border: "1px solid #EDECE6", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#2D5A3D", letterSpacing: "-0.5px" }}>{entries.filter(function(e) { return e.user_id === selectedProfile.id && races.find(function(r) { return r.id === e.race_id; }) && races.find(function(r) { return r.id === e.race_id; }).date >= today; }).length}</div>
                  <div style={{ fontSize: 11, color: "#9B9B8E", marginTop: 2 }}>planlagte</div>
                </div>
                <div style={{ flex: 1, background: "#fff", border: "1px solid #EDECE6", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.5px" }}>{entries.filter(function(e) { return e.user_id === selectedProfile.id && races.find(function(r) { return r.id === e.race_id; }) && races.find(function(r) { return r.id === e.race_id; }).date < today; }).length}</div>
                  <div style={{ fontSize: 11, color: "#9B9B8E", marginTop: 2 }}>gjennomført</div>
                </div>
              </div>

              {selectedProfile.id !== userId && !followingIds.includes(selectedProfile.id) && <button onClick={function() { toggleFollow(selectedProfile.id); }} style={{ ...pill(false, true), fontSize: 13, padding: "9px 24px" }}>Følg</button>}
              {selectedProfile.id !== userId && followingIds.includes(selectedProfile.id) && <span style={{ fontSize: 12, color: "#9B9B8E" }}>Følger</span>}
              {selectedProfile.id === userId && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={function() { setShowAddRace(true); setManualMode(false); setSelectedExisting(null); setSearchQuery(""); }} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til løp</button>
                  <span onClick={function() { var url = "https://startlista.no"; var text = "Sjekk startlista.no — se hvem som skal løpe samme løp som deg, og finn noen med samme målsetning."; if (navigator.share) { navigator.share({ title: "startlista", text: text, url: url }); } else { navigator.clipboard.writeText(text + " " + url); alert("Tekst kopiert!"); } }} style={{ fontSize: 12, color: "#2D5A3D", cursor: "pointer", fontWeight: 500 }}>Inviter en løpevenn →</span>
                </div>
              )}
            </div>

            {/* Countdown */}
            {(function() {
              var myUpcoming = entries.filter(function(e) { return e.user_id === selectedProfile.id; }).filter(function(e) { var r = races.find(function(r) { return r.id === e.race_id; }); return r && r.date >= today; }).sort(function(a, b) { var ra = races.find(function(r) { return r.id === a.race_id; }); var rb = races.find(function(r) { return r.id === b.race_id; }); return ra.date.localeCompare(rb.date); });
              if (!myUpcoming.length) return null;
              var entry = myUpcoming[0];
              var race = races.find(function(r) { return r.id === entry.race_id; });
              var days = daysUntil(race.date);
              return (
                <div onClick={function() { openRace(race.id); }} style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #2D5A3D 100%)", borderRadius: 16, padding: "24px", marginBottom: 24, cursor: "pointer", color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Neste løp</div>
                      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>{race.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{raceLocation(race)} · {race.distance}</div>
                      {entry.goal && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Mål: {entry.goal}</div>}
                    </div>
                    <div style={{ textAlign: "right", marginLeft: 16 }}>
                      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1 }}>{days}</div>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{days === 1 ? "dag" : "dager"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Season timeline */}
            {(function() {
              var profileEntries = entries.filter(function(e) { return e.user_id === selectedProfile.id; });
              var raceData = profileEntries.map(function(e) {
                var r = races.find(function(r) { return r.id === e.race_id; });
                if (!r) return null;
                var d = new Date(r.date + "T00:00:00");
                return { race: r, entry: e, month: d.getMonth(), day: d.getDate(), past: r.date < today, yearPos: (d.getMonth() * 30 + d.getDate()) / 365 };
              }).filter(Boolean);
              if (raceData.length < 1) return null;

              var currentPos = (function() { var now = new Date(); return (now.getMonth() * 30 + now.getDate()) / 365; })();
              var months = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];

              return (
                <div style={{ marginBottom: 28, background: "#1A1A1A", borderRadius: 16, padding: "22px 22px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 18 }}>Sesong {new Date().getFullYear()}</div>

                  <div style={{ position: "relative", height: 36, marginBottom: 12 }}>
                    <div style={{ position: "absolute", top: 16, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }} />
                    <div style={{ position: "absolute", top: 16, left: 0, width: (currentPos * 100) + "%", height: 3, background: "linear-gradient(90deg, rgba(255,255,255,0.2), #2D5A3D)", borderRadius: 2 }} />
                    <div style={{ position: "absolute", top: 10, left: (currentPos * 100) + "%", transform: "translateX(-50%)" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#2D5A3D", border: "2px solid #1A1A1A", boxShadow: "0 0 8px rgba(45,90,61,0.6), 0 0 0 2px #2D5A3D" }} />
                    </div>
                    {raceData.map(function(rd) {
                      return (
                        <div key={rd.race.id} style={{ position: "absolute", top: rd.past ? 22 : 2, left: (rd.yearPos * 100) + "%", transform: "translateX(-50%)" }}>
                          <div style={{ width: 4, height: 12, borderRadius: 2, background: rd.past ? "rgba(255,255,255,0.25)" : "#4ADE80" }} />
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    {raceData.sort(function(a, b) { return a.yearPos - b.yearPos; }).map(function(rd) {
                      return (
                        <div key={rd.race.id} onClick={function() { openRace(rd.race.id); }} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: rd.past ? "rgba(255,255,255,0.25)" : "#4ADE80", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: rd.past ? "rgba(255,255,255,0.4)" : "#fff" }}>{rd.race.name}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{rd.race.date.split("-")[2]}. {months[rd.month]}</span>
                          {rd.entry.result && (rd.entry.result === "DNS" || rd.entry.result === "DNF" ? <span style={{ fontSize: 10, fontWeight: 600, color: "#ff6b6b", background: "rgba(255,107,107,0.15)", padding: "2px 8px", borderRadius: 6, marginLeft: "auto" }}>{rd.entry.result}</span> : <span style={{ fontSize: 10, fontWeight: 600, color: "#4ADE80", background: "rgba(74,222,128,0.15)", padding: "2px 8px", borderRadius: 6, marginLeft: "auto" }}>{rd.entry.result}</span>)}
                          {!rd.entry.result && rd.entry.goal && !rd.past && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>Mål: {rd.entry.goal}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Add race panel */}
            {showAddRace && selectedProfile.id === userId && (
              <div style={{ background: "#fff", border: "1px solid #E2E0D8", borderRadius: 14, padding: 22, marginBottom: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
                {!manualMode && !selectedExisting && (
                  <div>
                    <input type="text" placeholder="Søk etter løp..." value={searchQuery} onChange={function(e) { setSearchQuery(e.target.value); }} style={iS} autoFocus />
                    {searchQuery.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {filteredRaces.length === 0 ? <div style={{ fontSize: 13, color: "#C4C3BB", padding: "8px 0" }}>Ingen treff</div> : filteredRaces.map(function(race) {
                          var already = myEntries.some(function(e) { return e.race_id === race.id; });
                          return <div key={race.id} onClick={function() { if (!already) setSelectedExisting(race); }} style={{ padding: "12px 0", borderBottom: "1px solid #F0EFE9", cursor: already ? "default" : "pointer", opacity: already ? 0.35 : 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{race.name} {already && <span style={{ fontWeight: 400, fontSize: 11, color: "#C4C3BB" }}>(allerede lagt til)</span>}</div><div style={{ fontSize: 11, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>;
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={function() { setManualMode(true); }} style={pill(false, false)}>Finner ikke løpet? Legg til manuelt</button>
                      <button onClick={function() { setShowAddRace(false); setSearchQuery(""); }} style={pill(false, false)}>Avbryt</button>
                    </div>
                  </div>
                )}
                {selectedExisting && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selectedExisting.name}</div>
                    <div style={{ fontSize: 12, color: "#9B9B8E", marginBottom: 14 }}>{raceLocation(selectedExisting)} · {selectedExisting.distance} · {formatDate(selectedExisting.date)}</div>
                    <TP h={goalForExisting.h} m={goalForExisting.m} s={goalForExisting.s} onH={function(v) { setGoalForExisting({ ...goalForExisting, h: v }); }} onM={function(v) { setGoalForExisting({ ...goalForExisting, m: v }); }} onS={function(v) { setGoalForExisting({ ...goalForExisting, s: v }); }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={addExistingRace} style={{ ...pill(false, true), fontSize: 13, padding: "9px 24px" }}>Legg til</button>
                      <button onClick={function() { setSelectedExisting(null); setGoalForExisting({ h: 0, m: 0, s: 0 }); }} style={pill(false, false)}>Tilbake</button>
                    </div>
                  </div>
                )}
                {manualMode && (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Legg til nytt løp</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={lS}>Løpsnavn *</label>
                        <input type="text" placeholder="F.eks. Valencia Marathon" value={newRace.name} onChange={function(e) { setNewRace({ ...newRace, name: e.target.value }); }} style={iS} />
                        {getSuggestions(newRace.name).length > 0 && (
                          <div style={{ background: "#FFFBEB", border: "1px solid #E8DFB0", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: "#9B9B8E", marginBottom: 6 }}>Mente du?</div>
                            {getSuggestions(newRace.name).map(function(r) { return <div key={r.id} onClick={function() { setManualMode(false); setSelectedExisting(r); setNewRace({ name: "", location: "", date: "", distance: "", country: "" }); }} style={{ padding: "6px 0", cursor: "pointer", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{r.name}</span><span style={{ fontSize: 12, color: "#9B9B8E" }}> — {raceLocation(r)} · {formatDate(r.date)}</span></div>; })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}><label style={lS}>Sted *</label><input type="text" placeholder="By" value={newRace.location} onChange={function(e) { setNewRace({ ...newRace, location: e.target.value }); }} style={iS} /></div>
                        <div style={{ flex: 1 }}><label style={lS}>Land</label><input type="text" placeholder="Land" value={newRace.country} onChange={function(e) { setNewRace({ ...newRace, country: e.target.value }); }} style={iS} /></div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}><label style={lS}>Dato *</label><input type="date" value={newRace.date} onChange={function(e) { setNewRace({ ...newRace, date: e.target.value }); }} style={iS} /></div>
                        <div style={{ flex: 1 }}>
                          <label style={lS}>Distanse *</label>
                          <select value={["5 km", "10 km", "21.0975 km", "42.195 km"].includes(newRace.distance) ? newRace.distance : "annet"} onChange={function(e) { if (e.target.value === "annet") setNewRace({ ...newRace, distance: "" }); else setNewRace({ ...newRace, distance: e.target.value }); }} style={selS}>
                            <option value="annet">Annen distanse</option>
                            <option value="5 km">5 km</option>
                            <option value="10 km">10 km</option>
                            <option value="21.0975 km">Halvmaraton</option>
                            <option value="42.195 km">Maraton</option>
                          </select>
                          {!["5 km", "10 km", "21.0975 km", "42.195 km"].includes(newRace.distance) && <input type="text" placeholder="F.eks. 15 km" value={newRace.distance} onChange={function(e) { setNewRace({ ...newRace, distance: e.target.value }); }} style={{ ...iS, marginTop: 8 }} autoFocus />}
                        </div>
                      </div>
                      <TP h={newGoalH} m={newGoalM} s={newGoalS} onH={setNewGoalH} onM={setNewGoalM} onS={setNewGoalS} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                      <button onClick={addManualRace} disabled={!newRace.name || !newRace.location || !newRace.date || !newRace.distance} style={{ ...pill(false, true), fontSize: 13, padding: "9px 24px", opacity: (!newRace.name || !newRace.location || !newRace.date || !newRace.distance) ? 0.35 : 1 }}>Opprett og legg til</button>
                      <button onClick={function() { setManualMode(false); setNewRace({ name: "", location: "", date: "", distance: "", country: "" }); setNewGoalH(0); setNewGoalM(0); setNewGoalS(0); }} style={pill(false, false)}>Tilbake</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Planned races */}
            <div>
              <h2 style={sT}>Planlagte løp</h2>
              {(function() {
                var planned = entries.filter(function(e) { return e.user_id === selectedProfile.id; }).filter(function(e) { var r = races.find(function(r) { return r.id === e.race_id; }); return r && r.date >= today; }).sort(function(a, b) { var ra = races.find(function(r) { return r.id === a.race_id; }); var rb = races.find(function(r) { return r.id === b.race_id; }); return ra.date.localeCompare(rb.date); });
                if (!planned.length) return <div style={{ fontSize: 13, color: "#C4C3BB" }}>Ingen planlagte løp ennå</div>;
                var isMe = selectedProfile.id === userId;
                return planned.map(function(entry) {
                  var race = races.find(function(r) { return r.id === entry.race_id; });
                  if (!race) return null;
                  return (
                    <div key={entry.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div onClick={function() { openRace(race.id); }} style={{ cursor: "pointer" }}>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, letterSpacing: "-0.2px" }}>{race.name}</div>
                          <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {editingGoalEntryId !== entry.id && entry.goal && <span onClick={function() { if (isMe) startEditGoal(entry); }} style={{ fontSize: 12, fontWeight: 500, color: "#2D5A3D", background: "#EFF5F0", padding: "4px 10px", borderRadius: 12, cursor: isMe ? "pointer" : "default" }}>{entry.goal}</span>}
                          {editingGoalEntryId !== entry.id && !entry.goal && isMe && <span onClick={function() { startEditGoal(entry); }} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>+ mål</span>}
                        </div>
                      </div>
                      {editingGoalEntryId === entry.id && isMe && (
                        <div style={{ marginTop: 10 }}>
                          <TP h={editGoalH} m={editGoalM} s={editGoalS} onH={setEditGoalH} onM={setEditGoalM} onS={setEditGoalS} label="Endre målsetning" />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button onClick={function() { updateGoal(entry.id); }} style={{ ...pill(false, true), padding: "5px 14px", fontSize: 11 }}>Lagre</button>
                            <button onClick={function() { setEditingGoalEntryId(null); }} style={{ ...pill(false, false), padding: "5px 14px", fontSize: 11 }}>Avbryt</button>
                          </div>
                        </div>
                      )}
                      {isMe && editingGoalEntryId !== entry.id && <div style={{ marginTop: 6 }}><span onClick={function() { removeEntry(race.id); }} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>Fjern fra listen</span></div>}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Completed with results */}
            {(function() {
              var completed = entries.filter(function(e) { return e.user_id === selectedProfile.id; }).filter(function(e) { var r = races.find(function(r) { return r.id === e.race_id; }); return r && r.date < today; }).sort(function(a, b) { var ra = races.find(function(r) { return r.id === a.race_id; }); var rb = races.find(function(r) { return r.id === b.race_id; }); return rb.date.localeCompare(ra.date); });
              if (!completed.length) return null;
              var isMe = selectedProfile.id === userId;
              return (
                <div style={{ marginTop: 36 }}>
                  <h2 style={sT}>Gjennomført</h2>
                  {completed.map(function(entry) {
                    var race = races.find(function(r) { return r.id === entry.race_id; });
                    if (!race) return null;
                    return (
                      <div key={entry.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div onClick={function() { openRace(race.id); }} style={{ cursor: "pointer" }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{race.name}</div>
                            <div style={{ fontSize: 12, color: "#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {editingResultId !== entry.id && entry.result && (entry.result === "DNS" || entry.result === "DNF" ? <span style={{ fontSize: 12, fontWeight: 600, color: "#C53030", background: "#FFF5F5", padding: "4px 12px", borderRadius: 12 }}>{entry.result}</span> : <span style={{ fontSize: 13, fontWeight: 600, color: "#2D5A3D", background: "#EFF5F0", padding: "4px 12px", borderRadius: 12 }}>{entry.result}</span>)}
                            {editingResultId !== entry.id && !entry.result && isMe && <span onClick={function() { startEditResult(entry); }} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>+ sluttid</span>}
                            {!isMe && !entry.result && <span style={{ fontSize: 11, color: "#C4C3BB" }}>✓</span>}
                          </div>
                        </div>
                        {editingResultId === entry.id && isMe && (
                          <div style={{ marginTop: 10 }}>
                            <TP h={resultH} m={resultM} s={resultS} onH={setResultH} onM={setResultM} onS={setResultS} label="Sluttid" />
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <button onClick={function() { updateResult(entry.id); }} style={{ ...pill(false, true), padding: "5px 14px", fontSize: 11 }}>Lagre</button>
                              <button onClick={function() { var r = "DNS"; supabase.from("entries").update({ result: r }).eq("id", entry.id); setEntries(function(prev) { return prev.map(function(e) { return e.id === entry.id ? { ...e, result: r } : e; }); }); setEditingResultId(null); }} style={{ ...pill(false, false), padding: "5px 14px", fontSize: 11 }}>DNS</button>
                              <button onClick={function() { var r = "DNF"; supabase.from("entries").update({ result: r }).eq("id", entry.id); setEntries(function(prev) { return prev.map(function(e) { return e.id === entry.id ? { ...e, result: r } : e; }); }); setEditingResultId(null); }} style={{ ...pill(false, false), padding: "5px 14px", fontSize: 11 }}>DNF</button>
                              <button onClick={function() { setEditingResultId(null); }} style={{ ...pill(false, false), padding: "5px 14px", fontSize: 11 }}>Avbryt</button>
                            </div>
                          </div>
                        )}
                        {isMe && editingResultId !== entry.id && entry.result && <div style={{ marginTop: 4 }}><span onClick={function() { startEditResult(entry); }} style={{ fontSize: 11, color: "#9B9B8E", cursor: "pointer" }}>Endre sluttid</span></div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Following */}
            {selectedProfile.id === userId && followingIds.length > 0 && (
              <div style={{ marginTop: 36 }}>
                <h2 style={sT}>Følger</h2>
                {profiles.filter(function(p) { return followingIds.includes(p.id); }).map(function(p) {
                  return (
                    <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div onClick={function() { openProfile(p); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}><Av p={p} /><div><div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>{fullName(p)}</div><div style={{ fontSize: 12, color: "#9B9B8E" }}>{p.city}</div></div></div>
                      <button onClick={function(e) { e.stopPropagation(); toggleFollow(p.id); }} style={pill(true, true)}>Følger</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Settings */}
            {selectedProfile.id === userId && (
              <div style={{ marginTop: 48 }}>
                <button onClick={function() { setShowSettings(!showSettings); }} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{showSettings ? "Skjul innstillinger" : "Innstillinger"}</button>
                {showSettings && (
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 24 }}>
                    {settingsMessage && <div style={{ fontSize: 12, color: "#2D5A3D", background: "#EFF5F0", padding: "10px 14px", borderRadius: 10 }}>{settingsMessage}</div>}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre fylke</div>
                      {!editingFylke ? <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 14 }}>{profile.city}</span><button onClick={function() { setEditingFylke(true); setEditFylke(profile.city); }} style={{ ...pill(false, false), padding: "4px 14px", fontSize: 11 }}>Endre</button></div> : <div style={{ display: "flex", gap: 8 }}><select value={editFylke} onChange={function(e) { setEditFylke(e.target.value); }} style={{ ...selS, flex: 1 }}><option value="">Velg fylke</option>{FYLKER.map(function(f) { return <option key={f} value={f}>{f}</option>; })}</select><button onClick={updateFylke} style={{ ...pill(false, true), padding: "7px 16px" }}>Lagre</button><button onClick={function() { setEditingFylke(false); }} style={{ ...pill(false, false), padding: "7px 16px" }}>Avbryt</button></div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Endre passord</div>
                      {!changingPassword ? <button onClick={function() { setChangingPassword(true); }} style={{ ...pill(false, false), padding: "4px 14px", fontSize: 11 }}>Endre passord</button> : <div style={{ display: "flex", gap: 8 }}><input type="password" placeholder="Nytt passord (min. 6 tegn)" value={newPassword} onChange={function(e) { setNewPassword(e.target.value); }} style={{ ...iS, flex: 1 }} autoFocus /><button onClick={changePasswordFn} style={{ ...pill(false, true), padding: "7px 16px" }}>Lagre</button><button onClick={function() { setChangingPassword(false); setNewPassword(""); }} style={{ ...pill(false, false), padding: "7px 16px" }}>Avbryt</button></div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7A7A6E", marginBottom: 8 }}>Slett konto</div>
                      {!showDeleteConfirm ? <button onClick={function() { setShowDeleteConfirm(true); }} style={{ fontSize: 11, color: "#C53030", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline", padding: 0 }}>Slett kontoen min permanent</button> : <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 10, padding: 18 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#C53030", marginBottom: 8 }}>Er du sikker?</div><div style={{ fontSize: 12, color: "#7A7A6E", marginBottom: 14 }}>Alle dine data slettes permanent.</div><div style={{ display: "flex", gap: 8 }}><button onClick={deleteAccount} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: "7px 18px", borderRadius: 20, border: "1px solid #C53030", background: "#C53030", color: "#fff", cursor: "pointer" }}>Ja, slett kontoen</button><button onClick={function() { setShowDeleteConfirm(false); }} style={pill(false, false)}>Avbryt</button></div></div>}
                    </div>
                    <div style={{ paddingTop: 8 }}><button onClick={handleLogout} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button></div>
                  </div>
                )}
                {!showSettings && <div style={{ marginTop: 12 }}><button onClick={handleLogout} style={{ fontSize: 12, color: "#9B9B8E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Logg ut</button></div>}
              </div>
            )}
          </div>
        )}

        {/* ═══ RACE DETAIL ═══ */}
        {view === "race" && selectedRace && (
          <div style={{ padding: "36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize: 13, color: "#9B9B8E", cursor: "pointer", marginBottom: 28, fontWeight: 500 }}>← Tilbake</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>{selectedRace.name}</h1>
            <div style={{ fontSize: 14, color: "#9B9B8E", marginBottom: 8 }}>{raceLocation(selectedRace)} · {selectedRace.distance} · {formatDate(selectedRace.date)}</div>
            {selectedRace.user_created && <div style={{ fontSize: 11, color: "#C4C3BB", marginBottom: 8 }}>Lagt til av bruker — verifiser dato hos arrangør</div>}
            <div style={{ fontSize: 12, color: "#C4C3BB", marginBottom: 20 }}>{entries.filter(function(e) { return e.race_id === selectedRace.id; }).length} løpere registrert</div>

            {!myEntries.some(function(e) { return e.race_id === selectedRace.id; }) ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <button onClick={function() { addRaceToMyList(selectedRace.id); }} style={{ fontSize: 13, fontWeight: 600, padding: "9px 24px", borderRadius: 22, border: "none", background: "#2D5A3D", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til i mine løp</button>
                <ShareRace race={selectedRace} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <span style={{ fontSize: 12, color: "#9B9B8E" }}>✓ Lagt til i dine løp</span>
                <ShareRace race={selectedRace} />
              </div>
            )}

            {/* Tempo groups */}
            {(function() {
              var re = entries.filter(function(e) { return e.race_id === selectedRace.id; });
              var tg = getTempoGroups(re, selectedRace.distance);
              if (!tg.length) return null;
              return (
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ ...sT, marginBottom: 10 }}>Tempogrupper</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {tg.map(function(g) {
                      return <div key={g.label} style={{ background: "#fff", border: "1px solid #EDECE6", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</span><span style={{ fontSize: 11, color: "#9B9B8E" }}>{g.count} {g.count === 1 ? "løper" : "løpere"}</span></div>;
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...sT, marginBottom: 0 }}>Påmeldte løpere</h2>
              <button onClick={function() { setRaceSortByTime(function(v) { return !v; }); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 14, border: "1px solid #E2E0D8", background: raceSortByTime ? "#2D5A3D" : "transparent", color: raceSortByTime ? "#fff" : "#9B9B8E", cursor: "pointer" }}>{raceSortByTime ? "Sortert etter tid" : "Sorter etter tid"}</button>
            </div>

            {(function() {
              var re = entries.filter(function(e) { return e.race_id === selectedRace.id; });
              if (!re.length) return <div style={{ fontSize: 13, color: "#C4C3BB" }}>Ingen registrerte løpere ennå</div>;
              var sorted;
              if (raceSortByTime) {
                sorted = [...re].sort(function(a, b) { var sa = parseGoalSeconds(a.goal); var sb = parseGoalSeconds(b.goal); if (sa && sb) return sa - sb; if (sa) return -1; if (sb) return 1; return 0; });
              } else {
                var fe = re.filter(function(e) { return followingIds.includes(e.user_id) || e.user_id === userId; });
                var oe = re.filter(function(e) { return !followingIds.includes(e.user_id) && e.user_id !== userId; });
                sorted = [...fe, ...oe];
              }
              return (
                <div>{sorted.map(function(entry) {
                  var p = profiles.find(function(pr) { return pr.id === entry.user_id; });
                  if (!p) return null;
                  var isMe = p.id === userId;
                  return (
                    <div key={p.id} style={{ padding: "16px 0", borderBottom: "1px solid #EDECE6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div onClick={function() { openProfile(p); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <Av p={p} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>{fullName(p)} {isMe && <span style={{ fontWeight: 400, color: "#C4C3BB" }}>(deg)</span>}</div>
                          <div style={{ fontSize: 12, color: "#9B9B8E" }}>{p.city}{entry.goal ? " · Mål: " + entry.goal : ""}</div>
                        </div>
                      </div>
                      {!isMe && <span style={{ color: "#D4D3CC", fontSize: 16, cursor: "pointer" }} onClick={function() { openProfile(p); }}>›</span>}
                    </div>
                  );
                })}</div>
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
