import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const formatDate = (dateStr) => { const d = new Date(dateStr + "T00:00:00"); const months = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"]; return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`; };
const getInitials = (first, last) => `${(first||"")[0]||""}${(last||"")[0]||""}`.toUpperCase();
const COLORS = ["#2D5A3D","#8B4513","#4A5568","#6B3A5D","#2C5282","#744210"];
const colorFor = (id) => COLORS[id.charCodeAt(0) % COLORS.length];
const capitalize = (str) => str.split(" ").map((w) => w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
const FYLKER = ["Agder","Innlandet","Møre og Romsdal","Nordland","Oslo","Rogaland","Troms","Trøndelag","Vestfold og Telemark","Vestland","Viken"];
const parseGoalSeconds = (goal) => { if (!goal) return null; const parts = goal.replace(/\s/g,"").split(":").map(Number); if (parts.some(isNaN)) return null; if (parts.length===3) return parts[0]*3600+parts[1]*60+parts[2]; if (parts.length===2) return parts[0]*60+parts[1]; if (parts.length===1&&parts[0]>0) return parts[0]*60; return null; };
const formatGoalTime = (h,m,s) => h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`;
const getMatchTolerance = (distance) => { const d = (distance||"").toLowerCase(); if (d.includes("42")||d.includes("maraton")) return 300; if (d.includes("21")||d.includes("halv")) return 300; return 120; };
const getDistanceCategory = (distance) => { const d = (distance||"").toLowerCase(); if (d.includes("42")||(d.includes("maraton")&&!d.includes("halv"))) return "maraton"; if (d.includes("21")||d.includes("halv")) return "halvmaraton"; if (d.includes("10")) return "10 km"; if (d.includes("5")) return "5 km"; return null; };
const daysUntil = (dateStr) => { const now = new Date(); now.setHours(0,0,0,0); return Math.ceil((new Date(dateStr+"T00:00:00") - now) / 86400000); };
const fuzzyMatch = (input, target) => { const a = input.toLowerCase().replace(/[^a-zæøå0-9]/g,""); const b = target.toLowerCase().replace(/[^a-zæøå0-9]/g,""); if (a.length<4) return false; if (b.includes(a)||a.includes(b)) return true; let m=0; for (let i=0;i<a.length;i++){const idx=b.indexOf(a[i],Math.max(0,i-2));if(idx!==-1&&Math.abs(idx-i)<=2)m++;} return m/a.length>0.85; };

const getTempoGroups = (raceEntries, distance) => {
  const withGoals = raceEntries.map((e) => ({ ...e, secs: parseGoalSeconds(e.goal) })).filter((e) => e.secs);
  if (withGoals.length < 2) return [];
  const d = (distance||"").toLowerCase();
  let groups;
  if (d.includes("42")||d.includes("maraton")) { groups = [{label:"Sub 3:00",min:0,max:10800},{label:"3:00–3:30",min:10800,max:12600},{label:"3:30–4:00",min:12600,max:14400},{label:"4:00–4:30",min:14400,max:16200},{label:"4:30+",min:16200,max:99999}]; }
  else if (d.includes("21")||d.includes("halv")) { groups = [{label:"Sub 1:30",min:0,max:5400},{label:"1:30–1:45",min:5400,max:6300},{label:"1:45–2:00",min:6300,max:7200},{label:"2:00+",min:7200,max:99999}]; }
  else { groups = [{label:"Sub 35",min:0,max:2100},{label:"35–40",min:2100,max:2400},{label:"40–45",min:2400,max:2700},{label:"45–50",min:2700,max:3000},{label:"50+",min:3000,max:99999}]; }
  return groups.map((g) => ({...g, count: withGoals.filter((e) => e.secs >= g.min && e.secs < g.max).length})).filter((g) => g.count > 0);
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
  const [newRace, setNewRace] = useState({ name:"", location:"", date:"", distance:"", country:"" });
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [goalForExisting, setGoalForExisting] = useState({ h:0, m:0, s:0 });
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

  useEffect(() => { const load = async () => { const [profileRes, profilesRes, racesRes, entriesRes, followsRes] = await Promise.all([supabase.from("profiles").select("*").eq("id", userId).single(), supabase.from("profiles").select("*"), supabase.from("races").select("*").order("date"), supabase.from("entries").select("*"), supabase.from("follows").select("*").eq("follower_id", userId)]); const p = profileRes.data; setProfile(p); setProfiles(profilesRes.data||[]); setRaces(racesRes.data||[]); setEntries(entriesRes.data||[]); setFollows((followsRes.data||[]).map((f)=>f.following_id)); if (p && !FYLKER.includes(p.city)) setNeedsFylke(true); setLoading(false); }; load(); }, [userId]);

  if (loading || !profile) return <div style={{ minHeight:"100vh", background:"#FAFAF7", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:20, fontWeight:700, color:"#2D5A3D" }}>startlista</span></div>;

  const fullName = (p) => `${p.first_name} ${p.last_name}`;
  const myEntries = entries.filter((e) => e.user_id === userId);
  const followingIds = follows;
  const today = new Date().toISOString().split("T")[0];
  const totalUsers = profiles.length;
  const navigate = (fn) => { setFadeKey((k) => k + 1); fn(); };
  const goalTimeString = (h,m,s) => (h===0&&m===0&&s===0) ? "" : formatGoalTime(h,m,s);

  const saveFylke = async () => { if (!selectedFylke) return; await supabase.from("profiles").update({ city: selectedFylke }).eq("id", userId); setProfile((p) => ({...p, city: selectedFylke})); setProfiles((prev) => prev.map((p) => p.id === userId ? {...p, city: selectedFylke} : p)); setNeedsFylke(false); };
  const toggleFollow = async (tid) => { if (followingIds.includes(tid)) { await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", tid); setFollows((p) => p.filter((id) => id !== tid)); } else { await supabase.from("follows").insert({ follower_id: userId, following_id: tid }); setFollows((p) => [...p, tid]); } };
  const addRaceToMyList = async (raceId) => { if (myEntries.some((e) => e.race_id === raceId)) return; const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: raceId, goal: "" }).select().single(); if (data) setEntries((p) => [...p, data]); };
  const addExistingRace = async () => { if (!selectedExisting||myEntries.some((e) => e.race_id === selectedExisting.id)) return; const goal = goalTimeString(goalForExisting.h,goalForExisting.m,goalForExisting.s); const { data } = await supabase.from("entries").insert({ user_id: userId, race_id: selectedExisting.id, goal }).select().single(); if (data) setEntries((p) => [...p, data]); setShowAddRace(false); setSelectedExisting(null); setGoalForExisting({h:0,m:0,s:0}); setSearchQuery(""); };
  const addManualRace = async () => { if (!newRace.name||!newRace.location||!newRace.date||!newRace.distance) return; const goal = goalTimeString(newGoalH,newGoalM,newGoalS); const { data: rd, error } = await supabase.from("races").insert({ name: capitalize(newRace.name), location: capitalize(newRace.location), date: newRace.date, distance: newRace.distance, country: newRace.country ? capitalize(newRace.country) : "", user_created: true }).select().single(); if (error) return; if (rd) { setRaces((p) => [...p, rd]); const { data: ed } = await supabase.from("entries").insert({ user_id: userId, race_id: rd.id, goal }).select().single(); if (ed) setEntries((p) => [...p, ed]); } setShowAddRace(false); setManualMode(false); setNewRace({name:"",location:"",date:"",distance:"",country:""}); setNewGoalH(0); setNewGoalM(0); setNewGoalS(0); setSearchQuery(""); };
  const removeEntry = async (raceId) => { await supabase.from("entries").delete().eq("user_id", userId).eq("race_id", raceId); setEntries((p) => p.filter((e) => !(e.user_id === userId && e.race_id === raceId))); };
  const updateGoal = async (entryId) => { const goal = goalTimeString(editGoalH,editGoalM,editGoalS); await supabase.from("entries").update({ goal }).eq("id", entryId); setEntries((p) => p.map((e) => e.id === entryId ? {...e, goal} : e)); setEditingGoalEntryId(null); };
  const updateResult = async (entryId) => { const result = goalTimeString(resultH,resultM,resultS); await supabase.from("entries").update({ result }).eq("id", entryId); setEntries((p) => p.map((e) => e.id === entryId ? {...e, result} : e)); setEditingResultId(null); };
  const startEditResult = (entry) => { const secs = parseGoalSeconds(entry.result); if (secs) { setResultH(Math.floor(secs/3600)); setResultM(Math.floor((secs%3600)/60)); setResultS(secs%60); } else { setResultH(0); setResultM(0); setResultS(0); } setEditingResultId(entry.id); };
  const startEditGoal = (entry) => { const secs = parseGoalSeconds(entry.goal); if (secs) { setEditGoalH(Math.floor(secs/3600)); setEditGoalM(Math.floor((secs%3600)/60)); setEditGoalS(secs%60); } else { setEditGoalH(0); setEditGoalM(0); setEditGoalS(0); } setEditingGoalEntryId(entry.id); };
  const updateFylke = async () => { if (!editFylke) return; await supabase.from("profiles").update({ city: editFylke }).eq("id", userId); setProfile((p) => ({...p, city: editFylke})); setProfiles((prev) => prev.map((p) => p.id === userId ? {...p, city: editFylke} : p)); setEditingFylke(false); setSettingsMessage("Fylke oppdatert"); setTimeout(() => setSettingsMessage(""), 2000); };
  const changePassword = async () => { if (newPassword.length<6) { setSettingsMessage("Minst 6 tegn"); return; } const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) setSettingsMessage(error.message); else { setSettingsMessage("Passord endret"); setNewPassword(""); setChangingPassword(false); } setTimeout(() => setSettingsMessage(""), 3000); };
  const deleteAccount = async () => { await supabase.rpc("delete_user"); await supabase.auth.signOut(); };
  const handleLogout = async () => { await supabase.auth.signOut(); };
  const openProfile = (p) => navigate(() => { setSelectedProfile(p); setView("profile"); setGlobalSearch(""); setShowSettings(false); });
  const openRace = (raceId) => navigate(() => { setSelectedRace(races.find((r) => r.id === raceId)); setView("race"); setGlobalSearch(""); setRaceSortByTime(false); });
  const goRaces = () => navigate(() => { setView("races"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); setShowAllRaces(false); });
  const goFeed = () => navigate(() => { setView("feed"); setSelectedProfile(null); setSelectedRace(null); setGlobalSearch(""); setShowSettings(false); });
  const raceLocation = (race) => `${race.location}${race.country && race.country !== "Norge" ? `, ${race.country}` : ""}`;
  const filteredRaces = searchQuery.length > 0 ? races.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.location.toLowerCase().includes(searchQuery.toLowerCase()) || (r.country && r.country.toLowerCase().includes(searchQuery.toLowerCase()))) : [];
  const getSuggestions = (name) => { if (!name||name.length<4) return []; return races.filter((r) => fuzzyMatch(name, r.name) && !myEntries.some((e) => e.race_id === r.id)).slice(0, 3); };
  const scrollCarousel = (dir) => { if (carouselRef.current) carouselRef.current.scrollBy({ left: dir * 280, behavior: "smooth" }); };

  const getRaceSuggestions = () => {
    const myRaceIds = myEntries.map((e) => e.race_id);
    return races.filter((r) => r.date >= today && !myRaceIds.includes(r.id)).map((race) => {
      const re = entries.filter((e) => e.race_id === race.id); const ps = re.map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
      const fp = ps.filter((p) => followingIds.includes(p.id)); const sap = ps.filter((p) => p.city === profile.city && p.id !== userId);
      const rdc = getDistanceCategory(race.distance); const mgfd = myEntries.map((e) => { const r = races.find((r) => r.id === e.race_id); return { dist: r ? getDistanceCategory(r.distance) : null, secs: parseGoalSeconds(e.goal) }; }).filter((g) => g.secs && g.dist === rdc);
      let sgc = 0; const tol = getMatchTolerance(race.distance); re.forEach((e) => { if (e.user_id===userId) return; const ts = parseGoalSeconds(e.goal); if (!ts) return; mgfd.forEach((mg) => { if (Math.abs(ts-mg.secs)<=tol) sgc++; }); });
      const score = fp.length*3 + sap.length*2 + sgc*2 + ps.length*0.1; if (score===0 && ps.length===0) return null;
      return { race, participants: ps, followingParticipants: fp, sameAreaParticipants: sap, sameGoalCount: sgc, sameGoalDist: rdc, score, total: ps.length };
    }).filter(Boolean).sort((a,b) => b.score - a.score).slice(0, 5);
  };

  const getHeroRace = () => {
    const relevant = races.filter((r) => r.date >= today && entries.some((e) => e.race_id === r.id && (e.user_id === userId || followingIds.includes(e.user_id)))).sort((a,b) => a.date.localeCompare(b.date));
    if (!relevant.length) return null;
    const race = relevant[0]; const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
    return { race, participants: ps, days: daysUntil(race.date) };
  };

  const getNextSharedRace = () => {
    const shared = [];
    races.filter((r) => r.date >= today).forEach((race) => {
      const re = entries.filter((e) => e.race_id === race.id);
      const meIn = re.some((e) => e.user_id === userId);
      const friends = re.filter((e) => followingIds.includes(e.user_id)).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean);
      if (meIn && friends.length > 0) shared.push({ race, friends, days: daysUntil(race.date) });
    });
    shared.sort((a,b) => a.days - b.days);
    return shared[0] || null;
  };

  const inputS = inputStyle; const labelS = labelStyle; const secTitle = sectionTitle;
  const selectS = { ...inputStyle, appearance:"none", WebkitAppearance:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239B9B8E' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center", paddingRight:36 };

  const Av = ({ p, size=36, fontSize=13 }) => <div style={{ width:size, height:size, borderRadius:"50%", background:colorFor(p.id), color:"#fff", fontSize, fontFamily:"'DM Sans',sans-serif", fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{getInitials(p.first_name, p.last_name)}</div>;
  const AvStack = ({ participants, max=3 }) => <div style={{ display:"flex", alignItems:"center" }}>{participants.slice(0,max).map((p,i) => <div key={p.id} style={{ width:26, height:26, borderRadius:"50%", background:colorFor(p.id), color:"#fff", fontSize:10, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", marginLeft:i>0?-8:0, border:"2px solid #FAFAF7", fontFamily:"'DM Sans',sans-serif" }}>{getInitials(p.first_name, p.last_name)}</div>)}{participants.length>max && <span style={{ fontSize:11, fontWeight:500, color:"#C4C3BB", marginLeft:4 }}>+{participants.length-max}</span>}</div>;
  const TP = ({ h,m,s,onH,onM,onS,label="Målsetning (valgfritt)" }) => <div><label style={labelS}>{label}</label><div style={{ display:"flex", gap:8 }}><div style={{flex:1}}><select value={h} onChange={(e)=>onH(Number(e.target.value))} style={{...selectS,padding:"10px 12px"}}>{Array.from({length:7},(_,i)=><option key={i} value={i}>{i} t</option>)}</select></div><div style={{flex:1}}><select value={m} onChange={(e)=>onM(Number(e.target.value))} style={{...selectS,padding:"10px 12px"}}>{Array.from({length:60},(_,i)=><option key={i} value={i}>{String(i).padStart(2,"0")} min</option>)}</select></div><div style={{flex:1}}><select value={s} onChange={(e)=>onS(Number(e.target.value))} style={{...selectS,padding:"10px 12px"}}>{Array.from({length:60},(_,i)=><option key={i} value={i}>{String(i).padStart(2,"0")} sek</option>)}</select></div></div></div>;
  const RR = ({ race, onClick, right }) => <div onClick={onClick} style={{ padding:"16px 0", borderBottom:"1px solid #EDECE6", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}><div><div style={{ fontWeight:600, fontSize:15, marginBottom:3, letterSpacing:"-0.2px" }}>{race.name}</div><div style={{ fontSize:12, color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>{right || <span style={{ color:"#D4D3CC", fontSize:16 }}>›</span>}</div>;

  // Fylke prompt
  if (needsFylke) return (
    <div style={{ minHeight:"100vh", background:"#FAFAF7", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ maxWidth:380, width:"100%", padding:"0 20px", textAlign:"center" }}>
        <div style={{ fontSize:24, fontWeight:700, color:"#2D5A3D", marginBottom:8 }}>startlista</div>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Velg fylke</div>
        <div style={{ fontSize:14, color:"#9B9B8E", lineHeight:1.5, marginBottom:24 }}>Vi har oppdatert profilen. Velg fylket ditt for å finne løpere i ditt område.</div>
        <select value={selectedFylke} onChange={(e) => setSelectedFylke(e.target.value)} style={{...selectS, marginBottom:16}}><option value="">Velg fylke</option>{FYLKER.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <button onClick={saveFylke} disabled={!selectedFylke} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600, padding:"12px", borderRadius:8, border:"none", background:"#2D5A3D", color:"#fff", cursor:selectedFylke?"pointer":"default", opacity:selectedFylke?1:0.4, width:"100%" }}>Lagre</button>
      </div>
    </div>
  );

  const hero = getHeroRace();
  const nextShared = getNextSharedRace();

  return (
    <div style={{ minHeight:"100vh", background:"#FAFAF7", fontFamily:"'DM Sans',sans-serif", color:"#1A1A1A" }}>
      <header style={{ position:"sticky", top:0, zIndex:100, background:"rgba(250,250,247,0.85)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderBottom:"1px solid rgba(226,224,216,0.6)" }}>
        <div style={{ maxWidth:640, margin:"0 auto", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div onClick={goRaces} style={{ cursor:"pointer" }}><span style={{ fontWeight:700, fontSize:18, letterSpacing:"-0.5px", color:"#2D5A3D" }}>startlista</span></div>
          <div style={{ display:"flex", gap:18 }}>
            {[{label:"Løp",v:"races",action:goRaces},{label:"Oversikt",v:"feed",action:goFeed},{label:"Min profil",v:"myprofile",action:()=>openProfile(profile)}].map((tab) => {
              const isA = view===tab.v||(tab.v==="myprofile"&&view==="profile"&&selectedProfile?.id===userId);
              return <span key={tab.v} onClick={tab.action} style={{ fontSize:13, cursor:"pointer", color:isA?"#2D5A3D":"#9B9B8E", fontWeight:isA?600:500 }}>{tab.label}</span>;
            })}
          </div>
        </div>
      </header>

      <main key={fadeKey} style={{ maxWidth:640, margin:"0 auto", padding:"0 20px", animation:"fadeIn 0.35s cubic-bezier(0.25,0.1,0.25,1)" }}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* ═══ LØP ═══ */}
        {view === "races" && (
          <div style={{ padding:"24px 0 60px" }}>
            <div style={{ textAlign:"center", padding:"32px 0 24px" }}>
              <div style={{ fontSize:24, fontWeight:800, color:"#1A1A1A", letterSpacing:"-0.8px", marginBottom:8 }}>Velkommen til startlista</div>
              <div style={{ fontSize:15, color:"#9B9B8E", lineHeight:1.5 }}>Din og dine løpevenners terminliste.</div>
              <div style={{ fontSize:12, color:"#C4C3BB", marginTop:8 }}>{totalUsers} løpere registrert</div>
            </div>

            {/* Search */}
            <div style={{ position:"relative", marginBottom:28 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputS} />
              {globalSearch.length > 0 && (() => {
                const q = globalSearch.toLowerCase();
                const mu = profiles.filter((p) => fullName(p).toLowerCase().includes(q)||p.city.toLowerCase().includes(q));
                const mr = races.filter((r) => r.name.toLowerCase().includes(q)||r.location.toLowerCase().includes(q));
                if (!mu.length&&!mr.length) return <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #E2E0D8",borderRadius:10,padding:14,zIndex:50,marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.06)" }}><div style={{ fontSize:13,color:"#9B9B8E",marginBottom:8 }}>Ingen treff</div><div onClick={()=>{setGlobalSearch("");openProfile(profile);setTimeout(()=>{setShowAddRace(true);setManualMode(true);},100);}} style={{ fontSize:12,color:"#2D5A3D",cursor:"pointer",fontWeight:500 }}>Finner ikke løpet? Legg til manuelt →</div></div>;
                return (
                  <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #E2E0D8",borderRadius:10,zIndex:50,marginTop:4,maxHeight:340,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.06)" }}>
                    {mu.length>0 && <><div style={{ padding:"10px 14px 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#C4C3BB" }}>Løpere</div>{mu.map((p) => <div key={p.id} onClick={()=>{openProfile(p);setGlobalSearch("");}} style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #F0EFE9" }}><Av p={p} size={28} fontSize={10} /><div><div style={{ fontWeight:600,fontSize:14 }}>{fullName(p)}</div><div style={{ fontSize:11,color:"#9B9B8E" }}>{p.city}</div></div></div>)}</>}
                    {mr.length>0 && <><div style={{ padding:"10px 14px 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#C4C3BB" }}>Løp</div>{mr.map((race) => <div key={race.id} onClick={()=>{openRace(race.id);setGlobalSearch("");}} style={{ padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #F0EFE9" }}><div style={{ fontWeight:600,fontSize:14 }}>{race.name}</div><div style={{ fontSize:11,color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>)}</>}
                    <div onClick={()=>{setGlobalSearch("");openProfile(profile);setTimeout(()=>{setShowAddRace(true);setManualMode(true);},100);}} style={{ padding:"10px 14px",borderTop:"1px solid #F0EFE9",fontSize:12,color:"#2D5A3D",cursor:"pointer",fontWeight:500 }}>Finner ikke løpet? Legg til manuelt →</div>
                  </div>
                );
              })()}
            </div>

            {/* Hero race card */}
            {hero && (
              <div onClick={() => openRace(hero.race.id)} style={{ background:"#2D5A3D", borderRadius:16, padding:"28px 24px", marginBottom:28, cursor:"pointer", color:"#fff", boxShadow:"0 8px 32px rgba(45,90,61,0.2)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:12, opacity:0.7, marginBottom:4 }}>Neste løp</div>
                    <div style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.5px" }}>{hero.race.name}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:32, fontWeight:800, letterSpacing:"-1px" }}>{hero.days}</div>
                    <div style={{ fontSize:12, opacity:0.7 }}>{hero.days === 1 ? "dag" : "dager"}</div>
                  </div>
                </div>
                <div style={{ fontSize:13, opacity:0.8, marginBottom:14 }}>{raceLocation(hero.race)} · {hero.race.distance} · {formatDate(hero.race.date)}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ display:"flex" }}>{hero.participants.slice(0,5).map((p,i) => <div key={p.id} style={{ width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,0.25)", color:"#fff", fontSize:10, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", marginLeft:i>0?-8:0, border:"2px solid #2D5A3D" }}>{getInitials(p.first_name,p.last_name)}</div>)}</div>
                  <span style={{ fontSize:12, opacity:0.7 }}>{hero.participants.length} påmeldt</span>
                </div>
              </div>
            )}

            {/* Following races */}
            {(() => {
              const relevant = races.filter((r) => r.date >= today && entries.some((e) => e.race_id === r.id && (e.user_id === userId || followingIds.includes(e.user_id)))).filter((r) => !hero || r.id !== hero.race.id);
              const visible = showAllRaces ? relevant : relevant.slice(0, 10);
              if (!relevant.length) return null;
              return <>
                <h2 style={secTitle}>Løp fra de du følger</h2>
                <div>{visible.map((race) => { const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean); return <RR key={race.id} race={race} onClick={() => openRace(race.id)} right={<div style={{ display:"flex",alignItems:"center",gap:6 }}>{ps.length>0&&<AvStack participants={ps}/>}<span style={{ color:"#D4D3CC",fontSize:16 }}>›</span></div>} />; })}</div>
                {relevant.length > 10 && !showAllRaces && <div style={{ textAlign:"center",paddingTop:12 }}><button onClick={() => setShowAllRaces(true)} style={{...pillBtn(false,false),fontSize:13}}>Se alle løp ({relevant.length})</button></div>}
              </>;
            })()}

            {/* Carousel */}
            {(() => {
              const sug = getRaceSuggestions();
              if (!sug.length) return null;
              return (
                <div style={{ marginTop:40 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                    <h2 style={{ fontSize:20,fontWeight:800,letterSpacing:"-0.5px",margin:0 }}>Forslag til løp</h2>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={() => scrollCarousel(-1)} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #E2E0D8",background:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#9B9B8E" }}>‹</button>
                      <button onClick={() => scrollCarousel(1)} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #E2E0D8",background:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:"#9B9B8E" }}>›</button>
                    </div>
                  </div>
                  <div ref={carouselRef} style={{ display:"flex",gap:14,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",paddingBottom:8 }}>
                    <style>{`::-webkit-scrollbar{display:none}`}</style>
                    {sug.map((s) => (
                      <div key={s.race.id} onClick={() => openRace(s.race.id)} style={{ minWidth:260,maxWidth:260,scrollSnapAlign:"start",cursor:"pointer",background:"#fff",borderRadius:16,border:"1px solid #EDECE6",padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
                        <div style={{ fontSize:11,color:"#9B9B8E",marginBottom:6 }}>{s.total} løpere registrert</div>
                        <div style={{ fontSize:18,fontWeight:800,letterSpacing:"-0.5px",marginBottom:12 }}>{s.race.name}</div>
                        <div style={{ fontSize:11,color:"#7A7A6E",marginBottom:14 }}>{raceLocation(s.race)} · {formatDate(s.race.date)}</div>
                        <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:14 }}>
                          {s.followingParticipants.length>0 && <div style={{ fontSize:12,color:"#1A1A1A" }}>{s.followingParticipants.length} du følger skal løpe</div>}
                          {s.sameAreaParticipants.length>0 && <div style={{ fontSize:12,color:"#1A1A1A" }}>{s.sameAreaParticipants.length} løpere fra {profile.city}</div>}
                          {s.sameGoalCount>0 && <div style={{ fontSize:12,color:"#1A1A1A" }}>{s.sameGoalCount} med samme tidsmål{s.sameGoalDist ? ` på ${s.sameGoalDist}` : ""}</div>}
                        </div>
                        {s.participants.length>0 && <AvStack participants={s.participants} max={5} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Populært nå */}
            {(() => {
              const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); const weekAgoStr = oneWeekAgo.toISOString();
              const upcomingRaces = races.filter((r) => r.date >= today);
              const racePopularity = upcomingRaces.map((race) => {
                const allEntries = entries.filter((e) => e.race_id === race.id);
                const recentEntries = allEntries.filter((e) => e.created_at && e.created_at >= weekAgoStr);
                return { race, total: allEntries.length, recent: recentEntries.length };
              }).filter((r) => r.recent > 0 || r.total >= 3).sort((a, b) => b.recent - a.recent || b.total - a.total).slice(0, 3);
              if (!racePopularity.length) return null;
              return (
                <div style={{ marginTop:40 }}>
                  <h2 style={secTitle}>Populært nå</h2>
                  <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
                    {racePopularity.map((item, i) => (
                      <div key={item.race.id} onClick={() => openRace(item.race.id)} style={{ padding:"14px 0",borderBottom:"1px solid #EDECE6",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
                          <div style={{ width:32,height:32,borderRadius:10,background:i===0?"#2D5A3D":i===1?"#4A5568":"#8B4513",color:"#fff",fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center" }}>{i+1}</div>
                          <div>
                            <div style={{ fontWeight:600,fontSize:14,letterSpacing:"-0.2px" }}>{item.race.name}</div>
                            <div style={{ fontSize:11,color:"#9B9B8E" }}>{raceLocation(item.race)} · {formatDate(item.race.date)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:14,fontWeight:700,color:"#2D5A3D" }}>{item.total}</div>
                          <div style={{ fontSize:10,color:"#9B9B8E" }}>påmeldt</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Upcoming */}
            {(() => {
              const myIds = entries.filter((e) => e.user_id===userId||followingIds.includes(e.user_id)).map((e) => e.race_id);
              const other = races.filter((r) => r.date >= today && !myIds.includes(r.id)).slice(0, 6);
              if (!other.length) return null;
              return <div style={{ marginTop:40 }}><h2 style={secTitle}>Kommende løp</h2><div>{other.map((race) => { const ps = entries.filter((e) => e.race_id === race.id).map((e) => profiles.find((p) => p.id === e.user_id)).filter(Boolean); return <RR key={race.id} race={race} onClick={() => openRace(race.id)} right={<div style={{ display:"flex",alignItems:"center",gap:6 }}>{ps.length>0&&<AvStack participants={ps}/>}<span style={{ color:"#D4D3CC",fontSize:16 }}>›</span></div>} />; })}</div><div style={{ textAlign:"center",paddingTop:12 }}><span style={{ fontSize:12,color:"#C4C3BB" }}>Bruk søkefeltet for å finne flere løp</span></div></div>;
            })()}
          </div>
        )}

        {/* ═══ OVERSIKT ═══ */}
        {view === "feed" && (
          <div style={{ padding:"24px 0 60px" }}>
            <div style={{ position:"relative", marginBottom:20 }}>
              <input type="text" placeholder="Søk etter løpere eller løp..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} style={inputS} />
              {globalSearch.length > 0 && (() => {
                const q = globalSearch.toLowerCase();
                const mu = profiles.filter((p) => fullName(p).toLowerCase().includes(q)||p.city.toLowerCase().includes(q));
                const mr = races.filter((r) => r.name.toLowerCase().includes(q)||r.location.toLowerCase().includes(q));
                if (!mu.length&&!mr.length) return <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #E2E0D8",borderRadius:10,padding:14,fontSize:13,color:"#9B9B8E",zIndex:50,marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,0.06)" }}>Ingen treff</div>;
                return <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #E2E0D8",borderRadius:10,zIndex:50,marginTop:4,maxHeight:300,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.06)" }}>
                  {mu.length>0 && <><div style={{ padding:"10px 14px 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#C4C3BB" }}>Løpere</div>{mu.map((p) => <div key={p.id} onClick={()=>{openProfile(p);setGlobalSearch("");}} style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #F0EFE9" }}><Av p={p} size={28} fontSize={10} /><div><div style={{ fontWeight:600,fontSize:14 }}>{fullName(p)}</div><div style={{ fontSize:11,color:"#9B9B8E" }}>{p.city}</div></div></div>)}</>}
                  {mr.length>0 && <><div style={{ padding:"10px 14px 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"#C4C3BB" }}>Løp</div>{mr.map((race) => <div key={race.id} onClick={()=>{openRace(race.id);setGlobalSearch("");}} style={{ padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #F0EFE9" }}><div style={{ fontWeight:600,fontSize:14 }}>{race.name}</div><div style={{ fontSize:11,color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>)}</>}
                </div>;
              })()}
            </div>

            {/* Next shared race highlight */}
            {nextShared && (
              <div onClick={() => openRace(nextShared.race.id)} style={{ background:"linear-gradient(135deg, #2D5A3D 0%, #3D7A52 100%)", borderRadius:14, padding:"22px 20px", marginBottom:24, cursor:"pointer", color:"#fff" }}>
                <div style={{ fontSize:11, opacity:0.7, marginBottom:4 }}>Om {nextShared.days} {nextShared.days===1?"dag":"dager"} løper du og {nextShared.friends[0] ? fullName(nextShared.friends[0]) : ""}{nextShared.friends.length>1 ? ` +${nextShared.friends.length-1}` : ""}</div>
                <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.5px" }}>{nextShared.race.name}</div>
                <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>{raceLocation(nextShared.race)} · {nextShared.race.distance}</div>
              </div>
            )}

            {(() => {
              const rg = {};
              entries.forEach((entry) => { const p = profiles.find((pr) => pr.id === entry.user_id); const race = races.find((r) => r.id === entry.race_id); if (p&&race&&race.date>=today&&(followingIds.includes(p.id)||p.id===userId)) { if (!rg[race.id]) rg[race.id] = { race, runners:[] }; rg[race.id].runners.push({ profile:p, goal:entry.goal }); } });
              const grouped = Object.values(rg).sort((a,b) => a.race.date.localeCompare(b.race.date));
              if (!grouped.length) return <div style={{ textAlign:"center",padding:"60px 0" }}><div style={{ fontSize:15,color:"#C4C3BB",lineHeight:1.6 }}>Følg løpere for å se deres planer her,<br/>eller legg til egne løp fra Min profil.</div></div>;
              return <>
                <h2 style={secTitle}>Oversikt</h2>
                <div>{grouped.map((group) => (
                  <div key={group.race.id} style={{ borderBottom:"1px solid #EDECE6" }}>
                    <div onClick={() => openRace(group.race.id)} style={{ padding:"16px 0",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div><div style={{ fontWeight:600,fontSize:15,marginBottom:3,letterSpacing:"-0.2px" }}>{group.race.name}</div><div style={{ fontSize:12,color:"#9B9B8E" }}>{raceLocation(group.race)} · {group.race.distance} · {formatDate(group.race.date)}</div></div>
                      <span style={{ color:"#D4D3CC",fontSize:16 }}>›</span>
                    </div>
                    <div style={{ paddingBottom:12 }}>{group.runners.map((r) => <div key={r.profile.id} style={{ padding:"5px 0",display:"flex",justifyContent:"space-between",alignItems:"center" }}><span onClick={()=>openProfile(r.profile)} style={{ fontSize:13,color:"#5A5A52",cursor:"pointer" }}>{fullName(r.profile)}</span>{r.goal && <span style={{ fontSize:11,fontWeight:500,color:"#2D5A3D",background:"#EFF5F0",padding:"2px 8px",borderRadius:10 }}>{r.goal}</span>}</div>)}</div>
                  </div>
                ))}</div>
              </>;
            })()}
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {view === "profile" && selectedProfile && (
          <div style={{ padding:"36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize:13,color:"#9B9B8E",cursor:"pointer",marginBottom:28,fontWeight:500 }}>← Tilbake</div>
            <div style={{ marginBottom:32 }}>
              <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:6 }}>
                <Av p={selectedProfile} size={48} fontSize={17} />
                <div>
                  <div style={{ fontSize:20,fontWeight:800,letterSpacing:"-0.5px" }}>{fullName(selectedProfile)}</div>
                  <div style={{ fontSize:13,color:"#9B9B8E",marginTop:1 }}>{selectedProfile.city}</div>
                </div>
              </div>
              {/* Stats line */}
              <div style={{ fontSize:12,color:"#C4C3BB",marginBottom:16 }}>
                {entries.filter((e) => e.user_id === selectedProfile.id && races.find((r) => r.id === e.race_id)?.date >= today).length} planlagte løp · {entries.filter((e) => e.user_id === selectedProfile.id && races.find((r) => r.id === e.race_id)?.date < today).length} gjennomført
              </div>
              {selectedProfile.id !== userId && !followingIds.includes(selectedProfile.id) && <button onClick={() => toggleFollow(selectedProfile.id)} style={{...pillBtn(false,true),fontSize:13,padding:"9px 24px"}}>Følg</button>}
              {selectedProfile.id !== userId && followingIds.includes(selectedProfile.id) && <span style={{ fontSize:12,color:"#9B9B8E" }}>Følger</span>}
              {selectedProfile.id === userId && (
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <button onClick={() => {setShowAddRace(true);setManualMode(false);setSelectedExisting(null);setSearchQuery("");}} style={{ fontSize:13,fontWeight:600,padding:"9px 24px",borderRadius:22,border:"none",background:"#2D5A3D",color:"#fff",cursor:"pointer",boxShadow:"0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til løp</button>
                  <span onClick={()=>{const url="https://startlista.no";const text=`Sjekk startlista.no — se hvem som skal løpe samme løp som deg, og finn noen med samme målsetning.`;if(navigator.share){navigator.share({title:"startlista",text,url})}else{navigator.clipboard.writeText(`${text} ${url}`);alert("Tekst kopiert!")}}} style={{ fontSize:12,color:"#2D5A3D",cursor:"pointer",fontWeight:500 }}>Inviter en løpevenn →</span>
                </div>
              )}
            </div>

            {/* Countdown to next race */}
            {(() => {
              const nextEntry = [...entries.filter((e) => e.user_id === selectedProfile.id)].filter((e) => { const r = races.find((r) => r.id === e.race_id); return r && r.date >= today; }).sort((a,b) => { const ra = races.find((r) => r.id === a.race_id); const rb = races.find((r) => r.id === b.race_id); return ra.date.localeCompare(rb.date); })[0];
              if (!nextEntry) return null;
              const race = races.find((r) => r.id === nextEntry.race_id);
              const days = daysUntil(race.date);
              return (
                <div onClick={() => openRace(race.id)} style={{ background:"#fff",border:"1px solid #EDECE6",borderRadius:14,padding:"20px",marginBottom:24,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:11,color:"#9B9B8E",marginBottom:3 }}>Neste løp</div>
                    <div style={{ fontSize:16,fontWeight:700 }}>{race.name}</div>
                    <div style={{ fontSize:12,color:"#9B9B8E",marginTop:2 }}>{formatDate(race.date)}{nextEntry.goal && ` · Mål: ${nextEntry.goal}`}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:28,fontWeight:800,color:"#2D5A3D",letterSpacing:"-1px" }}>{days}</div>
                    <div style={{ fontSize:11,color:"#9B9B8E" }}>{days===1?"dag":"dager"}</div>
                  </div>
                </div>
              );
            })()}

            {/* Add race panel */}
            {showAddRace && selectedProfile.id === userId && (
              <div style={{ background:"#fff",border:"1px solid #E2E0D8",borderRadius:14,padding:22,marginBottom:28,boxShadow:"0 4px 16px rgba(0,0,0,0.04)" }}>
                {!manualMode && !selectedExisting && <>
                  <input type="text" placeholder="Søk etter løp..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputS} autoFocus />
                  {searchQuery.length > 0 && <div style={{ marginTop:8 }}>{filteredRaces.length===0 ? <div style={{ fontSize:13,color:"#C4C3BB",padding:"8px 0" }}>Ingen treff</div> : filteredRaces.map((race) => { const already = myEntries.some((e) => e.race_id === race.id); return <div key={race.id} onClick={() => !already && setSelectedExisting(race)} style={{ padding:"12px 0",borderBottom:"1px solid #F0EFE9",cursor:already?"default":"pointer",opacity:already?0.35:1 }}><div style={{ fontWeight:600,fontSize:14 }}>{race.name} {already && <span style={{ fontWeight:400,fontSize:11,color:"#C4C3BB" }}>(allerede lagt til)</span>}</div><div style={{ fontSize:11,color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>; })}</div>}
                  <div style={{ display:"flex",gap:8,marginTop:14 }}><button onClick={() => setManualMode(true)} style={pillBtn(false,false)}>Finner ikke løpet? Legg til manuelt</button><button onClick={() => {setShowAddRace(false);setSearchQuery("");}} style={pillBtn(false,false)}>Avbryt</button></div>
                </>}
                {selectedExisting && <>
                  <div style={{ fontWeight:600,fontSize:15,marginBottom:4 }}>{selectedExisting.name}</div>
                  <div style={{ fontSize:12,color:"#9B9B8E",marginBottom:14 }}>{raceLocation(selectedExisting)} · {selectedExisting.distance} · {formatDate(selectedExisting.date)}</div>
                  <TP h={goalForExisting.h} m={goalForExisting.m} s={goalForExisting.s} onH={(v)=>setGoalForExisting({...goalForExisting,h:v})} onM={(v)=>setGoalForExisting({...goalForExisting,m:v})} onS={(v)=>setGoalForExisting({...goalForExisting,s:v})} />
                  <div style={{ display:"flex",gap:8,marginTop:14 }}><button onClick={addExistingRace} style={{...pillBtn(false,true),fontSize:13,padding:"9px 24px"}}>Legg til</button><button onClick={() => {setSelectedExisting(null);setGoalForExisting({h:0,m:0,s:0});}} style={pillBtn(false,false)}>Tilbake</button></div>
                </>}
                {manualMode && <>
                  <div style={{ fontSize:15,fontWeight:700,marginBottom:18 }}>Legg til nytt løp</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                    <div><label style={labelS}>Løpsnavn *</label><input type="text" placeholder="F.eks. Valencia Marathon" value={newRace.name} onChange={(e) => setNewRace({...newRace,name:e.target.value})} style={inputS} />
                      {getSuggestions(newRace.name).length > 0 && <div style={{ background:"#FFFBEB",border:"1px solid #E8DFB0",borderRadius:10,padding:"12px 14px",marginTop:8 }}><div style={{ fontSize:12,color:"#9B9B8E",marginBottom:6 }}>Mente du?</div>{getSuggestions(newRace.name).map((r) => <div key={r.id} onClick={() => {setManualMode(false);setSelectedExisting(r);setNewRace({name:"",location:"",date:"",distance:"",country:""});}} style={{ padding:"6px 0",cursor:"pointer",fontSize:14 }}><span style={{ fontWeight:600 }}>{r.name}</span><span style={{ fontSize:12,color:"#9B9B8E" }}> — {raceLocation(r)} · {formatDate(r.date)}</span></div>)}</div>}
                    </div>
                    <div style={{ display:"flex",gap:10 }}><div style={{ flex:1 }}><label style={labelS}>Sted *</label><input type="text" placeholder="By" value={newRace.location} onChange={(e) => setNewRace({...newRace,location:e.target.value})} style={inputS} /></div><div style={{ flex:1 }}><label style={labelS}>Land</label><input type="text" placeholder="Land" value={newRace.country} onChange={(e) => setNewRace({...newRace,country:e.target.value})} style={inputS} /></div></div>
                    <div style={{ display:"flex",gap:10 }}>
                      <div style={{ flex:1 }}><label style={labelS}>Dato *</label><input type="date" value={newRace.date} onChange={(e) => setNewRace({...newRace,date:e.target.value})} style={inputS} /></div>
                      <div style={{ flex:1 }}><label style={labelS}>Distanse *</label>
                        <select value={["5 km","10 km","21.0975 km","42.195 km"].includes(newRace.distance)?newRace.distance:"annet"} onChange={(e)=>{if(e.target.value==="annet")setNewRace({...newRace,distance:""});else setNewRace({...newRace,distance:e.target.value});}} style={selectS}><option value="annet">Annen distanse</option><option value="5 km">5 km</option><option value="10 km">10 km</option><option value="21.0975 km">Halvmaraton</option><option value="42.195 km">Maraton</option></select>
                        {!["5 km","10 km","21.0975 km","42.195 km"].includes(newRace.distance) && <input type="text" placeholder="F.eks. 15 km" value={newRace.distance} onChange={(e) => setNewRace({...newRace,distance:e.target.value})} style={{...inputS,marginTop:8}} autoFocus />}
                      </div>
                    </div>
                    <TP h={newGoalH} m={newGoalM} s={newGoalS} onH={setNewGoalH} onM={setNewGoalM} onS={setNewGoalS} />
                  </div>
                  <div style={{ display:"flex",gap:8,marginTop:18 }}><button onClick={addManualRace} disabled={!newRace.name||!newRace.location||!newRace.date||!newRace.distance} style={{...pillBtn(false,true),fontSize:13,padding:"9px 24px",opacity:(!newRace.name||!newRace.location||!newRace.date||!newRace.distance)?0.35:1}}>Opprett og legg til</button><button onClick={() => {setManualMode(false);setNewRace({name:"",location:"",date:"",distance:"",country:""});setNewGoalH(0);setNewGoalM(0);setNewGoalS(0);}} style={pillBtn(false,false)}>Tilbake</button></div>
                </>}
              </div>
            )}

            {/* Season calendar */}
            {(() => {
              const profileEntries = entries.filter((e) => e.user_id === selectedProfile.id);
              const raceMonths = profileEntries.map((e) => { const r = races.find((r) => r.id === e.race_id); return r ? { month: new Date(r.date+"T00:00:00").getMonth(), race: r, entry: e, past: r.date < today } : null; }).filter(Boolean);
              if (raceMonths.length < 1) return null;
              const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
              const currentMonth = new Date().getMonth();
              return (
                <div style={{ marginBottom:28 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",padding:"0 2px" }}>
                    {months.map((m, i) => {
                      const monthRaces = raceMonths.filter((r) => r.month === i);
                      const hasFuture = monthRaces.some((r) => !r.past);
                      const hasPast = monthRaces.some((r) => r.past);
                      const isCurrent = i === currentMonth;
                      return (
                        <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1 }}>
                          {monthRaces.length > 0 && (
                            <div style={{ width:8,height:8,borderRadius:"50%",background:hasFuture?"#2D5A3D":hasPast?"#C4C3BB":"transparent" }} />
                          )}
                          {monthRaces.length === 0 && <div style={{ width:8,height:8 }} />}
                          <div style={{ fontSize:10,fontWeight:isCurrent?700:400,color:isCurrent?"#2D5A3D":"#C4C3BB" }}>{m}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ height:1,background:"#EDECE6",marginTop:8 }} />
                </div>
              );
            })()}

            {/* Planned races */}
            <div>
              <h2 style={secTitle}>Planlagte løp</h2>
              {entries.filter((e) => e.user_id===selectedProfile.id && races.find((r) => r.id===e.race_id)?.date >= today).length === 0 ? <div style={{ fontSize:13,color:"#C4C3BB" }}>Ingen planlagte løp ennå</div> : (
                <div>{[...entries.filter((e) => e.user_id===selectedProfile.id)].filter((e) => { const r = races.find((r) => r.id===e.race_id); return r&&r.date>=today; }).sort((a,b) => { const ra=races.find((r)=>r.id===a.race_id); const rb=races.find((r)=>r.id===b.race_id); return ra.date.localeCompare(rb.date); }).map((entry) => {
                  const race = races.find((r) => r.id===entry.race_id); if (!race) return null; const isMe = selectedProfile.id===userId;
                  return <div key={entry.id} style={{ padding:"16px 0",borderBottom:"1px solid #EDECE6" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div onClick={() => openRace(race.id)} style={{ cursor:"pointer" }}><div style={{ fontWeight:600,fontSize:15,marginBottom:3,letterSpacing:"-0.2px" }}>{race.name}</div><div style={{ fontSize:12,color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div></div>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        {editingGoalEntryId!==entry.id && entry.goal && <span onClick={() => isMe&&startEditGoal(entry)} style={{ fontSize:12,fontWeight:500,color:"#2D5A3D",background:"#EFF5F0",padding:"4px 10px",borderRadius:12,cursor:isMe?"pointer":"default" }}>{entry.goal}</span>}
                        {editingGoalEntryId!==entry.id && !entry.goal && isMe && <span onClick={() => startEditGoal(entry)} style={{ fontSize:11,color:"#9B9B8E",cursor:"pointer" }}>+ mål</span>}
                      </div>
                    </div>
                    {editingGoalEntryId===entry.id && isMe && <div style={{ marginTop:10 }}><TP h={editGoalH} m={editGoalM} s={editGoalS} onH={setEditGoalH} onM={setEditGoalM} onS={setEditGoalS} label="Endre målsetning" /><div style={{ display:"flex",gap:8,marginTop:8 }}><button onClick={() => updateGoal(entry.id)} style={{...pillBtn(false,true),padding:"5px 14px",fontSize:11}}>Lagre</button><button onClick={() => setEditingGoalEntryId(null)} style={{...pillBtn(false,false),padding:"5px 14px",fontSize:11}}>Avbryt</button></div></div>}
                    {isMe && editingGoalEntryId!==entry.id && <div style={{ marginTop:6 }}><span onClick={() => removeEntry(race.id)} style={{ fontSize:11,color:"#9B9B8E",cursor:"pointer" }}>Fjern fra listen</span></div>}
                  </div>;
                })}</div>
              )}
            </div>

            {/* Completed with result times */}
            {(() => { const c = entries.filter((e) => e.user_id===selectedProfile.id && races.find((r) => r.id===e.race_id)?.date < today); if (!c.length) return null; const isMe = selectedProfile.id===userId; return <div style={{ marginTop:36 }}><h2 style={secTitle}>Gjennomført</h2><div>{c.sort((a,b)=>{const ra=races.find((r)=>r.id===a.race_id);const rb=races.find((r)=>r.id===b.race_id);return rb.date.localeCompare(ra.date);}).map((entry) => { const race=races.find((r)=>r.id===entry.race_id);if(!race) return null; return <div key={entry.id} style={{ padding:"16px 0",borderBottom:"1px solid #EDECE6" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div onClick={()=>openRace(race.id)} style={{ cursor:"pointer" }}>
                  <div style={{ fontWeight:600,fontSize:15,marginBottom:3 }}>{race.name}</div>
                  <div style={{ fontSize:12,color:"#9B9B8E" }}>{raceLocation(race)} · {race.distance} · {formatDate(race.date)}</div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  {editingResultId!==entry.id && entry.result && <span style={{ fontSize:13,fontWeight:600,color:"#2D5A3D",background:"#EFF5F0",padding:"4px 12px",borderRadius:12 }}>{entry.result}</span>}
                  {editingResultId!==entry.id && !entry.result && isMe && <span onClick={()=>startEditResult(entry)} style={{ fontSize:11,color:"#9B9B8E",cursor:"pointer" }}>+ sluttid</span>}
                  {!isMe && !entry.result && <span style={{ fontSize:11,color:"#C4C3BB" }}>✓</span>}
                </div>
              </div>
              {editingResultId===entry.id && isMe && <div style={{ marginTop:10 }}>
                <TP h={resultH} m={resultM} s={resultS} onH={setResultH} onM={setResultM} onS={setResultS} label="Sluttid" />
                <div style={{ display:"flex",gap:8,marginTop:8 }}><button onClick={()=>updateResult(entry.id)} style={{...pillBtn(false,true),padding:"5px 14px",fontSize:11}}>Lagre</button><button onClick={()=>setEditingResultId(null)} style={{...pillBtn(false,false),padding:"5px 14px",fontSize:11}}>Avbryt</button></div>
              </div>}
              {isMe && editingResultId!==entry.id && entry.result && <div style={{ marginTop:4 }}><span onClick={()=>startEditResult(entry)} style={{ fontSize:11,color:"#9B9B8E",cursor:"pointer" }}>Endre sluttid</span></div>}
            </div>; })}</div></div>; })()}

            {/* Following */}
            {selectedProfile.id===userId && followingIds.length>0 && <div style={{ marginTop:36 }}><h2 style={secTitle}>Følger</h2><div>{profiles.filter((p) => followingIds.includes(p.id)).map((p) => <div key={p.id} style={{ padding:"16px 0",borderBottom:"1px solid #EDECE6",display:"flex",justifyContent:"space-between",alignItems:"center" }}><div onClick={() => openProfile(p)} style={{ cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}><Av p={p} /><div><div style={{ fontWeight:600,fontSize:15,letterSpacing:"-0.2px" }}>{fullName(p)}</div><div style={{ fontSize:12,color:"#9B9B8E" }}>{p.city}</div></div></div><button onClick={(e)=>{e.stopPropagation();toggleFollow(p.id);}} style={pillBtn(true,true)}>Følger</button></div>)}</div></div>}

            {/* Settings */}
            {selectedProfile.id===userId && (
              <div style={{ marginTop:48 }}>
                <button onClick={() => setShowSettings(!showSettings)} style={{ fontSize:12,color:"#9B9B8E",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'DM Sans',sans-serif",fontWeight:500 }}>{showSettings ? "Skjul innstillinger" : "Innstillinger"}</button>
                {showSettings && <div style={{ marginTop:20,display:"flex",flexDirection:"column",gap:24 }}>
                  {settingsMessage && <div style={{ fontSize:12,color:"#2D5A3D",background:"#EFF5F0",padding:"10px 14px",borderRadius:10 }}>{settingsMessage}</div>}
                  <div><div style={{ fontSize:13,fontWeight:600,color:"#7A7A6E",marginBottom:8 }}>Endre fylke</div>{!editingFylke ? <div style={{ display:"flex",alignItems:"center",gap:12 }}><span style={{ fontSize:14 }}>{profile.city}</span><button onClick={()=>{setEditingFylke(true);setEditFylke(profile.city);}} style={{...pillBtn(false,false),padding:"4px 14px",fontSize:11}}>Endre</button></div> : <div style={{ display:"flex",gap:8 }}><select value={editFylke} onChange={(e)=>setEditFylke(e.target.value)} style={{...selectS,flex:1}}><option value="">Velg fylke</option>{FYLKER.map((f)=><option key={f} value={f}>{f}</option>)}</select><button onClick={updateFylke} style={{...pillBtn(false,true),padding:"7px 16px"}}>Lagre</button><button onClick={()=>setEditingFylke(false)} style={{...pillBtn(false,false),padding:"7px 16px"}}>Avbryt</button></div>}</div>
                  <div><div style={{ fontSize:13,fontWeight:600,color:"#7A7A6E",marginBottom:8 }}>Endre passord</div>{!changingPassword ? <button onClick={()=>setChangingPassword(true)} style={{...pillBtn(false,false),padding:"4px 14px",fontSize:11}}>Endre passord</button> : <div style={{ display:"flex",gap:8 }}><input type="password" placeholder="Nytt passord (min. 6 tegn)" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} style={{...inputS,flex:1}} autoFocus /><button onClick={changePassword} style={{...pillBtn(false,true),padding:"7px 16px"}}>Lagre</button><button onClick={()=>{setChangingPassword(false);setNewPassword("");}} style={{...pillBtn(false,false),padding:"7px 16px"}}>Avbryt</button></div>}</div>
                  <div><div style={{ fontSize:13,fontWeight:600,color:"#7A7A6E",marginBottom:8 }}>Slett konto</div>{!showDeleteConfirm ? <button onClick={()=>setShowDeleteConfirm(true)} style={{ fontSize:11,color:"#C53030",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline",padding:0 }}>Slett kontoen min permanent</button> : <div style={{ background:"#FFF5F5",border:"1px solid #FED7D7",borderRadius:10,padding:18 }}><div style={{ fontSize:13,fontWeight:600,color:"#C53030",marginBottom:8 }}>Er du sikker?</div><div style={{ fontSize:12,color:"#7A7A6E",marginBottom:14 }}>Alle dine data slettes permanent.</div><div style={{ display:"flex",gap:8 }}><button onClick={deleteAccount} style={{ fontFamily:"'DM Sans',sans-serif",fontSize:12,padding:"7px 18px",borderRadius:20,border:"1px solid #C53030",background:"#C53030",color:"#fff",cursor:"pointer" }}>Ja, slett kontoen</button><button onClick={()=>setShowDeleteConfirm(false)} style={pillBtn(false,false)}>Avbryt</button></div></div>}</div>
                  <div style={{ paddingTop:8 }}><button onClick={handleLogout} style={{ fontSize:12,color:"#9B9B8E",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'DM Sans',sans-serif" }}>Logg ut</button></div>
                </div>}
                {!showSettings && <div style={{ marginTop:12 }}><button onClick={handleLogout} style={{ fontSize:12,color:"#9B9B8E",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'DM Sans',sans-serif" }}>Logg ut</button></div>}
              </div>
            )}
          </div>
        )}

        {/* ═══ RACE DETAIL ═══ */}
        {view === "race" && selectedRace && (
          <div style={{ padding:"36px 0 60px" }}>
            <div onClick={goRaces} style={{ fontSize:13,color:"#9B9B8E",cursor:"pointer",marginBottom:28,fontWeight:500 }}>← Tilbake</div>
            <h1 style={{ fontSize:26,fontWeight:800,margin:"0 0 6px",letterSpacing:"-0.5px" }}>{selectedRace.name}</h1>
            <div style={{ fontSize:14,color:"#9B9B8E",marginBottom:selectedRace.user_created?8:8 }}>{raceLocation(selectedRace)} · {selectedRace.distance} · {formatDate(selectedRace.date)}</div>
            {selectedRace.user_created && <div style={{ fontSize:11,color:"#C4C3BB",marginBottom:8 }}>Lagt til av bruker — verifiser dato hos arrangør</div>}
            <div style={{ fontSize:12,color:"#C4C3BB",marginBottom:20 }}>{entries.filter((e)=>e.race_id===selectedRace.id).length} løpere registrert</div>

            {!myEntries.some((e) => e.race_id===selectedRace.id) ? (
              <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:28 }}>
                <button onClick={() => addRaceToMyList(selectedRace.id)} style={{ fontSize:13,fontWeight:600,padding:"9px 24px",borderRadius:22,border:"none",background:"#2D5A3D",color:"#fff",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 2px 8px rgba(45,90,61,0.2)" }}>+ Legg til i mine løp</button>
                <span onClick={()=>{const url="https://startlista.no";const text=`Skal du løpe ${selectedRace.name}? Se hvem som er påmeldt og har samme målsetning som deg på startlista.no`;if(navigator.share){navigator.share({title:selectedRace.name,text,url})}else{navigator.clipboard.writeText(text);alert("Tekst kopiert!")}}} style={{ fontSize:12,color:"#2D5A3D",cursor:"pointer",fontWeight:500 }}>Del løpet →</span>
              </div>
            ) : (
              <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:28 }}>
                <span style={{ fontSize:12,color:"#9B9B8E" }}>✓ Lagt til i dine løp</span>
                <span onClick={()=>{const url="https://startlista.no";const text=`Skal du løpe ${selectedRace.name}? Se hvem som er påmeldt og har samme målsetning som deg på startlista.no`;if(navigator.share){navigator.share({title:selectedRace.name,text,url})}else{navigator.clipboard.writeText(text);alert("Tekst kopiert!")}}} style={{ fontSize:12,color:"#2D5A3D",cursor:"pointer",fontWeight:500 }}>Del løpet →</span>
              </div>
            )}

            {/* Tempo groups */}
            {(() => {
              const re = entries.filter((e) => e.race_id===selectedRace.id);
              const tg = getTempoGroups(re, selectedRace.distance);
              if (!tg.length) return null;
              return (
                <div style={{ marginBottom:24 }}>
                  <h2 style={{...secTitle,marginBottom:10}}>Tempogrupper</h2>
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    {tg.map((g) => (
                      <div key={g.label} style={{ background:"#fff",border:"1px solid #EDECE6",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ fontSize:13,fontWeight:600 }}>{g.label}</span>
                        <span style={{ fontSize:11,color:"#9B9B8E" }}>{g.count} {g.count===1?"løper":"løpere"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <h2 style={{...secTitle,marginBottom:0}}>Påmeldte løpere</h2>
              <button onClick={() => setRaceSortByTime((v)=>!v)} style={{ fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:500,padding:"5px 12px",borderRadius:14,border:"1px solid #E2E0D8",background:raceSortByTime?"#2D5A3D":"transparent",color:raceSortByTime?"#fff":"#9B9B8E",cursor:"pointer" }}>{raceSortByTime ? "Sortert etter tid" : "Sorter etter tid"}</button>
            </div>
            {(() => {
              const re = entries.filter((e) => e.race_id===selectedRace.id);
              if (!re.length) return <div style={{ fontSize:13,color:"#C4C3BB" }}>Ingen registrerte løpere ennå</div>;
              let sorted;
              if (raceSortByTime) { sorted = [...re].sort((a,b)=>{const sa=parseGoalSeconds(a.goal);const sb=parseGoalSeconds(b.goal);if(sa&&sb) return sa-sb;if(sa) return -1;if(sb) return 1;return 0;}); }
              else { const fe=re.filter((e)=>followingIds.includes(e.user_id)||e.user_id===userId); const oe=re.filter((e)=>!followingIds.includes(e.user_id)&&e.user_id!==userId); sorted=[...fe,...oe]; }
              return <div>{sorted.map((entry) => {
                const p = profiles.find((pr) => pr.id===entry.user_id); if (!p) return null; const isMe = p.id===userId;
                return <div key={p.id} style={{ padding:"16px 0",borderBottom:"1px solid #EDECE6",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div onClick={()=>openProfile(p)} style={{ cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}><Av p={p} /><div><div style={{ fontWeight:600,fontSize:15,letterSpacing:"-0.2px" }}>{fullName(p)} {isMe&&<span style={{ fontWeight:400,color:"#C4C3BB" }}>(deg)</span>}</div><div style={{ fontSize:12,color:"#9B9B8E" }}>{p.city}{entry.goal&&` · Mål: ${entry.goal}`}</div></div></div>
                  {!isMe && <span style={{ color:"#D4D3CC",fontSize:16,cursor:"pointer" }} onClick={()=>openProfile(p)}>›</span>}
                </div>;
              })}</div>;
            })()}
          </div>
        )}
      </main>

      <footer style={{ padding:"24px",textAlign:"center",fontSize:11,color:"#C4C3BB",borderTop:"1px solid #EDECE6" }}>
        <div>startlista · laget for løpere som vil finne hverandre</div>
        <div style={{ marginTop:6 }}><a href="/personvern" style={{ color:"#C4C3BB",textDecoration:"underline" }}>Personvern</a></div>
      </footer>
    </div>
  );
}
