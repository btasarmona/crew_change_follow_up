// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Ship, LayoutDashboard, FileCheck, Star, Settings, 
  MessageCircle, AlertTriangle, Calendar, Plus, X, Search, 
  ChevronRight, ChevronDown, ChevronUp, UserCheck, 
  Archive, Edit2, LogOut, UserPlus, Trash2, Filter, Info, RotateCcw, Download,
  getScoreColor, Briefcase
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const customFirebaseConfig = {
  apiKey: "AIzaSyDob7zaTPNIDBgoMH9WBiEBSBp91atzJDA",
  authDomain: "armona-crew-manager.firebaseapp.com",
  projectId: "armona-crew-manager",
  storageBucket: "armona-crew-manager.firebasestorage.app",
  messagingSenderId: "916422821733",
  appId: "1:916422821733:web:ffeef86ed539928cca838c"
};

// Güvenli başlatma (Çift 'const' çakışmasını ve derleme hatalarını önler)
let firebaseConfigObj = customFirebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfigObj = JSON.parse(__firebase_config);
  }
} catch (err) {
  console.warn("Using local firebase config.");
}

const app = initializeApp(firebaseConfigObj);
const auth = getAuth(app);
const db = getFirestore(app);

// Firestore Collections Path (Canvas uyumluluğu için)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'armona-crew-manager';
const getPath = (col) => typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/${col}` : col;

// --- CUSTOM LOGO COMPONENT ---
const ArmonaLogo = ({ className = "w-8 h-8" }) => (
  <img 
    src="https://www.atlantis-tankers.com/assets/images/logo.png" 
    alt="Armona Crew Manager Logo" 
    className={`${className} object-contain`}
  />
);

const generateId = () => Math.random().toString(36).substr(2, 9);
const today = new Date(); // Gerçek zamanlı güncellenir

// --- YENİ ROLLER VE RENK ŞEMASI ---
const JOB_TITLES = ['Admin', 'Crew Manager', 'Welfare Officer', 'Marine S.I.', 'Tech S.I.', 'Tech. Manager', 'DPA', 'Marine Manager', 'CTO', 'Other'];

const getScoreColor = (score) => {
  if (!score && score !== 0) return 'text-slate-600 bg-slate-100';
  const s = Number(score);
  if (s < 60) return 'text-white bg-red-500';
  if (s <= 75) return 'text-white bg-orange-500';
  if (s <= 85) return 'text-slate-800 bg-yellow-400';
  return 'text-white bg-green-500';
};

// --- SEED DATA FOR FIRST RUN ---
const SEED_DATA = {
  matrix: [
    { id: 'm1', rank: 'Master', dept: 'Deck', checkOverlap: true, competencies: ['Master Mariner', 'Chief Mate'] },
    { id: 'm2', rank: 'Chief Officer', dept: 'Deck', checkOverlap: true, competencies: ['Master Mariner', 'Chief Mate', 'OOW (Deck)'] },
    { id: 'm3', rank: 'Second Officer', dept: 'Deck', checkOverlap: true, competencies: ['OOW (Deck)'] },
    { id: 'm4', rank: 'Chief Engineer', dept: 'Engine', checkOverlap: true, competencies: ['Chief Engineer Unlimited'] },
    { id: 'm5', rank: 'Second Engineer', dept: 'Engine', checkOverlap: true, competencies: ['Chief Engineer Unlimited', 'Second Engineer Unlimited'] },
    { id: 'm6', rank: 'Bosun', dept: 'Deck', checkOverlap: false, competencies: ['Able Seafarer Deck'] },
    { id: 'm7', rank: 'AB', dept: 'Deck', checkOverlap: false, competencies: ['Able Seafarer Deck', 'Navigational Watch'] },
    { id: 'm8', rank: 'Oiler', dept: 'Engine', checkOverlap: false, competencies: ['Able Seafarer Engine'] },
    { id: 'm9', rank: 'Cook', dept: 'Other', checkOverlap: true, competencies: ['Ship Cook Certificate'] },
    { id: 'm10', rank: 'Wiper', dept: 'Engine', checkOverlap: false, competencies: ['Engine Watch Rating'] }
  ],
  ships: [
    { id: 's1', name: 'MT Alpha', flag: 'Panama', minSafeManning: 12, cabinCapacity: 15, lsaCapacity: 18, color: 'blue', notes: [] },
    { id: 's2', name: 'MV Beta', flag: 'Liberia', minSafeManning: 14, cabinCapacity: 16, lsaCapacity: 20, color: 'emerald', notes: [] }
  ],
  schema: [
    { id: 'ps1', name: 'Endorse Check', type: 'checkbox', appliesTo: 'onsigner' },
    { id: 'ps2', name: 'Med. Fitness', type: 'date', appliesTo: 'onsigner' },
    { id: 'ps3', name: 'Handover Doc', type: 'checkbox', appliesTo: 'offsigner' },
  ],
  procedures: [
    { id: 'p1', crewId: 'c100', crewName: 'Test Master', rank: 'Master', dept: 'Deck', shipName: 'MT Alpha', type: 'offsigner', date: today.toISOString().split('T')[0], status: 'active', evaluationDone: false, debriefDone: false, dynamicData: {}, notes: [], evalSnapshot: [{name: 'Test AB', rank: 'AB', score:''}] }
  ],
  evaluations: [
    { id: 'e1', crewName: 'Test AB', rank: 'AB', shipName: 'MT Alpha', date: today.toISOString().split('T')[0], score: 85, evaluatedBy: 'Test Master' }
  ],
  debriefings: [
    { id: 'd1', crewName: 'Test Chief', shipName: 'MV Beta', rank: 'Chief Officer', signOffDate: today.toISOString().split('T')[0], startDate: today.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0], status: 'active', depts: [{name:'Deck', note:'Good performance.', score:'88'},{name:'Engine', note:'', score:''},{name:'Safety', note:'', score:''},{name:'HR', note:'', score:''}] }
  ]
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('armonaCurrentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Realtime Firebase States
  const [ships, setShips] = useState([]);
  const [crew, setCrew] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [procSchema, setProcSchema] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [debriefings, setDebriefings] = useState([]);
  const [users, setUsers] = useState([]);

  const [promoMatrix, setPromoMatrix] = useState([]); 
  const [promotions, setPromotions] = useState([]);

  const [evalPrefill, setEvalPrefill] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(true);

  // Modal States
  const [lineupModal, setLineupModal] = useState({ isOpen: false, shipId: null });
  const [notesModal, setNotesModal] = useState({ isOpen: false, targetId: null, targetType: null, targetName: '' });
  const [assignModal, setAssignModal] = useState({ isOpen: false, crew: null });
  const [signOffModal, setSignOffModal] = useState({ isOpen: false, crew: null });
  const [crewFormModal, setCrewFormModal] = useState({ isOpen: false, crew: null });
  const [editContractModal, setEditContractModal] = useState({ isOpen: false, crew: null });
  const [deleteWarnModal, setDeleteWarnModal] = useState({ isOpen: false, message: '', crewId: null });

  // --- FIREBASE INITIALIZATION & SUBSCRIPTIONS ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
           await signInWithCustomToken(auth, __initial_auth_token);
        } else {
           await signInAnonymously(auth);
        }
      } catch (err) { console.error("Firebase Auth Error:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setFbUser);
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const unsubPromos = onSnapshot(collection(db, getPath('promotions')), snap => setPromotions(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubShips = onSnapshot(collection(db, getPath('ships')), snap => setShips(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubCrew = onSnapshot(collection(db, getPath('crew')), snap => setCrew(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubProcs = onSnapshot(collection(db, getPath('procedures')), snap => setProcedures(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubEvals = onSnapshot(collection(db, getPath('evaluations')), snap => setEvaluations(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubDebriefs = onSnapshot(collection(db, getPath('debriefings')), snap => setDebriefings(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubUsers = onSnapshot(collection(db, getPath('appUsers')), snap => {
      setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
      setIsDbLoading(false);
    }, console.error);

    const unsubMatrix = onSnapshot(doc(db, getPath('settings'), 'rank_matrix'), snap => {
      if(snap.exists()) setMatrix(snap.data().items || []);
    }, console.error);
    
    const unsubSchema = onSnapshot(doc(db, getPath('settings'), 'proc_schema'), snap => {
      if(snap.exists()) setProcSchema(snap.data().items || []);
    }, console.error);
    const unsubPromoMat = onSnapshot(doc(db, getPath('settings'), 'promo_matrix'), snap => {
      if(snap.exists()) setPromoMatrix(snap.data().items || []);
    }, console.error);

    return () => { unsubShips(); unsubCrew(); unsubProcs(); unsubEvals(); unsubDebriefs(); unsubPromos(); unsubUsers(); unsubMatrix(); unsubSchema(); unsubPromoMat(); };
  }, [fbUser]);

  // --- FIREBASE ACTIONS ---
  
  const handleSeedDatabase = async () => {
    setIsDbLoading(true);
    try {
      // 1. ESKİ VERİLERİ TEMİZLE (Factory Reset)
      const collectionsToClear = ['ships', 'crew', 'procedures', 'evaluations', 'debriefings', 'appUsers'];
      for (const colName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, getPath(colName)));
        for (const document of querySnapshot.docs) {
          await deleteDoc(doc(db, getPath(colName), document.id));
        }
      }

      // 2. YENİ BAŞLANGIÇ VERİLERİNİ YAZ
      await setDoc(doc(db, getPath('appUsers'), 'u1'), { username: 'Admin', password: 'Bt.admin.86!', role: 'admin' });
      await setDoc(doc(db, getPath('settings'), 'rank_matrix'), { items: SEED_DATA.matrix });
      await setDoc(doc(db, getPath('settings'), 'proc_schema'), { items: SEED_DATA.schema });
      for (let s of SEED_DATA.ships) await setDoc(doc(db, getPath('ships'), s.id), s);
      for (let p of SEED_DATA.procedures) await setDoc(doc(db, getPath('procedures'), p.id), p);
      for (let e of SEED_DATA.evaluations) await setDoc(doc(db, getPath('evaluations'), e.id), e);
      for (let d of SEED_DATA.debriefings) await setDoc(doc(db, getPath('debriefings'), d.id), d);
      
      setIsDbLoading(false);
      return { success: true };
    } catch(err) {
      console.error("Database seed error:", err);
      setIsDbLoading(false);
      return { success: false, error: err.message };
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('armonaCurrentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('armonaCurrentUser');
  };

  const getDaysBetween = (d1, d2) => Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
  
  const handleAddNote = async (targetId, targetType, text) => {
    const note = { id: generateId(), author: currentUser.username, text, date: new Date().toISOString() };
    const collectionName = targetType === 'ship' ? 'ships' : 'crew';
    const existing = (targetType === 'ship' ? ships : crew).find(x => x.id === targetId);
    if(existing) {
      await updateDoc(doc(db, getPath(collectionName), targetId), { notes: [...(existing.notes || []), note] });
    }
  };

  const handleDeleteNote = async (targetId, targetType, noteId) => {
    const collectionName = targetType === 'ship' ? 'ships' : 'crew';
    const existing = (targetType === 'ship' ? ships : crew).find(x => x.id === targetId);
    if(existing) {
      await updateDoc(doc(db, getPath(collectionName), targetId), { notes: existing.notes.filter(n => n.id !== noteId) });
    }
  };

  const handleAssign = async (shipId, rank, startDate, endDate, handleOverlap, addToProc, assignCrewMember) => {
    if (!assignCrewMember) return;
    if (handleOverlap === 'relieve') {
      const existing = crew.find(c => c.shipId === shipId && c.rank === rank && c.status === 'onboard');
      if (existing) { 
        await updateDoc(doc(db, getPath('crew'), existing.id), { status: 'onleave', shipId: null });
      }
    }

    await updateDoc(doc(db, getPath('crew'), assignCrewMember.id), { 
      status: 'onboard', shipId, rank, contractStart: startDate, contractEnd: endDate 
    });
    
    if (addToProc) {
       const shipName = ships.find(s => s.id === shipId)?.name;
       const rankInfo = matrix.find(m => m.rank === rank);
       const dept = rankInfo ? rankInfo.dept : 'Other';

       const newProcId = generateId();
       await setDoc(doc(db, getPath('procedures'), newProcId), {
          crewId: assignCrewMember.id, crewName: assignCrewMember.name, rank: rank, dept: dept, shipName: shipName,
          type: 'onsigner', date: startDate, status: 'active', evaluationDone: false, debriefDone: false, 
          dynamicData: {}, notes: []
        });
    }
    setAssignModal({ isOpen: false, crew: null });
  };

  const handleSignOff = async (date, addToProc, crewMember) => {
    if (!crewMember) return;
    await updateDoc(doc(db, getPath('crew'), crewMember.id), { status: 'onleave', shipId: null, contractStart: '', contractEnd: '' });
    
    let snapshotData = null;
    const rankInfo = matrix.find(m => m.rank === crewMember.rank);
    const dept = rankInfo ? rankInfo.dept : 'Other';
    
    if (['Master', 'Chief Engineer'].includes(crewMember.rank)) {
      snapshotData = crew.filter(c => 
        c.shipId === crewMember.shipId && c.id !== crewMember.id && c.contractStart && new Date(c.contractStart).getTime() <= today.getTime() && matrix.find(m => m.rank === c.rank)?.dept === dept
      ).map(c => ({ name: c.name, rank: c.rank, score: '' }));
    } else {
      const managerRank = dept === 'Engine' ? 'Chief Engineer' : 'Master';
      const manager = crew.find(c => c.shipId === crewMember.shipId && c.rank === managerRank && c.contractStart && new Date(c.contractStart).getTime() <= today.getTime());
      snapshotData = manager ? manager.name : 'Office (No Manager found)';
    }

    if (addToProc) {
      const newProcId = generateId();
      await setDoc(doc(db, getPath('procedures'), newProcId), {
        crewId: crewMember.id, crewName: crewMember.name, rank: crewMember.rank, dept: dept, shipName: ships.find(s=>s.id===crewMember.shipId)?.name,
        type: 'offsigner', date: date, status: 'active', evaluationDone: false, debriefDone: false, 
        dynamicData: {}, notes: [], evalSnapshot: snapshotData
      });
    }
    setSignOffModal({ isOpen: false, crew: null });
  };

  const attemptDeleteCrew = (c) => {
    if (c.shipId || (c.contractStart && new Date(c.contractStart).getTime() > today.getTime())) {
      setDeleteWarnModal({ isOpen: true, message: `Cannot delete ${c.name}. They are assigned to a vessel or have a planned contract. Sign them off first.`, crewId: null });
    } else {
      setDeleteWarnModal({ isOpen: true, message: `Are you sure you want to permanently delete ${c.name}?`, crewId: c.id });
    }
  };

  // Export to Excel Helper
  const exportToCSV = (data, filename) => {
    if(data.length === 0) return;
    const separator = ',';
    const keys = Object.keys(data[0]);
    
    const csvContent = [
      keys.join(separator),
      ...data.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k];
          cell = String(cell).replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) { cell = `"${cell}"`; }
          return cell;
        }).join(separator);
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LOGIN & LOADING CHECK ---
  if (isDbLoading && fbUser) {
    return <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">Loading database...</div>;
  }

  if (!currentUser) {
    return <Login users={users} onLogin={handleLogin} isDbEmpty={users.length === 0} onSeed={handleSeedDatabase} />;
  }

  const activeDebriefsCount = debriefings.filter(d => d.status === 'active').length;

  return (
    <div className="flex flex-col h-screen bg-[#f1f5f9] text-slate-800 font-sans">
      {/* Top Navbar */}
      <header className="bg-[#0f172a] text-white px-6 py-3 flex justify-between items-center shadow-md z-10 shrink-0">
        <div className="font-bold text-lg flex items-center gap-3 tracking-wide w-72">
          <ArmonaLogo className="w-7 h-7" />
          ARMONA CREW MANAGER
        </div>
        
        <nav className="flex-1 flex justify-center items-center gap-2 overflow-x-auto mx-4">
          <TopNavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          {currentUser.role !== 'viewer' && <TopNavItem icon={<FileCheck />} label="Procedures" active={activeTab === 'procedures'} onClick={() => setActiveTab('procedures')} />}
          <TopNavItem icon={<Star />} label="Eval Overview" active={activeTab === 'eval_overview'} onClick={() => setActiveTab('eval_overview')} />
          {currentUser.role !== 'viewer' && <TopNavItem icon={<Plus />} label="Add Eval" active={activeTab === 'eval_add'} onClick={() => setActiveTab('eval_add')} />}
          <TopNavItem icon={<UserCheck />} label="Debriefings" active={activeTab === 'debriefings'} onClick={() => setActiveTab('debriefings')} badge={activeDebriefsCount} />
          <TopNavItem icon={<Briefcase />} label="Promo & Recruit" active={activeTab === 'promotions'} onClick={() => setActiveTab('promotions')} />
          {currentUser.role === 'admin' && <TopNavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}        </nav>

        <div className="flex items-center gap-4 border-l border-slate-700 pl-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>Hi, <strong className="text-white">{currentUser.username}</strong></span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-400">{currentUser.role}</span>
          </div>
          <LogOut size={18} className="text-slate-400 hover:text-red-400 cursor-pointer" onClick={handleLogout} title="Sign Out" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <main className="absolute inset-0 overflow-y-auto p-4 md:p-6">
          {activeTab === 'dashboard' && (
            <Dashboard 
              ships={ships} crew={crew} matrix={matrix} currentUser={currentUser} today={today}
              onOpenLineup={(shipId) => setLineupModal({ isOpen: true, shipId })}
              onOpenNotes={(id, type, name) => setNotesModal({ isOpen: true, targetId: id, targetType: type, targetName: name })}
              onAssign={(c) => setAssignModal({ isOpen: true, crew: c })}
              onAddCrew={() => setCrewFormModal({ isOpen: true, crew: null })}
              onEditCrew={(c) => setCrewFormModal({ isOpen: true, crew: c })}
              onDeleteCrew={attemptDeleteCrew}
            />
          )}
          {activeTab === 'procedures' && currentUser.role !== 'viewer' && (
            <Procedures 
              procedures={procedures} schema={procSchema} currentUser={currentUser}
              onUpdateProc={async (id, field, val) => await updateDoc(doc(db, getPath('procedures'), id), { [field]: val })}
              onUpdateDynamic={async (id, field, val) => {
                 const p = procedures.find(x=>x.id === id);
                 if(p) await updateDoc(doc(db, getPath('procedures'), id), { dynamicData: {...p.dynamicData, [field]: val} });
              }}
              onDeleteProc={async (id) => await deleteDoc(doc(db, getPath('procedures'), id))}
              onAddEval={async (proc) => { 
                setEvalPrefill(proc); 
                setActiveTab('eval_add'); 
                await updateDoc(doc(db, getPath('procedures'), proc.id), { evaluationDone: true });
              }}
              onAddDebrief={async (proc) => {
                const newDebrief = { 
                  crewName: proc.crewName, shipName: proc.shipName, rank: proc.rank, 
                  signOffDate: proc.date, startDate: '', endDate: '', status: 'active', 
                  depts: [{name:'Deck', note:'', score:''},{name:'Engine', note:'', score:''},{name:'Safety', note:'', score:''},{name:'HR', note:'', score:''}] 
                };
                await setDoc(doc(db, getPath('debriefings'), generateId()), newDebrief);
                await updateDoc(doc(db, getPath('procedures'), proc.id), { debriefDone: true });
                setActiveTab('debriefings');
              }}
            />
          )}
          {activeTab === 'eval_overview' && (
             <EvaluationsOverview 
               evals={evaluations} ships={ships} matrix={matrix} currentUser={currentUser}
               onDelete={async (id) => await deleteDoc(doc(db, getPath('evaluations'), id))}
               exportToCSV={exportToCSV}
             />
          )}
          {activeTab === 'eval_add' && currentUser.role !== 'viewer' && (
            <EvaluationsAdd 
              currentUser={currentUser} crew={crew} ships={ships} prefillData={evalPrefill} today={today}
              onAdd={async (newEvals) => { 
                 for(let e of newEvals) await setDoc(doc(db, getPath('evaluations'), e.id), e);
                 setEvalPrefill(null); setActiveTab('eval_overview'); 
              }}
              onClearPrefill={() => setEvalPrefill(null)}
            />
          )}
          
          {activeTab === 'promotions' && (
            <PromotionsRecruitment
              promotions={promotions} matrix={promoMatrix} ranks={matrix} currentUser={currentUser}
              onAdd={async (promo) => await setDoc(doc(db, getPath('promotions'), promo.id), promo)}
              onUpdate={async (id, field, val) => await updateDoc(doc(db, getPath('promotions'), id), { [field]: val })}
              onDelete={async (id) => await deleteDoc(doc(db, getPath('promotions'), id))}
              onUpdateStep={async (id, index, field, val) => {
                const p = promotions.find(x => x.id === id);
                if(p) {
                  const newSteps = [...p.steps];
                  newSteps[index] = { ...newSteps[index], [field]: val };
                  // Eğer bir adıma reject atılırsa (true), diğer adımların açık rejectlerini de temizleyelim (opsiyonel mantık ama faydalı)
                  await updateDoc(doc(db, getPath('promotions'), id), { steps: newSteps });
                }
              }}
            />
          )}
          
          {activeTab === 'debriefings' && (
             <Debriefings 
               debriefings={debriefings} currentUser={currentUser} exportToCSV={exportToCSV}
               ships={ships} matrix={matrix}
               onManualAdd={async (data) => {
                 const newDebrief = { 
                   crewName: data.crewName, shipName: data.shipName, rank: data.rank, 
                   signOffDate: data.signOffDate, startDate: '', endDate: '', status: 'active', 
                   depts: [{name:'Deck', note:'', score:''},{name:'Engine', note:'', score:''},{name:'Safety', note:'', score:''},{name:'HR', note:'', score:''}] 
                 };
                 await setDoc(doc(db, getPath('debriefings'), generateId()), newDebrief);
               }}
               onUpdate={async (id, field, val) => await updateDoc(doc(db, getPath('debriefings'), id), { [field]: val })}
               onDelete={async (id) => await deleteDoc(doc(db, getPath('debriefings'), id))}
               onUpdateDept={async (id, index, field, val) => {
                 const d = debriefings.find(x=>x.id === id);
                 if(d) {
                   const newDepts = [...d.depts]; newDepts[index] = { ...newDepts[index], [field]: val };
                   await updateDoc(doc(db, getPath('debriefings'), id), { depts: newDepts });
                 }
               }}
             />
          )}
{activeTab === 'settings' && currentUser.role === 'admin' && (
            <SettingsPage 
              matrix={matrix} setMatrix={async (nm) => await setDoc(doc(db, getPath('settings'), 'rank_matrix'), { items: nm })} 
              procSchema={procSchema} setProcSchema={async (ns) => await setDoc(doc(db, getPath('settings'), 'proc_schema'), { items: ns })} 
              promoMatrix={promoMatrix} setPromoMatrix={async (pm) => await setDoc(doc(db, getPath('settings'), 'promo_matrix'), { items: pm })}
              users={users}
              onAddUser={async (u) => await setDoc(doc(db, getPath('appUsers'), u.id), u)}
              onUpdateUser={async (u) => await updateDoc(doc(db, getPath('appUsers'), u.id), u)}
              onDeleteUser={async (id) => await deleteDoc(doc(db, getPath('appUsers'), id))}
              ships={ships} 
              onAddShip={async (s) => await setDoc(doc(db, getPath('ships'), s.id), s)}
              onUpdateShip={async (s) => await updateDoc(doc(db, getPath('ships'), s.id), s)}
              onDeleteShip={async (id) => await deleteDoc(doc(db, getPath('ships'), id))}
              currentUser={currentUser} setCurrentUser={handleLogin} 
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {lineupModal.isOpen && (
        <LineupModal 
          ship={ships.find(s => s.id === lineupModal.shipId)} crew={crew.filter(c => c.shipId === lineupModal.shipId)}
          matrix={matrix} currentUser={currentUser} today={today} getDaysBetween={getDaysBetween}
          onClose={() => setLineupModal({ isOpen: false, shipId: null })}
          onSignOff={(c) => setSignOffModal({ isOpen: true, crew: c })}
          onNotes={(id, name) => setNotesModal({ isOpen: true, targetId: id, targetType: 'crew', targetName: name })}
          onEditContract={(c) => setEditContractModal({ isOpen: true, crew: c })}
        />
      )}

      {notesModal.isOpen && (
        <NotesModal 
          isOpen={notesModal.isOpen} name={notesModal.targetName}
          notes={notesModal.targetType === 'ship' ? ships.find(s=>s.id === notesModal.targetId)?.notes || [] : crew.find(c=>c.id === notesModal.targetId)?.notes || []}
          onClose={() => setNotesModal({ isOpen: false, targetId: null, targetType: null })}
          onAdd={(txt) => handleAddNote(notesModal.targetId, notesModal.targetType, txt)}
          onDelete={(noteId) => handleDeleteNote(notesModal.targetId, notesModal.targetType, noteId)}
          currentUser={currentUser}
        />
      )}

      {assignModal.isOpen && (
        <AssignModal 
          crewMember={assignModal.crew} ships={ships} matrix={matrix} onboardCrew={crew.filter(c=>c.status==='onboard')} today={today}
          onClose={() => setAssignModal({ isOpen: false, crew: null })}
          onConfirm={(shipId, rank, startDate, endDate, handleOverlap, addToProc) => 
            handleAssign(shipId, rank, startDate, endDate, handleOverlap, addToProc, assignModal.crew)
          }
        />
      )}

      {crewFormModal.isOpen && (
        <CrewFormModal
          matrix={matrix} crewMember={crewFormModal.crew}
          onClose={() => setCrewFormModal({ isOpen: false, crew: null })}
          onConfirm={async (newCrewData) => {
            if (crewFormModal.crew) {
              await updateDoc(doc(db, getPath('crew'), crewFormModal.crew.id), newCrewData);
            } else {
              await setDoc(doc(db, getPath('crew'), generateId()), { ...newCrewData, status: 'onleave', shipId: null, contractStart: '', contractEnd: '', notes: [], isProbation: false, rank: 'TBA' });
            }
            setCrewFormModal({ isOpen: false, crew: null });
          }}
        />
      )}
      
      {editContractModal.isOpen && (
        <EditContractModal
           crewMember={editContractModal.crew}
           onClose={() => setEditContractModal({ isOpen: false, crew: null })}
           onConfirm={async (start, end) => {
             if(editContractModal.crew?.id) {
               await updateDoc(doc(db, getPath('crew'), editContractModal.crew.id), { contractStart: start, contractEnd: end });
             }
             setEditContractModal({ isOpen: false, crew: null });
           }}
        />
      )}

      {deleteWarnModal.isOpen && (
        <DeleteConfirmModal 
          message={deleteWarnModal.message} showConfirm={!!deleteWarnModal.crewId}
          onClose={() => setDeleteWarnModal({ isOpen: false, message: '', crewId: null })}
          onConfirm={async () => {
            if(deleteWarnModal.crewId) {
              await deleteDoc(doc(db, getPath('crew'), deleteWarnModal.crewId));
            }
            setDeleteWarnModal({ isOpen: false, message: '', crewId: null });
          }}
        />
      )}

      {signOffModal.isOpen && (
        <SignOffModal 
          crewMember={signOffModal.crew} today={today}
          onClose={() => setSignOffModal({ isOpen: false, crew: null })}
          onConfirm={(date, addToProc) => handleSignOff(date, addToProc, signOffModal.crew)}
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function TopNavItem({ icon, label, active, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm font-medium whitespace-nowrap
        ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      {React.cloneElement(icon, { size: 16 })} 
      {label}
      {badge > 0 && (
        <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}

function Dashboard({ ships, crew, matrix, currentUser, today, onOpenLineup, onOpenNotes, onAssign, onAddCrew, onEditCrew, onDeleteCrew }) {
  const expiredContracts = crew.filter(c => c.status === 'onboard' && c.contractEnd && new Date(c.contractEnd).getTime() < today.getTime());
  
  const opAlerts = ships.map(s => {
    const onboard = crew.filter(c => c.shipId === s.id);
    const alerts = [];
    if (onboard.length < s.minSafeManning) alerts.push(`Manning: ${onboard.length}/${s.minSafeManning}`);
    if (onboard.length > s.cabinCapacity) alerts.push(`Cabin: ${onboard.length}/${s.cabinCapacity}`);
    if (onboard.length > s.lsaCapacity) alerts.push(`LSA: ${onboard.length}/${s.lsaCapacity}`);
    return { ship: s.name, alerts };
  }).filter(s => s.alerts.length > 0);

  const upcomingMap = {};
  crew.forEach(c => {
    if(c.shipId && c.contractStart && new Date(c.contractStart).getTime() >= today.getTime()) {
      if(!upcomingMap[c.shipId]) upcomingMap[c.shipId] = [];
      upcomingMap[c.shipId].push(c.contractStart);
    }
  });
  
  const upcomingSummary = Object.keys(upcomingMap).map(shipId => {
    const dates = upcomingMap[shipId].sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    const nextDate = dates[0];
    const count = dates.filter(d => d === nextDate).length;
    return { ship: ships.find(s=>s.id===shipId)?.name, date: nextDate, count };
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pool = crew.filter(c => c.status === 'onleave');
  const [poolSearch, setPoolSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 min-h-[140px]">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Calendar size={16} className="text-blue-500"/> Upcoming Crew Changes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 max-h-32 overflow-y-auto pr-2 text-sm">
            {upcomingSummary.length === 0 ? <p className="text-slate-400">No planned changes.</p> : 
              upcomingSummary.map((u, i) => (
                <div key={i} className="flex flex-col border-b border-slate-100 pb-1">
                  <span className="font-bold text-slate-700">{u.ship} next crew change, {u.date}</span>
                  <span className="text-blue-600 font-medium">Total {u.count} onsigners</span>
                </div>
              ))
            }
          </div>
        </div>
        
        <div className="w-full lg:w-1/4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 min-h-[140px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500"/> Contract Expiries</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${expiredContracts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{expiredContracts.length}</span>
          </div>
          <div className="space-y-2 max-h-24 overflow-y-auto text-sm pr-1">
            {expiredContracts.length === 0 ? <span className="text-green-600 flex items-center gap-1"><FileCheck size={14}/> No expired contracts</span> : expiredContracts.map(c => (
              <div key={c.id} className="flex justify-between text-slate-600 border-b border-slate-50 pb-1">
                <span className="text-red-500 truncate mr-2" title={c.name}>{c.name}</span>
                <span className="text-red-500 text-xs whitespace-nowrap">{ships.find(s=>s.id===c.shipId)?.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-1/4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 min-h-[140px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500"/> Operational Alerts</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${opAlerts.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>{opAlerts.length}</span>
          </div>
          <div className="space-y-3 max-h-24 overflow-y-auto text-sm pr-1">
            {opAlerts.length === 0 ? <span className="text-green-600 flex items-center gap-1"><FileCheck size={14}/> All compliant</span> : opAlerts.map((a,i) => (
              <div key={i} className="border-b border-slate-50 pb-1">
                <div className="font-bold text-slate-700">{a.ship}</div>
                <div className="text-amber-600 text-[11px] leading-tight">{a.alerts.join(' | ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="w-full xl:w-3/4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ships.map(ship => {
              const onboard = crew.filter(c => c.shipId === ship.id);
              const shipExpired = onboard.filter(c => c.contractEnd && new Date(c.contractEnd).getTime() < today.getTime()).length;
              const hasAlert = onboard.length < ship.minSafeManning || onboard.length > ship.cabinCapacity || onboard.length > ship.lsaCapacity;

              return (
                <div key={ship.id} className={`bg-[#eef5ff] rounded-xl shadow-sm border ${hasAlert ? 'border-amber-300' : 'border-blue-100'} p-4 flex flex-col h-44 relative overflow-hidden group hover:shadow-md transition-shadow`}>
                  <div className={`absolute top-0 left-0 w-1.5 h-full bg-${ship.color}-500`}></div>
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <h3 className="font-bold text-lg text-slate-800 truncate pr-2" title={ship.name}>{ship.name}</h3>
                    <span className="text-xs bg-white text-slate-600 border border-slate-200 px-2 py-0.5 rounded shadow-sm whitespace-nowrap shrink-0">{ship.flag}</span>
                  </div>
                  
                  <div className="flex-1 mt-2 space-y-1 text-sm font-medium pl-2">
                    {hasAlert && <div className="text-amber-600 flex items-center gap-1"><AlertTriangle size={14} className="shrink-0"/> Capacity / Manning Warning</div>}
                    {shipExpired > 0 && <div className="text-red-500">{shipExpired} contract(s) expired</div>}
                  </div>

                  <div className="text-xs text-slate-500 mt-auto flex justify-between items-center border-t border-blue-200/50 pt-3 pl-2">
                    <span className="flex items-center gap-1"><Users size={14}/> POB: <strong className="text-slate-700">{onboard.length}</strong></span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => onOpenNotes(ship.id, 'ship', ship.name)} className="text-slate-400 hover:text-red-500 relative transition-colors">
                        <MessageCircle size={20} />
                        {ship.notes?.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">{ship.notes.length}</span>}
                      </button>
                      <button onClick={() => onOpenLineup(ship.id)} className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 transition-colors bg-blue-50 px-2 py-1 rounded border border-blue-100">
                        Lineup <ChevronRight size={14}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full xl:w-1/4 xl:sticky xl:top-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[500px] xl:h-[700px]">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-white rounded-t-xl shrink-0">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <div className="text-blue-500"><Users size={20} /></div> Crew Pool
                </h2>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 text-slate-400" size={16} />
                <input 
                  type="text" placeholder="Search personnel..." 
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                  value={poolSearch} onChange={e => setPoolSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
              {pool.filter(c => (c.name || '').toLowerCase().includes(poolSearch.toLowerCase()) || (c.competency || '').toLowerCase().includes(poolSearch.toLowerCase())).map(c => (
                <div key={c.id} className="border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:shadow-sm transition-all bg-white relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                  <div className="flex justify-between items-start pl-2">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <span className="truncate" title={c.name}>{c.name}</span>
                        <button onClick={() => onOpenNotes(c.id, 'crew', c.name)} className="text-slate-300 hover:text-slate-500 shrink-0"><MessageCircle size={14}/></button>
                      </div>
                      <div className="text-xs text-slate-500 mb-1 truncate" title={c.competency}>{c.competency}</div>
                      <div className="text-[10px] text-slate-400">Readiness: <span className="text-slate-700">{c.readinessDate || 'TBA'}</span></div>
                    </div>
                    {currentUser.role !== 'viewer' && (
                      <div className="flex flex-col gap-1 items-end shrink-0">
                         <button onClick={() => onAssign(c)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold transition-colors border border-blue-100 w-full text-center">Assign</button>
                         <div className="flex gap-1">
                            <button onClick={() => onEditCrew(c)} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={12}/></button>
                            <button onClick={() => onDeleteCrew(c)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={12}/></button>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {pool.length === 0 && <div className="text-center text-slate-400 text-sm mt-10">No crew on leave.</div>}
            </div>
            
            {currentUser.role !== 'viewer' && (
              <div className="p-3 bg-white border-t border-slate-100 rounded-b-xl shrink-0">
                <button onClick={onAddCrew} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm">
                  <UserPlus size={16}/> Add New Crew
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function LineupModal({ ship, crew, matrix, currentUser, today, getDaysBetween, onClose, onSignOff, onNotes, onEditContract }) {
  const groupedCrew = useMemo(() => {
    const groups = [];
    (matrix || []).forEach(m => {
      const members = crew.filter(c => c.rank === m.rank);
      if (members.length > 0) {
        members.sort((a,b) => {
          const tA = a.contractStart ? new Date(a.contractStart).getTime() : 0;
          const tB = b.contractStart ? new Date(b.contractStart).getTime() : 0;
          return tA - tB;
        });
        groups.push({ matrix: m, members });
      }
    });
    return groups;
  }, [crew, matrix]);

  const timelineStart = new Date(today); timelineStart.setMonth(timelineStart.getMonth() - 1);
  const timelineEnd = new Date(today); timelineEnd.setMonth(timelineEnd.getMonth() + 6);
  const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000*60*60*24);

  const monthHeaders = [];
  let tempDate = new Date(timelineStart);
  tempDate.setDate(1); 
  while(tempDate.getTime() <= timelineEnd.getTime()) {
    monthHeaders.push(tempDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
    tempDate.setMonth(tempDate.getMonth() + 1);
  }

  const getBarStyle = (start, end, isProbation, isPlanned) => {
    if (!start || !end) return { display: 'none' };
    const sDate = new Date(start); const eDate = new Date(end);
    let leftPct = ((sDate.getTime() - timelineStart.getTime()) / (1000*60*60*24)) / totalDays * 100;
    let widthPct = ((eDate.getTime() - sDate.getTime()) / (1000*60*60*24)) / totalDays * 100;
    
    if (leftPct < 0) { widthPct += leftPct; leftPct = 0; }
    if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
    if (widthPct < 0 || leftPct > 100) return { display: 'none' };

    let bgColor = '#22c55e';
    let borderStyle = 'none';
    
    if (sDate.getTime() > today.getTime() || isPlanned) {
      bgColor = 'transparent';
      borderStyle = '2px dashed #22c55e';
    } else if (eDate.getTime() < today.getTime()) {
      bgColor = 'transparent';
      borderStyle = '2px dashed #ef4444';
    } else if ((eDate.getTime() - today.getTime())/(1000*60*60*24) < 30) {
      bgColor = '#eab308';
    }

    const pattern = isProbation && bgColor !== 'transparent' ? `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px), ` : '';

    return {
      left: `${leftPct}%`, width: `${widthPct}%`,
      background: bgColor !== 'transparent' ? `${pattern}${bgColor}` : 'transparent',
      border: borderStyle,
      position: 'absolute', height: '16px', top: '4px', borderRadius: '4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '4px'
    };
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 md:p-6 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 justify-between items-center bg-white shrink-0">
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              {ship?.name} - Lineup
            </h2>
            <div className="ml-0 md:ml-4 text-sm text-slate-500 flex gap-4">
              <span>Safe Manning: <strong className="text-slate-800">{crew.length}/{ship?.minSafeManning}</strong></span>
              <span>Cabin Cap: <strong className="text-slate-800">{crew.length}/{ship?.cabinCapacity}</strong></span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-md shadow-sm border border-slate-200"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-auto bg-slate-50 flex flex-col relative">
          <div className="min-w-[800px] flex-1">
            <div className="flex border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
              <div className="w-[30%] md:w-[25%] shrink-0 p-2 text-xs font-bold text-slate-700 border-r border-slate-200">Personnel Info</div>
              <div className="w-[70%] md:w-[75%] relative flex">
                {monthHeaders.map((m, i) => (
                  <div key={i} className="flex-1 border-l border-slate-200 border-dashed text-center py-2 text-[10px] font-bold text-blue-800">
                    {m}
                  </div>
                ))}
                <div className="absolute top-0 bottom-0 border-l-2 border-red-400 z-10" style={{left: `${((today.getTime() - timelineStart.getTime()) / (1000*60*60*24)) / totalDays * 100}%`}}></div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              {groupedCrew.map((group, gIdx) => (
                <div key={gIdx} className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white">
                  {group.members.map((c, mIdx) => {
                    const isExpired = c.contractEnd && new Date(c.contractEnd).getTime() < today.getTime();
                    const isPlanned = c.contractStart && new Date(c.contractStart).getTime() > today.getTime();
                    const showInnerBorder = mIdx !== group.members.length - 1 && !group.matrix.checkOverlap;
                    const rowClass = showInnerBorder ? 'border-b border-slate-200' : '';

                    let endPct = c.contractEnd ? ((new Date(c.contractEnd).getTime() - timelineStart.getTime()) / (1000*60*60*24)) / totalDays * 100 : 0;
                    if (endPct > 100) endPct = 100;
                    if (endPct < 0) endPct = 0;

                    return (
                      <div key={c.id} className={`flex items-stretch text-xs bg-white relative group h-6 ${rowClass}`}>
                        <div className="w-[30%] md:w-[25%] shrink-0 px-2 border-r border-slate-200 flex items-center min-w-0">
                          <span className="font-bold text-blue-600 w-16 shrink-0 truncate mr-1" title={c.rank}>{c.rank}</span>
                          <span className="font-bold text-slate-800 truncate mr-1" title={c.name}>{c.name}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                              <button onClick={() => onNotes(c.id, c.name)} className="text-slate-300 hover:text-slate-500" title="Notes"><MessageCircle size={14}/></button>
                              {c.notes?.length > 0 && <span className="text-[9px] text-red-500 font-bold">{c.notes.length}</span>}
                              {currentUser.role !== 'viewer' && (
                                 <button onClick={() => onSignOff(c)} className="text-slate-300 hover:text-red-500 ml-1" title="Sign-off"><LogOut size={14}/></button>
                              )}
                          </div>
                        </div>
                        
                        <div className="w-[70%] md:w-[75%] relative h-6 bg-slate-50/30">
                          {monthHeaders.map((_, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-l border-slate-200 border-dashed" style={{left: `${(i / monthHeaders.length) * 100}%`}}></div>
                          ))}
                          <div className="absolute top-0 bottom-0 border-l-2 border-red-400/20 z-0" style={{left: `${((today.getTime() - timelineStart.getTime()) / (1000*60*60*24)) / totalDays * 100}%`}}></div>
                          
                          <div style={getBarStyle(c.contractStart, c.contractEnd, c.isProbation, isPlanned)} className="z-10 cursor-pointer group-hover:brightness-95 transition-all" title={`${c.contractStart} to ${c.contractEnd}`}>
                             {isPlanned && <span className="text-[9px] font-bold text-green-600 bg-white px-1 rounded">PLANNED</span>}
                          </div>

                          {currentUser.role !== 'viewer' && (
                             <div className="absolute z-20 flex items-center opacity-0 group-hover:opacity-100 transition-opacity" style={{left: `${endPct}%`, top: '2px'}}>
                               <button onClick={() => onEditContract(c)} className="bg-white border border-slate-200 text-slate-400 hover:text-blue-500 p-0.5 rounded-full shadow-sm translate-x-1" title="Extend / Edit Contract">
                                 <ChevronRight size={14}/>
                               </button>
                             </div>
                          )}

                          {isExpired && (
                             <div className="absolute z-10 text-[9px] font-bold text-red-500 flex items-center gap-0.5 whitespace-nowrap" style={{left: `${endPct + 3}%`, top: '4px'}}>
                               <AlertTriangle size={10}/> Expired
                             </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignModal({ crewMember, ships, matrix, onboardCrew, today, onClose, onConfirm }) {
  const [shipId, setShipId] = useState('');
  const [rank, setRank] = useState(crewMember?.rank !== 'TBA' ? crewMember?.rank : '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [overlapAction, setOverlapAction] = useState('plan');
  const [addToProc, setAddToProc] = useState(true);

  if (!crewMember) return null;

  const selectedMatrix = matrix.find(m => m.rank === rank);
  const existingCrew = onboardCrew.find(c => c.shipId === shipId && c.rank === rank);
  const hasOverlapWarning = shipId && rank && selectedMatrix?.checkOverlap && existingCrew;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-bold text-slate-800">Assign to Vessel</h2>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0">{crewMember?.name.charAt(0)}</div>
          <div className="min-w-0">
            <div className="font-bold text-slate-800 truncate">{crewMember?.name}</div>
            <div className="text-xs text-slate-500 truncate">{crewMember?.competency}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Vessel</label>
            <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:border-blue-500" value={shipId} onChange={e=>setShipId(e.target.value)}>
              <option value="">-- Choose Vessel --</option>
              {ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rank on Board</label>
            <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:border-blue-500" value={rank} onChange={e=>setRank(e.target.value)}>
              <option value="">-- Choose Rank --</option>
              {matrix.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
            </select>
          </div>
          
          {hasOverlapWarning && (
             <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                <div className="font-bold text-amber-800 flex items-center gap-1 mb-2"><AlertTriangle size={16}/> Overlap Warning</div>
                <p className="text-amber-700 mb-3">{existingCrew.name} is currently assigned as {rank} on this vessel.</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="overlap" value="relieve" checked={overlapAction==='relieve'} onChange={()=>setOverlapAction('relieve')} className="text-blue-600"/>
                    <span className="text-slate-700">Relieve Immediately (Sign-off {existingCrew.name})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="overlap" value="plan" checked={overlapAction==='plan'} onChange={()=>setOverlapAction('plan')} className="text-blue-600"/>
                    <span className="text-slate-700">Plan as Relief / Handover (Overlap on Gantt)</span>
                  </label>
                </div>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Join Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500" value={start} onChange={e=>setStart(e.target.value)}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500" value={end} onChange={e=>setEnd(e.target.value)}/>
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-2 border-t border-slate-100">
            <input type="checkbox" checked={addToProc} onChange={e=>setAddToProc(e.target.checked)} className="rounded border-slate-300 text-blue-600 w-4 h-4 cursor-pointer"/>
            Add to Procedures Follow Up (Onsigner)
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm">Cancel</button>
          <button 
            disabled={!shipId || !rank || !start || !end}
            onClick={() => onConfirm(shipId, rank, start, end, hasOverlapWarning ? overlapAction : null, addToProc)} 
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors shadow-sm"
          >
            Assign Crew
          </button>
        </div>
      </div>
    </div>
  );
}

function SignOffModal({ crewMember, today, onClose, onConfirm }) {
  const [date, setDate] = useState(today.toISOString().split('T')[0]);
  const [addToProc, setAddToProc] = useState(true);

  if (!crewMember) return null;
  
  const isEarly = crewMember.contractEnd && new Date(date).getTime() < new Date(crewMember.contractEnd).getTime();

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><LogOut className="text-red-500"/> Sign Off</h2>
        <p className="text-slate-600 mb-4 text-sm">You are about to sign off <strong>{crewMember?.name}</strong> from their <strong>{crewMember?.rank}</strong> position.</p>
        
        {isEarly && (
          <div className="bg-amber-50 text-amber-700 p-2 text-xs font-medium rounded border border-amber-200 mb-4 flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5"/> This is before their planned contract end date ({crewMember?.contractEnd}).
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sign Off Date</label>
            <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-red-500" value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={addToProc} onChange={e=>setAddToProc(e.target.checked)} className="rounded border-slate-300 text-red-600 w-4 h-4 cursor-pointer"/>
            Add to Procedures Follow Up
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm">Cancel</button>
          <button onClick={() => onConfirm(date, addToProc)} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors">Confirm Sign-Off</button>
        </div>
      </div>
    </div>
  );
}

function EditContractModal({ crewMember, onClose, onConfirm }) {
  const [start, setStart] = useState(crewMember?.contractStart || '');
  const [end, setEnd] = useState(crewMember?.contractEnd || '');

  if (!crewMember) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">Edit Contract Dates</h2>
        <p className="text-sm text-slate-500 mb-4">Update contract dates for <strong>{crewMember?.name}</strong>.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500" value={start} onChange={e=>setStart(e.target.value)}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500" value={end} onChange={e=>setEnd(e.target.value)}/>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm">Cancel</button>
          <button disabled={!start || !end} onClick={() => onConfirm(start, end)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function Procedures({ procedures, schema, currentUser, onUpdateProc, onUpdateDynamic, onAddEval, onAddDebrief, onDeleteProc }) {
  const [tab, setTab] = useState('active'); 
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [typeFilter, setTypeFilter] = useState('');
  const [crewSearch, setCrewSearch] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const displayData = procedures.filter(p => {
    if (p.status !== tab) return false;
    if (typeFilter && p.type !== typeFilter) return false;
    if (crewSearch && !(p.crewName || '').toLowerCase().includes(crewSearch.toLowerCase())) return false;
    if (vesselSearch && !(p.shipName || '').toLowerCase().includes(vesselSearch.toLowerCase())) return false;
    if (dateFrom && new Date(p.date).getTime() < new Date(dateFrom).getTime()) return false;
    if (dateTo && new Date(p.date).getTime() > new Date(dateTo).getTime()) return false;
    return true;
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-wrap gap-4 justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Procedures Follow Up</h1>
        <div className="bg-slate-200 p-1 rounded-md flex text-sm font-medium shrink-0 shadow-sm">
          <button onClick={() => setTab('active')} className={`px-4 py-1 rounded transition-colors ${tab==='active'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Active</button>
          <button onClick={() => setTab('archive')} className={`px-4 py-1 rounded transition-colors ${tab==='archive'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Archive</button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end shrink-0">
         <div className="flex items-center gap-2 text-sm text-slate-500 mr-2"><Filter size={16}/> Filters:</div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Type</label>
           <select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
             <option value="">All Types</option><option value="onsigner">Onsigner</option><option value="offsigner">Offsigner</option>
           </select>
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Crew Name</label>
           <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-36 focus:outline-none" value={crewSearch} onChange={e=>setCrewSearch(e.target.value)} />
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Vessel</label>
           <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-32 focus:outline-none" value={vesselSearch} onChange={e=>setVesselSearch(e.target.value)} />
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Date From</label>
           <input type="date" className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Date To</label>
           <input type="date" className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
         </div>
         {(typeFilter||crewSearch||vesselSearch||dateFrom||dateTo) && (
            <button onClick={()=>{setTypeFilter('');setCrewSearch('');setVesselSearch('');setDateFrom('');setDateTo('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>
         )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Crew</th>
                <th className="px-4 py-3 font-semibold">Vessel</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                {schema.map(col => <th key={col.id} className="px-4 py-3 font-semibold text-center">{col.name}</th>)}
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map(p => (
                <tr key={p.id} className={`border-b border-slate-100 hover:brightness-95 transition-all ${p.type==='onsigner'?'bg-emerald-50/50':'bg-slate-200/40'}`}>
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-xs font-bold ${p.type==='onsigner'?'bg-emerald-100 text-emerald-800 border border-emerald-200':'bg-slate-300 text-slate-700 border border-slate-400'}`}>{p.type}</span></td>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.crewName} <br/><span className="text-[11px] text-slate-500 font-normal">{p.rank}</span></td>
                  <td className="px-4 py-2 text-slate-700 font-medium">{p.shipName}</td>
                  <td className="px-4 py-2 text-slate-600">{p.date}</td>
                  
                  {schema.map(col => {
                    const applies = col.appliesTo === 'both' || col.appliesTo === p.type;
                    if (!applies) return <td key={col.id} className="px-4 py-2 text-center text-slate-300">-</td>;
                    
                    const val = p.dynamicData[col.id];
                    if (tab === 'archive') {
                       return <td key={col.id} className="px-4 py-2 text-center">{col.type === 'checkbox' ? (val ? 'Yes' : 'No') : (val || '-')}</td>;
                    }
                    
                    return (
                      <td key={col.id} className="px-4 py-2 text-center">
                        {col.type === 'checkbox' ? 
                          <input type="checkbox" checked={val || false} onChange={e => onUpdateDynamic(p.id, col.id, e.target.checked)} className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" />
                          : 
                          <input type="date" value={val || ''} onChange={e => onUpdateDynamic(p.id, col.id, e.target.value)} className="text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 focus:outline-none bg-white" />
                        }
                      </td>
                    );
                  })}

                  <td className="px-4 py-2 text-right">
                    {tab === 'active' ? (
                      <div className="flex justify-end items-center gap-3">
                        {p.type === 'offsigner' && (
                          <>
                            <button 
                              onClick={() => !p.evaluationDone && onAddEval(p)} 
                              disabled={p.evaluationDone}
                              title="Evaluation" 
                              className={`transition-colors ${p.evaluationDone ? 'text-slate-300 cursor-not-allowed' : 'text-amber-500 hover:text-amber-600'}`}
                            >
                              <Star size={18} fill={p.evaluationDone ? "currentColor" : "none"}/>
                            </button>
                            {['master', 'chief', 'second engineer', '2nd engineer', '2/e', 'c/e', 'c/o'].some(r => (p.rank || '').toLowerCase().includes(r)) && (
                              <button 
                                onClick={() => !p.debriefDone && onAddDebrief(p)} 
                                disabled={p.debriefDone}
                                title="Debriefing" 
                                className={`transition-colors ${p.debriefDone ? 'text-slate-300 cursor-not-allowed' : 'text-blue-500 hover:text-blue-600'}`}
                              >
                                <UserCheck size={18}/>
                              </button>
                            )}
                          </>
                        )}
                        <button onClick={() => onUpdateProc(p.id, 'status', 'archive')} title="Archive" className="text-slate-400 hover:text-slate-700 ml-2 transition-colors"><Archive size={18}/></button>
                        {currentUser.role === 'admin' && (
                          <button onClick={() => setDeleteConfirmId(p.id)} title="Delete Procedure" className="text-slate-300 hover:text-red-500 ml-1 transition-colors"><Trash2 size={18}/></button>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-end items-center">
                         {currentUser.role === 'admin' && (
                           <button onClick={() => onUpdateProc(p.id, 'status', 'active')} title="Restore to Active" className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-xs font-medium"><RotateCcw size={14}/> Restore</button>
                         )}
                         {currentUser.role !== 'admin' && <span className="text-xs text-slate-400 italic bg-slate-100 px-2 py-1 rounded">Archived</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {displayData.length === 0 && <tr><td colSpan={6+schema.length} className="text-center py-12 text-slate-400">No matching procedures.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      {deleteConfirmId && (
        <DeleteConfirmModal 
          message="Are you sure you want to permanently delete this procedure record?" 
          showConfirm={true} 
          onClose={() => setDeleteConfirmId(null)} 
          onConfirm={() => { onDeleteProc(deleteConfirmId); setDeleteConfirmId(null); }} 
        />
      )}
    </div>
  );
}

function EvaluationsOverview({ evals, ships, matrix, currentUser, onDelete, exportToCSV }) {
  const [fRank, setFRank] = useState('');
  const [fName, setFName] = useState('');
  const [fVessel, setFVessel] = useState('');
  const [fDate, setFDate] = useState('');
  const [fEvalBy, setFEvalBy] = useState('');
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const displayEvals = evals.filter(e => {
    if(fRank && e.rank !== fRank) return false;
    if(fName && !(e.crewName || '').toLowerCase().includes(fName.toLowerCase())) return false;
    if(fVessel && e.shipName !== fVessel) return false;
    if(fDate && e.date !== fDate) return false;
    if(fEvalBy && !(e.evaluatedBy || '').toLowerCase().includes(fEvalBy.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Evaluations Overview</h1>
        <button 
          onClick={() => exportToCSV(displayEvals.map(e => ({ Date: e.date, 'Crew Name': e.crewName, Rank: e.rank, Vessel: e.shipName, Score: e.score, 'Evaluated By': e.evaluatedBy })), 'evaluations_export')} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-2"
        >
          <Download size={16}/> Export to Excel
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end shrink-0">
         <div className="flex items-center gap-2 text-sm text-slate-500 mr-2"><Filter size={16}/> Filters:</div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Rank</label>
           <select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none w-32 bg-white" value={fRank} onChange={e=>setFRank(e.target.value)}>
             <option value="">All Ranks</option>
             {matrix.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
           </select>
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Crew Name</label>
           <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-36 focus:outline-none" value={fName} onChange={e=>setFName(e.target.value)} />
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Vessel</label>
           <select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none w-32 bg-white" value={fVessel} onChange={e=>setFVessel(e.target.value)}>
             <option value="">All Vessels</option>
             {ships.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
           </select>
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Date</label>
           <input type="date" className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none bg-white" value={fDate} onChange={e=>setFDate(e.target.value)} />
         </div>
         <div>
           <label className="block text-xs text-slate-400 mb-0.5">Evaluated By</label>
           <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-32 focus:outline-none" value={fEvalBy} onChange={e=>setFEvalBy(e.target.value)} />
         </div>
         {(fRank||fName||fVessel||fDate||fEvalBy) && (
            <button onClick={()=>{setFRank('');setFName('');setFVessel('');setFDate('');setFEvalBy('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>
         )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Crew Name</th><th className="px-4 py-3 font-semibold">Rank</th><th className="px-4 py-3 font-semibold">Vessel</th><th className="px-4 py-3 font-semibold">Score</th><th className="px-4 py-3 font-semibold">Evaluator</th><th className="px-4 py-3 font-semibold text-right">Actions</th></tr>
            </thead>
            <tbody>
              {displayEvals.map(e => {
                const isLowScore = Number(e.score) < 70;
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">{e.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.crewName}</td>
                    <td className="px-4 py-3 text-slate-600">{e.rank}</td>
                    <td className="px-4 py-3 text-slate-600">{e.shipName}</td>
                    <td className={`px-4 py-3 ${isLowScore ? 'text-red-600 font-bold' : 'font-bold text-slate-800'}`}>{e.score}/100</td>
                    <td className="px-4 py-3 text-slate-600">{e.evaluatedBy}</td>
                    <td className="px-4 py-3 text-right">
                       {currentUser.role === 'admin' && (
                          <button onClick={() => setDeleteConfirmId(e.id)} className="text-slate-300 hover:text-red-500" title="Delete Evaluation"><Trash2 size={16}/></button>
                       )}
                    </td>
                  </tr>
                );
              })}
              {displayEvals.length===0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">No matching evaluations.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      {deleteConfirmId && (
        <DeleteConfirmModal 
          message="Are you sure you want to permanently delete this evaluation record?" 
          showConfirm={true} 
          onClose={() => setDeleteConfirmId(null)} 
          onConfirm={() => { onDelete(deleteConfirmId); setDeleteConfirmId(null); }} 
        />
      )}
    </div>
  );
}

function EvaluationsAdd({ currentUser, crew, ships, prefillData, today, onAdd, onClearPrefill }) {
  const generateInitialRows = () => {
    if (!prefillData) return [{ id: 1, crewName: '', rank: '', shipName: '', score: '', evaluatedBy: currentUser.username, date: today.toISOString().split('T')[0] }];
    
    const isManager = ['Master', 'Chief Engineer'].includes(prefillData.rank);
    if (!isManager) {
      const evaluator = typeof prefillData.evalSnapshot === 'string' ? prefillData.evalSnapshot : 'Office';
      return [{ id: 1, crewName: prefillData.crewName, rank: prefillData.rank, shipName: prefillData.shipName, score: '', evaluatedBy: evaluator, date: prefillData.date }];
    } else {
      const crewList = Array.isArray(prefillData.evalSnapshot) ? prefillData.evalSnapshot : [];
      if (crewList.length === 0) return [{ id: 1, crewName: '', rank: '', shipName: prefillData.shipName, score: '', evaluatedBy: prefillData.crewName, date: prefillData.date }];
      return crewList.map((c, i) => ({
        id: i+1, crewName: c.name, rank: c.rank, shipName: prefillData.shipName, score: '', evaluatedBy: prefillData.crewName, date: prefillData.date
      }));
    }
  };

  const [addRows, setAddRows] = useState(generateInitialRows());
  useEffect(() => setAddRows(generateInitialRows()), [prefillData]);

  const handleAddRow = () => setAddRows([...addRows, { id: Date.now(), crewName: '', rank: '', shipName: '', score: '', evaluatedBy: currentUser.username, date: today.toISOString().split('T')[0] }]);
  const updateRow = (id, field, val) => setAddRows(addRows.map(r => r.id === id ? {...r, [field]: val} : r));
  const submitAll = () => {
    const validRows = addRows.filter(r => r.crewName && r.score).map(r => ({...r, id: 'e'+generateId()}));
    if(validRows.length > 0) onAdd(validRows);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-800">Add Evaluations</h1>
        {prefillData && <button onClick={onClearPrefill} className="text-sm text-blue-600 hover:underline">Clear Auto-fill</button>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        {prefillData && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-200 text-sm flex items-start gap-2">
            <Star size={18} className="shrink-0 mt-0.5"/>
            <div>
               <strong>Auto-fill active from Procedures:</strong> <br/>
               Sign-off: {prefillData.crewName} ({prefillData.rank}) from {prefillData.shipName}.
               Rows generated based on sign-off snapshot.
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <div className="min-w-[900px] space-y-3">
            {addRows.map((row, i) => (
              <div key={row.id} className="flex gap-3 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="font-bold text-slate-400 w-6 text-center">{i+1}.</span>
                <input type="date" className="border border-slate-300 rounded-md p-2 text-sm w-36 focus:border-blue-500 focus:outline-none bg-slate-50" value={row.date} onChange={e=>updateRow(row.id, 'date', e.target.value)}/>
                <input type="text" placeholder="Crew Name" className="border border-slate-300 rounded-md p-2 text-sm flex-1 focus:border-blue-500 focus:outline-none bg-slate-50" value={row.crewName} onChange={e=>updateRow(row.id, 'crewName', e.target.value)} list="crewList"/>
                <input type="text" placeholder="Rank" className="border border-slate-300 rounded-md p-2 text-sm w-32 focus:border-blue-500 focus:outline-none bg-slate-50" value={row.rank} onChange={e=>updateRow(row.id, 'rank', e.target.value)}/>
                <select className="border border-slate-300 rounded-md p-2 text-sm w-40 bg-white focus:border-blue-500 focus:outline-none" value={row.shipName} onChange={e=>updateRow(row.id, 'shipName', e.target.value)}>
                  <option value="">Select Ship</option>
                  {ships.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <input type="number" placeholder="Score (0-100)" className="border border-slate-300 rounded-md p-2 text-sm w-28 focus:border-blue-500 focus:outline-none font-bold text-blue-600" value={row.score} onChange={e=>updateRow(row.id, 'score', e.target.value)} max="100" min="0"/>
                <input type="text" placeholder="Evaluated By" className="border border-slate-300 rounded-md p-2 text-sm w-40 focus:border-blue-500 focus:outline-none bg-slate-50" value={row.evaluatedBy} onChange={e=>updateRow(row.id, 'evaluatedBy', e.target.value)}/>
                <button onClick={() => setAddRows(addRows.filter(r=>r.id !== row.id))} className="text-slate-400 hover:text-red-500 p-1 transition-colors"><X size={20}/></button>
              </div>
            ))}
          </div>
        </div>
        <datalist id="crewList">{crew.map(c => <option key={c.id} value={c.name}/>)}</datalist>
        
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
          <button onClick={handleAddRow} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100"><Plus size={16}/> Add Row</button>
          <button onClick={submitAll} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors">Submit Valid Rows</button>
        </div>
      </div>
    </div>
  );
}

function Debriefings({ debriefings, currentUser, onUpdate, onUpdateDept, onDelete, exportToCSV, ships, matrix, onManualAdd }) {
  const [tab, setTab] = useState('active');
  const [editModal, setEditModal] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [newDebrief, setNewDebrief] = useState({ crewName: '', rank: '', shipName: '', signOffDate: '' });

  const [fRank, setFRank] = useState('');
  const [fName, setFName] = useState('');
  const [fVessel, setFVessel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const displayData = debriefings.filter(d => {
    if (d.status !== tab) return false;
    if (fRank && !(d.rank || '').toLowerCase().includes(fRank.toLowerCase())) return false;
    if (fName && !(d.crewName || '').toLowerCase().includes(fName.toLowerCase())) return false;
    if (fVessel && !(d.shipName || '').toLowerCase().includes(fVessel.toLowerCase())) return false;
    if (dateFrom && new Date(d.signOffDate).getTime() < new Date(dateFrom).getTime()) return false;
    if (dateTo && new Date(d.signOffDate).getTime() > new Date(dateTo).getTime()) return false;
    return true;
  });

  const DeptCell = ({ dept }) => {
    if(!dept.score) return <span className="text-slate-300">-</span>;
    const numScore = Number(dept.score);
    const isLow = numScore < 70;
    return (
      <div className="flex items-center gap-1 group relative">
        <span className={isLow ? 'text-red-600 font-bold' : 'font-bold text-slate-700'}>{dept.score}</span>
        {dept.note && (
          <div className="relative">
             <button className="text-blue-500 cursor-help opacity-70 hover:opacity-100 focus:outline-none" title={dept.note}>
                <Info size={14} />
             </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Senior Officer Debriefings</h1>
        <div className="flex items-center gap-3">
          {currentUser.role !== 'viewer' && (
             <button 
               onClick={() => {
                 setNewDebrief({ crewName: '', rank: '', shipName: '', signOffDate: new Date().toISOString().split('T')[0] });
                 setAddModal(true);
               }} 
               className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-2"
             >
               <Plus size={14}/> Add Debriefing
             </button>
          )}
          {tab === 'archived' && (
            <button 
              onClick={() => {
                const exportData = displayData.map(d => ({
                  'Sign-off Date': d.signOffDate,
                  'Crew Name': d.crewName,
                  'Rank': d.rank,
                  'Vessel': d.shipName,
                  'Deck Score': d.depts[0]?.score || '',
                  'Deck Note': d.depts[0]?.note || '',
                  'Engine Score': d.depts[1]?.score || '',
                  'Engine Note': d.depts[1]?.note || '',
                  'Safety Score': d.depts[2]?.score || '',
                  'Safety Note': d.depts[2]?.note || '',
                  'HR Score': d.depts[3]?.score || '',
                  'HR Note': d.depts[3]?.note || ''
                }));
                exportToCSV(exportData, 'debriefings_archive_export');
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-2"
            >
              <Download size={14}/> Export Archive
            </button>
          )}
          <div className="bg-slate-200 p-1 rounded-md flex text-sm font-medium shrink-0 shadow-sm">
            <button onClick={() => setTab('active')} className={`px-4 py-1 rounded transition-colors ${tab==='active'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Active</button>
            <button onClick={() => setTab('archived')} className={`px-4 py-1 rounded transition-colors ${tab==='archived'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Archived</button>
          </div>
        </div>
      </div>

      {tab === 'archived' && (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end shrink-0">
           <div className="flex items-center gap-2 text-sm text-slate-500 mr-2"><Filter size={16}/> Filters:</div>
           <div>
             <label className="block text-xs text-slate-400 mb-0.5">Rank</label>
             <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-28 focus:outline-none" value={fRank} onChange={e=>setFRank(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs text-slate-400 mb-0.5">Crew Name</label>
             <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-36 focus:outline-none" value={fName} onChange={e=>setFName(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs text-slate-400 mb-0.5">Vessel</label>
             <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-32 focus:outline-none" value={fVessel} onChange={e=>setFVessel(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs text-slate-400 mb-0.5">Date From</label>
             <input type="date" className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs text-slate-400 mb-0.5">Date To</label>
             <input type="date" className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
           </div>
           {(fRank||fName||fVessel||dateFrom||dateTo) && (
              <button onClick={()=>{setFRank('');setFName('');setFVessel('');setDateFrom('');setDateTo('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>
           )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold">Sign-off Date</th>
                <th className="px-4 py-3 font-semibold">Crew Info</th>
                <th className="px-4 py-3 font-semibold">Vessel</th>
                <th className="px-4 py-3 font-semibold">Deck</th>
                <th className="px-4 py-3 font-semibold">Engine</th>
                <th className="px-4 py-3 font-semibold">Safety</th>
                <th className="px-4 py-3 font-semibold">HR</th>
                <th className="px-4 py-3 font-semibold text-center border-l border-slate-200">Avg</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map(d => {
                const scores = d.depts.map(x=>Number(x.score)).filter(x => !isNaN(x) && x > 0);
                const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : null;
                const isAvgLow = avg && avg < 70;

                return (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">{d.signOffDate}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{d.crewName}</div>
                      <div className="text-[11px] text-slate-500">{d.rank}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.shipName}</td>
                    
                    <td className="px-4 py-3"><DeptCell dept={d.depts[0]} /></td>
                    <td className="px-4 py-3"><DeptCell dept={d.depts[1]} /></td>
                    <td className="px-4 py-3"><DeptCell dept={d.depts[2]} /></td>
                    <td className="px-4 py-3"><DeptCell dept={d.depts[3]} /></td>
                    
                    <td className="px-4 py-3 text-center border-l border-slate-100">
                      <span className={`bg-slate-100 px-2 py-1 rounded font-bold ${isAvgLow ? 'text-red-600' : 'text-slate-700'}`}>{avg || '-'}</span>
                    </td>
                    
                    <td className="px-4 py-3 text-right">
                      {tab === 'active' && currentUser.role !== 'viewer' ? (
                        <div className="flex justify-end items-center gap-2">
                           <button onClick={() => setEditModal(d)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 font-medium text-xs">Edit / Fill</button>
                           <button onClick={() => onUpdate(d.id, 'status', 'archived')} className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium text-xs">Complete</button>
                           {currentUser.role === 'admin' && (
                             <button onClick={() => setDeleteConfirmId(d.id)} className="text-slate-400 hover:text-red-500 p-1" title="Delete"><Trash2 size={16}/></button>
                           )}
                        </div>
                      ) : (
                        <div className="flex justify-end items-center">
                           {currentUser.role === 'admin' && (
                             <button onClick={() => onUpdate(d.id, 'status', 'active')} title="Restore to Active" className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-xs font-medium"><RotateCcw size={14}/> Restore</button>
                           )}
                           {currentUser.role !== 'admin' && <span className="text-xs text-slate-400 italic bg-slate-100 px-2 py-1 rounded">Archived</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayData.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400">No debriefing records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      {deleteConfirmId && (
        <DeleteConfirmModal 
          message="Are you sure you want to permanently delete this debriefing record?" 
          showConfirm={true} 
          onClose={() => setDeleteConfirmId(null)} 
          onConfirm={() => { onDelete(deleteConfirmId); setDeleteConfirmId(null); }} 
        />
      )}

      {/* Edit Modal for Debriefing */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
               <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Edit Debriefing</h2>
                  <p className="text-xs text-slate-500 mt-1">{editModal.crewName} ({editModal.rank}) - {editModal.shipName}</p>
               </div>
               <button onClick={()=>setEditModal(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded shadow-sm border border-slate-200"><X size={18}/></button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto bg-slate-50 flex-1">
               <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Debrief Start Date</label>
                    <input type="date" value={editModal.startDate} onChange={e=>setEditModal({...editModal, startDate: e.target.value})} className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none bg-white"/>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Debrief End Date</label>
                    <input type="date" value={editModal.endDate} onChange={e=>setEditModal({...editModal, endDate: e.target.value})} className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none bg-white"/>
                  </div>
               </div>
               
               <div className="space-y-3">
                 {editModal.depts.map((dept, idx) => (
                   <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex gap-3 items-start">
                     <div className="w-24 shrink-0 font-bold text-slate-700 text-sm mt-1">{dept.name}</div>
                     <textarea 
                       placeholder="Enter detailed notes..." 
                       value={dept.note} onChange={e=>{
                         const newDepts = [...editModal.depts]; newDepts[idx].note = e.target.value; setEditModal({...editModal, depts: newDepts});
                       }} 
                       className="flex-1 border border-slate-300 rounded p-2 text-sm resize-none focus:outline-none focus:border-blue-500 h-16 bg-slate-50"
                     />
                     <div className="w-20 shrink-0">
                       <input 
                         type="number" placeholder="Score" max="100" min="0" 
                         value={dept.score} onChange={e=>{
                           const newDepts = [...editModal.depts]; newDepts[idx].score = e.target.value; setEditModal({...editModal, depts: newDepts});
                         }} 
                         className="w-full border border-slate-300 rounded p-2 text-sm font-bold text-blue-600 focus:outline-none focus:border-blue-500 text-center bg-slate-50"
                       />
                       <div className="text-center text-[10px] text-slate-400 mt-1">out of 100</div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
                <button onClick={()=>setEditModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={() => {
                  onUpdate(editModal.id, 'startDate', editModal.startDate);
                  onUpdate(editModal.id, 'endDate', editModal.endDate);
                  editModal.depts.forEach((d, i) => {
                    onUpdateDept(editModal.id, i, 'note', d.note);
                    onUpdateDept(editModal.id, i, 'score', d.score);
                  });
                  setEditModal(null);
                }} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal for Debriefing */}
        {addModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Manual Add Debriefing</h2>
                 <button onClick={()=>setAddModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded shadow-sm border border-slate-200"><X size={18}/></button>
              </div>
              <div className="p-4 space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Crew Name</label>
                   <input type="text" value={newDebrief.crewName} onChange={e=>setNewDebrief({...newDebrief, crewName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 bg-slate-50"/>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Rank</label>
                   <select value={newDebrief.rank} onChange={e=>setNewDebrief({...newDebrief, rank: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 bg-slate-50">
                     <option value="">Select Rank</option>
                     {matrix?.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Vessel</label>
                   <select value={newDebrief.shipName} onChange={e=>setNewDebrief({...newDebrief, shipName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 bg-slate-50">
                     <option value="">Select Vessel</option>
                     {ships?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Sign-off Date</label>
                   <input type="date" value={newDebrief.signOffDate} onChange={e=>setNewDebrief({...newDebrief, signOffDate: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 bg-slate-50"/>
                 </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
                  <button onClick={()=>setAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
                  <button disabled={!newDebrief.crewName || !newDebrief.rank || !newDebrief.shipName || !newDebrief.signOffDate} onClick={() => {
                    onManualAdd(newDebrief);
                    setAddModal(false);
                  }} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function SettingsPage({ matrix, setMatrix, procSchema, setProcSchema, promoMatrix, setPromoMatrix, users, onAddUser, onUpdateUser, onDeleteUser, ships, onAddShip, onUpdateShip, onDeleteShip, currentUser, setCurrentUser }) {
    const [newCol, setNewCol] = useState({ name: '', type: 'checkbox', appliesTo: 'both' });
    const [newRank, setNewRank] = useState({ rank: '', dept: 'Deck', checkOverlap: false, competencies: [] });
    const [newCompText, setNewCompText] = useState({});
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', jobTitle: 'Crew Manager' });
    const [newPromoRow, setNewPromoRow] = useState({ rank: '', steps: [] });
  const [newShip, setNewShip] = useState({ name: '', flag: 'TBA', minSafeManning: 10, cabinCapacity: 15, lsaCapacity: 20, color: 'blue' });

  // Edit States
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  
  const [editingShipId, setEditingShipId] = useState(null);
  const [editShipData, setEditShipData] = useState({});

  const moveMatrix = (index, dir) => {
    if ((dir === -1 && index === 0) || (dir === 1 && index === matrix.length - 1)) return;
    const newArr = [...matrix];
    const temp = newArr[index];
    newArr[index] = newArr[index + dir];
    newArr[index + dir] = temp;
    setMatrix(newArr);
  };
  
  const addRank = () => {
    if(!newRank.rank) return;
    setMatrix([...matrix, { ...newRank, id: generateId() }]);
    setNewRank({ rank: '', dept: 'Deck', checkOverlap: false, competencies: [] });
  };
  
  const deleteRank = (id) => setMatrix(matrix.filter(m => m.id !== id));
  
  const addCompetency = (index) => {
    const text = newCompText[index];
    if(!text) return;
    const nm = [...matrix];
    if(!nm[index].competencies.includes(text)) nm[index].competencies.push(text);
    setMatrix(nm);
    setNewCompText({...newCompText, [index]: ''});
  };

  const removeCompetency = (mIndex, cIndex) => {
    const nm = [...matrix];
    nm[mIndex].competencies.splice(cIndex, 1);
    setMatrix(nm);
  };

  const addColumn = () => {
    if(!newCol.name) return;
    setProcSchema([...procSchema, { ...newCol, id: generateId() }]);
    setNewCol({ name: '', type: 'checkbox', appliesTo: 'both' });
  };
  
  const deleteColumn = (id) => setProcSchema(procSchema.filter(c => c.id !== id));

  const addUser = () => {
    if(!newUser.username || !newUser.password) return;
    onAddUser({ ...newUser, id: 'u'+Date.now() });
    setNewUser({ username: '', password: '', role: 'viewer', jobTitle: 'Crew Manager' });
  };

  const addPromoRow = () => {
    if(!newPromoRow.rank) return;
    setPromoMatrix([...(promoMatrix||[]), { id: 'pm'+Date.now(), rank: newPromoRow.rank, steps: newPromoRow.steps }]);
    setNewPromoRow({ rank: '', steps: [] });
  };

  const deleteUser = (id) => {
    if (users.find(u => u.id === id)?.role === 'admin') return; 
    onDeleteUser(id);
  };
  
  const addShip = () => {
    if(!newShip.name) return;
    onAddShip({ ...newShip, id: 's'+Date.now(), notes: [] });
    setNewShip({ name: '', flag: 'TBA', minSafeManning: 10, cabinCapacity: 15, lsaCapacity: 20, color: 'blue' });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">System Administration</h1>
      
      {/* 1. USER MANAGEMENT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Users size={20} className="text-indigo-500"/> User Management</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Add, edit, or remove users. Admins can update their own username/password here. Viewers have read-only access and can only add notes.</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr><th className="p-3">Username</th><th className="p-3">Password</th><th className="p-3">Job Title</th><th className="p-3">Access Level</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isEditing = editingUserId === u.id;
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3">
                      {isEditing ? (
                        <input value={editUserData.username} onChange={e=>setEditUserData({...editUserData, username: e.target.value})} className="border border-blue-400 rounded p-1.5 text-xs w-full focus:outline-none"/>
                      ) : (
                        <span className="font-bold text-slate-800">{u.username}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-500">
                      {isEditing ? (
                        <input value={editUserData.password} onChange={e=>setEditUserData({...editUserData, password: e.target.value})} className="border border-blue-400 rounded p-1.5 text-xs w-full focus:outline-none"/>
                      ) : (
                        u.role === 'admin' ? '********' : u.password
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <select value={editUserData.jobTitle || 'Other'} onChange={e=>setEditUserData({...editUserData, jobTitle: e.target.value})} className="border border-blue-400 rounded p-1.5 text-xs outline-none" disabled={u.role === 'admin'}>
                           {JOB_TITLES.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                      ) : (
                        <span className="font-bold text-slate-600">{u.jobTitle || 'Admin'}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <select value={editUserData.role} onChange={e=>setEditUserData({...editUserData, role: e.target.value})} className="border border-blue-400 rounded p-1.5 text-xs outline-none" disabled={u.role === 'admin'}>
                           <option value="admin">Admin (All Access)</option>
                           <option value="user">Editor (User)</option>
                           <option value="viewer">Viewer (Read Only)</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role==='admin'?'bg-red-100 text-red-700':u.role==='user'?'bg-blue-100 text-blue-700':'bg-slate-200 text-slate-700'}`}>{u.role}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2 items-center">
                          <button onClick={() => {
                              onUpdateUser(editUserData);
                              if (currentUser.id === editingUserId) setCurrentUser(editUserData);
                              setEditingUserId(null);
                          }} className="text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded font-bold text-xs shadow-sm">Save</button>
                          <button onClick={()=>setEditingUserId(null)} className="text-slate-400 hover:text-slate-600 text-xs font-medium">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                           <button onClick={() => { setEditingUserId(u.id); setEditUserData(u); }} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16}/></button>
                           {u.role !== 'admin' && <button onClick={()=>deleteUser(u.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-indigo-50/50">
                <td className="p-3"><input type="text" placeholder="New Username" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} className="w-full border border-indigo-200 rounded p-1.5 text-sm outline-none bg-white"/></td>
                <td className="p-3"><input type="text" placeholder="Password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} className="w-full border border-indigo-200 rounded p-1.5 text-sm outline-none bg-white"/></td>
                <td className="p-3">
                  <select className="border border-indigo-200 rounded p-1.5 text-sm outline-none bg-white" value={newUser.jobTitle} onChange={e=>setNewUser({...newUser, jobTitle: e.target.value})}>
                    {JOB_TITLES.filter(j=>j!=='Admin').map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select className="border border-indigo-200 rounded p-1.5 text-sm outline-none bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                    <option value="user">Editor</option><option value="viewer">Viewer</option>
                  </select>
                </td>
                <td className="p-3 text-right"><button onClick={addUser} disabled={!newUser.username || !newUser.password} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">Add User</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. FLEET MANAGEMENT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Ship size={20} className="text-teal-500"/> Fleet Management</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Add new vessels to your fleet, update their capacities and manning requirements, or remove them.</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr><th className="p-3">Vessel Name</th><th className="p-3">Flag</th><th className="p-3 text-center">Min Safe</th><th className="p-3 text-center">Cabin Cap</th><th className="p-3 text-center">LSA Cap</th><th className="p-3 text-center">Color</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {ships.map(s => {
                const isEditing = editingShipId === s.id;
                return (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-800">
                      {isEditing ? <input type="text" value={editShipData.name} onChange={e=>setEditShipData({...editShipData, name: e.target.value})} className="border border-blue-400 rounded p-1 w-full"/> : s.name}
                    </td>
                    <td className="p-3">
                      {isEditing ? <input type="text" value={editShipData.flag} onChange={e=>setEditShipData({...editShipData, flag: e.target.value})} className="border border-blue-400 rounded p-1 w-full"/> : s.flag}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? <input type="number" value={editShipData.minSafeManning} onChange={e=>setEditShipData({...editShipData, minSafeManning: Number(e.target.value)})} className="border border-blue-400 rounded p-1 w-16 text-center"/> : s.minSafeManning}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? <input type="number" value={editShipData.cabinCapacity} onChange={e=>setEditShipData({...editShipData, cabinCapacity: Number(e.target.value)})} className="border border-blue-400 rounded p-1 w-16 text-center"/> : s.cabinCapacity}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? <input type="number" value={editShipData.lsaCapacity} onChange={e=>setEditShipData({...editShipData, lsaCapacity: Number(e.target.value)})} className="border border-blue-400 rounded p-1 w-16 text-center"/> : s.lsaCapacity}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <select value={editShipData.color} onChange={e=>setEditShipData({...editShipData, color: e.target.value})} className="border border-blue-400 rounded p-1">
                          <option value="blue">Blue</option><option value="emerald">Emerald</option><option value="purple">Purple</option><option value="rose">Rose</option><option value="amber">Amber</option><option value="slate">Slate</option>
                        </select>
                      ) : (
                        <div className={`w-4 h-4 rounded-full bg-${s.color}-500 mx-auto`}></div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2 items-center">
                          <button onClick={() => { onUpdateShip(editShipData); setEditingShipId(null); }} className="text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded font-bold text-xs shadow-sm">Save</button>
                          <button onClick={()=>setEditingShipId(null)} className="text-slate-400 hover:text-slate-600 text-xs font-medium">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                           <button onClick={() => { setEditingShipId(s.id); setEditShipData(s); }} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16}/></button>
                           <button onClick={()=>onDeleteShip(s.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-teal-50/50">
                <td className="p-3"><input type="text" placeholder="Ship Name" value={newShip.name} onChange={e=>setNewShip({...newShip, name: e.target.value})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none"/></td>
                <td className="p-3"><input type="text" placeholder="Flag" value={newShip.flag} onChange={e=>setNewShip({...newShip, flag: e.target.value})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none"/></td>
                <td className="p-3"><input type="number" value={newShip.minSafeManning} onChange={e=>setNewShip({...newShip, minSafeManning: Number(e.target.value)})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none text-center"/></td>
                <td className="p-3"><input type="number" value={newShip.cabinCapacity} onChange={e=>setNewShip({...newShip, cabinCapacity: Number(e.target.value)})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none text-center"/></td>
                <td className="p-3"><input type="number" value={newShip.lsaCapacity} onChange={e=>setNewShip({...newShip, lsaCapacity: Number(e.target.value)})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none text-center"/></td>
                <td className="p-3">
                  <select value={newShip.color} onChange={e=>setNewShip({...newShip, color: e.target.value})} className="w-full border border-teal-200 rounded p-1.5 text-sm outline-none bg-white">
                    <option value="blue">Blue</option><option value="emerald">Emerald</option><option value="purple">Purple</option><option value="rose">Rose</option><option value="amber">Amber</option><option value="slate">Slate</option>
                  </select>
                </td>
                <td className="p-3 text-right"><button onClick={addShip} disabled={!newShip.name} className="bg-teal-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">Add Ship</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><LayoutDashboard size={20} className="text-blue-500"/> Compliance Matrix (Ranks)</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Add or edit ranks, set check overlap logic, and define accepted competencies (licenses). These competencies populate the dropdowns elsewhere.</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr><th className="p-3 w-12">Ord.</th><th className="p-3 font-semibold w-40">Rank</th><th className="p-3 font-semibold w-32">Dept</th><th className="p-3 text-center font-semibold w-24">Overlap</th><th className="p-3 font-semibold">Competencies</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {matrix.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-2 text-center">
                    <div className="flex flex-col items-center">
                      <button onClick={()=>moveMatrix(i, -1)} className={`hover:bg-slate-200 rounded ${i===0?'text-slate-300':'text-slate-600'}`} disabled={i===0}><ChevronUp size={16}/></button>
                      <button onClick={()=>moveMatrix(i, 1)} className={`hover:bg-slate-200 rounded ${i===matrix.length-1?'text-slate-300':'text-slate-600'}`} disabled={i===matrix.length-1}><ChevronDown size={16}/></button>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-slate-800">
                    <input type="text" value={m.rank} onChange={e=>{const nm=[...matrix];nm[i].rank=e.target.value;setMatrix(nm);}} className="w-full border-none bg-transparent focus:ring-1 rounded p-1"/>
                  </td>
                  <td className="p-3">
                    <select className="border border-slate-300 rounded p-1.5 text-sm bg-white" value={m.dept} onChange={e => { const nm=[...matrix]; nm[i].dept=e.target.value; setMatrix(nm); }}>
                      <option>Deck</option><option>Engine</option><option>Other</option>
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={m.checkOverlap} onChange={e => { const nm=[...matrix]; nm[i].checkOverlap=e.target.checked; setMatrix(nm); }} className="rounded border-slate-300 w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="p-3 flex gap-1.5 flex-wrap items-center">
                    {(m.competencies || []).map((c, j) => (
                      <span key={j} className="bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded border border-slate-300 flex items-center gap-1">
                        {c} <button onClick={()=>removeCompetency(i,j)} className="hover:text-red-500"><X size={10}/></button>
                      </span>
                    ))}
                    <div className="flex items-center ml-2 border border-blue-200 rounded overflow-hidden">
                      <input type="text" placeholder="Add comp..." value={newCompText[i]||''} onChange={e=>setNewCompText({...newCompText, [i]: e.target.value})} className="text-xs p-1 w-24 outline-none"/>
                      <button onClick={()=>addCompetency(i)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 font-bold">+</button>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={()=>deleteRank(m.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50/50">
                <td className="p-3 text-center"><Plus size={16} className="text-blue-400 mx-auto"/></td>
                <td className="p-3"><input type="text" placeholder="New Rank Name" value={newRank.rank} onChange={e=>setNewRank({...newRank, rank: e.target.value})} className="w-full border border-blue-200 rounded p-1.5 text-sm"/></td>
                <td className="p-3">
                  <select className="border border-blue-200 rounded p-1.5 text-sm" value={newRank.dept} onChange={e=>setNewRank({...newRank, dept: e.target.value})}>
                    <option>Deck</option><option>Engine</option><option>Other</option>
                  </select>
                </td>
                <td className="p-3 text-center"><input type="checkbox" checked={newRank.checkOverlap} onChange={e=>setNewRank({...newRank, checkOverlap: e.target.checked})} className="rounded border-blue-300 w-4 h-4" /></td>
                <td className="p-3"><span className="text-xs text-blue-400 italic">Add competencies after saving.</span></td>
                <td className="p-3 text-right"><button onClick={addRank} disabled={!newRank.rank} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">Add</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><FileCheck size={20} className="text-green-500"/> Procedure Dynamic Columns</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Configure custom columns for the Procedures Follow Up table.</p>
        
        <ul className="space-y-2 mb-4">
          {procSchema.map(s => (
            <li key={s.id} className="flex flex-wrap gap-4 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
              <input type="text" value={s.name} onChange={e => { const ns=[...procSchema]; ns.find(x=>x.id===s.id).name=e.target.value; setProcSchema(ns); }} className="font-bold text-slate-700 w-40 border-none bg-transparent outline-none"/>
              <select value={s.type} onChange={e => { const ns=[...procSchema]; ns.find(x=>x.id===s.id).type=e.target.value; setProcSchema(ns); }} className="border border-slate-300 rounded p-1 text-xs">
                <option value="checkbox">Checkbox</option><option value="date">Date</option>
              </select>
              <select value={s.appliesTo} onChange={e => { const ns=[...procSchema]; ns.find(x=>x.id===s.id).appliesTo=e.target.value; setProcSchema(ns); }} className="border border-slate-300 rounded p-1 text-xs flex-1">
                <option value="onsigner">Onsigner Only</option><option value="offsigner">Offsigner Only</option><option value="both">Both</option>
              </select>
              <button onClick={()=>deleteColumn(s.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
            </li>
          ))}
        </ul>

        <div className="flex gap-3 items-center bg-green-50 p-3 rounded-lg border border-green-200">
           <input type="text" placeholder="New Column Name" value={newCol.name} onChange={e=>setNewCol({...newCol, name: e.target.value})} className="border border-green-300 rounded p-1.5 text-sm w-40"/>
           <select value={newCol.type} onChange={e=>setNewCol({...newCol, type: e.target.value})} className="border border-green-300 rounded p-1.5 text-sm">
             <option value="checkbox">Checkbox</option><option value="date">Date</option>
           </select>
           <select value={newCol.appliesTo} onChange={e=>setNewCol({...newCol, appliesTo: e.target.value})} className="border border-green-300 rounded p-1.5 text-sm flex-1">
             <option value="onsigner">Onsigner Only</option><option value="offsigner">Offsigner Only</option><option value="both">Both</option>
           </select>
           <button onClick={addColumn} disabled={!newCol.name} className="bg-green-600 text-white px-4 py-1.5 rounded font-bold text-sm disabled:opacity-50">Add Column</button>
        </div>
      </div>

      {/* 4. PROMOTION & RECRUITMENT MATRIX */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Briefcase size={20} className="text-purple-500"/> Promotion & Recruitment Matrix</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Define the approval steps for promotions and recruitment for each rank. Only users with the matching 'Job Title' can evaluate that step.</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr><th className="p-3 font-semibold w-48">Rank</th><th className="p-3 font-semibold">Approval Steps (in order)</th><th className="p-3 text-right"></th></tr>
            </thead>
            <tbody>
              {(promoMatrix||[]).map((pm, i) => (
                <tr key={pm.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800">{pm.rank}</td>
                  <td className="p-3 flex gap-2 flex-wrap items-center">
                    {pm.steps.map((stepRole, j) => (
                      <span key={j} className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-1 rounded border border-purple-200 flex items-center gap-1">
                        {j+1}. {stepRole} 
                        <button onClick={()=>{
                           const nm = [...promoMatrix]; nm[i].steps.splice(j,1); setPromoMatrix(nm);
                        }} className="hover:text-red-500 ml-1"><X size={10}/></button>
                      </span>
                    ))}
                    <div className="flex items-center ml-2 border border-purple-200 rounded overflow-hidden">
                      <select id={`promo-step-${i}`} className="text-xs p-1 outline-none bg-white border-none w-28">
                         {JOB_TITLES.map(j => <option key={j} value={j}>{j}</option>)}
                      </select>
                      <button onClick={()=>{
                         const val = document.getElementById(`promo-step-${i}`).value;
                         const nm = [...promoMatrix]; nm[i].steps.push(val); setPromoMatrix(nm);
                      }} className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1 font-bold text-xs border-l border-purple-200">+</button>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={()=>setPromoMatrix(promoMatrix.filter(x=>x.id!==pm.id))} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-purple-50/50">
                <td className="p-3">
                  <select value={newPromoRow.rank} onChange={e=>setNewPromoRow({...newPromoRow, rank: e.target.value})} className="w-full border border-purple-200 rounded p-1.5 text-sm bg-white outline-none">
                     <option value="">Select Rank</option>
                     {matrix.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <span className="text-xs text-purple-400 italic">Add Rank first, then add approval steps.</span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={addPromoRow} disabled={!newPromoRow.rank} className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">Add Rule</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CrewFormModal({ matrix, crewMember, onClose, onConfirm }) {
  const isEdit = !!crewMember;
  const [name, setName] = useState(crewMember?.name || '');
  const [competency, setCompetency] = useState(crewMember?.competency || '');
  const [readiness, setReadiness] = useState(crewMember?.readinessDate || '');

  const allComps = useMemo(() => {
    const set = new Set();
    (matrix || []).forEach(m => (m.competencies || []).forEach(c => set.add(c)));
    return Array.from(set);
  }, [matrix]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {isEdit ? <Edit2 size={20} className="text-blue-500"/> : <UserPlus size={20} className="text-blue-500"/>}
            {isEdit ? 'Edit Crew Details' : 'Add New Crew'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded shadow-sm border border-slate-200"><X size={18}/></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ahmet Yılmaz"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Competency (License)</label>
            <select className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white" value={competency} onChange={e=>setCompetency(e.target.value)}>
              <option value="">-- Select Competency --</option>
              {allComps.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Readiness Date (Optional)</label>
            <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" value={readiness} onChange={e=>setReadiness(e.target.value)}/>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
          <button 
            disabled={!name || !competency}
            onClick={() => onConfirm({ name, competency, readinessDate: readiness })} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Add to Pool'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ message, showConfirm, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">{showConfirm ? 'Confirm Deletion' : 'Cannot Delete'}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-center gap-3">
           <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-sm">Close</button>
           {showConfirm && (
             <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm">Yes, Delete</button>
           )}
        </div>
      </div>
    </div>
  );
}

function NotesModal({ isOpen, name, notes, currentUser, onClose, onAdd, onDelete }) {
  const [text, setText] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col h-[500px]">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate pr-2"><MessageCircle size={20} className="text-blue-500 shrink-0"/> Notes: {name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
          {notes?.length === 0 ? <p className="text-center text-slate-400 text-sm mt-10">No notes yet.</p> : 
            notes.map((n, i) => (
              <div key={n.id || i} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 group relative">
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{n.text}</p>
                <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 font-medium border-t border-slate-50 pt-2">
                  <span>{n.author}</span>
                  <span>{new Date(n.date).toLocaleString()}</span>
                </div>
                {currentUser.role === 'admin' && (
                  <button onClick={()=>onDelete(n.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white"><Trash2 size={14}/></button>
                )}
              </div>
            ))
          }
        </div>
        
        {currentUser.role !== 'viewer' && (
          <div className="p-4 border-t border-slate-200 bg-white rounded-b-xl flex gap-2 shrink-0">
            <input 
              type="text" placeholder="Type a note..." 
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={text} onChange={e=>setText(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && text) { onAdd(text); setText(''); } }}
            />
            <button disabled={!text} onClick={() => { onAdd(text); setText(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Login({ users, onLogin, isDbEmpty, onSeed }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password.');
    }
  };

  const handleInitialize = async () => {
    setSeeding(true);
    try {
      const result = await onSeed();
      if (result && !result.success) {
        setError(`Database Initialization Failed: ${result.error}. Please check your Firebase Firestore Security Rules and enable Anonymous Authentication.`);
      }
    } catch (err) {
      setError(`Unexpected Error: ${err.message}`);
    }
    setSeeding(false);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] items-center justify-center font-sans text-slate-800 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#0f172a] p-3.5 rounded-2xl mb-4 shadow-lg shadow-slate-900/30">
             <ArmonaLogo className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-wide text-center">ARMONA CREW MANAGER</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Please sign in to your account</p>
        </div>

        {isDbEmpty ? (
           <div className="space-y-4 text-center">
              <div className="bg-amber-50 text-amber-700 p-4 rounded-lg border border-amber-200 text-sm">
                 <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500"/>
                 <strong>Database is empty!</strong><br/>
                 Click the button below to initialize the default Admin account and configuration.
              </div>
              
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-medium border border-red-200 text-left">{error}</div>}

              <button onClick={handleInitialize} disabled={seeding} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                 {seeding ? 'Initializing Database...' : 'Initialize First Run Data'}
              </button>
           </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-200 flex items-center justify-center gap-2"><AlertTriangle size={16}/> {error}</div>}
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Username</label>
              <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all bg-slate-50 focus:bg-white font-medium" required />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all bg-slate-50 focus:bg-white font-medium" required />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors mt-2 shadow-sm">Secure Sign In</button>
          </form>
        )}
        
        <div className="mt-8 text-center text-xs text-slate-400 font-medium">
          Custom Crewing Software <br/> designed by Batuhan Tas
        </div>
      </div>
    </div>
  );
}

function PromotionsRecruitment({ promotions, matrix, ranks, currentUser, onAdd, onUpdate, onDelete, onUpdateStep }) {
  const [tab, setTab] = useState('active');
  const [editModal, setEditModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [fType, setFType] = useState('');
  const [fRank, setFRank] = useState('');
  const [fName, setFName] = useState('');

  const [newPromo, setNewPromo] = useState({ name: '', rank: '', type: 'recruitment' });

  const displayData = promotions.filter(p => {
    if (p.status !== tab) return false;
    if (fType && p.type !== fType) return false;
    if (fRank && p.rank !== fRank) return false;
    if (fName && !(p.name || '').toLowerCase().includes(fName.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    if (!newPromo.name || !newPromo.rank) return;
    const rule = matrix.find(m => m.rank === newPromo.rank);
    if (!rule || !rule.steps || rule.steps.length === 0) {
      alert("Please define a Promotion/Recruitment rule for this Rank in Settings first!");
      return;
    }
    
    const stepsData = rule.steps.map(s => ({ role: s, date: '', score: '', reject: false, note: '' }));
    
    onAdd({
      id: 'pr' + Date.now(),
      name: newPromo.name,
      rank: newPromo.rank,
      type: newPromo.type,
      status: 'active',
      steps: stepsData,
      creationDate: new Date().toISOString().split('T')[0]
    });
    setAddModal(false);
    setNewPromo({ name: '', rank: '', type: 'recruitment' });
  };

  const calculateAvg = (steps) => {
    if (steps.some(s => s.reject)) return 'REJECTED';
    const scores = steps.map(s => Number(s.score)).filter(s => !isNaN(s) && s > 0);
    if (scores.length === 0) return '-';
    return (scores.reduce((a,b) => a + b, 0) / scores.length).toFixed(1);
  };

  const getAvgColor = (avg) => {
    if (avg === 'REJECTED') return 'bg-red-100 text-red-700 border-red-300';
    if (avg === '-') return 'bg-slate-100 text-slate-500 border-slate-200';
    const s = Number(avg);
    if (s < 60) return 'bg-red-100 text-red-700 border-red-300';
    if (s <= 75) return 'bg-orange-100 text-orange-700 border-orange-300';
    if (s <= 85) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const handleExport = () => {
    let csv = "Type,Name,Rank,Status,Average Score\n";
    displayData.forEach(d => {
      let row = `${d.type},${d.name},${d.rank},${d.status},${calculateAvg(d.steps)}`;
      csv += row + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `promotions_recruitment_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Promotions & Recruitment</h1>
        <div className="flex items-center gap-3">
           <div className="bg-slate-200 p-1 rounded-md flex text-sm font-medium shadow-sm">
             <button onClick={() => setTab('active')} className={`px-4 py-1 rounded transition-colors ${tab==='active'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Active</button>
             <button onClick={() => setTab('archived')} className={`px-4 py-1 rounded transition-colors ${tab==='archived'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Archived</button>
           </div>
           {currentUser.role !== 'viewer' && tab === 'active' && (
             <button onClick={() => setAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1 transition-colors"><Plus size={16}/> New Candidate</button>
           )}
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end shrink-0 justify-between">
         <div className="flex gap-3">
             <div className="flex items-center gap-2 text-sm text-slate-500 mr-2"><Filter size={16}/> Filters:</div>
             <div>
               <label className="block text-xs text-slate-400 mb-0.5">Type</label>
               <select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none w-32" value={fType} onChange={e=>setFType(e.target.value)}>
                 <option value="">All</option><option value="recruitment">Recruitment</option><option value="promotion">Promotion</option>
               </select>
             </div>
             <div>
               <label className="block text-xs text-slate-400 mb-0.5">Rank</label>
               <select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none w-32" value={fRank} onChange={e=>setFRank(e.target.value)}>
                 <option value="">All Ranks</option>
                 {ranks.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs text-slate-400 mb-0.5">Name</label>
               <input type="text" placeholder="Search..." className="border border-slate-300 rounded text-sm p-1.5 w-40 focus:outline-none" value={fName} onChange={e=>setFName(e.target.value)} />
             </div>
             {(fType||fRank||fName) && (
                <button onClick={()=>{setFType('');setFRank('');setFName('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>
             )}
         </div>
         <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors mb-0.5">Export to Excel</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 p-2">
           <div className="space-y-3">
              {displayData.map(p => {
                const avg = calculateAvg(p.steps);
                const isRejected = p.steps.some(s => s.reject);

                return (
                  <div key={p.id} className={`border rounded-xl p-4 relative overflow-hidden group shadow-sm transition-shadow hover:shadow-md ${p.type === 'recruitment' ? 'border-sky-200 bg-sky-50/30' : 'border-purple-200 bg-purple-50/30'}`}>
                     <div className={`absolute top-0 left-0 w-1.5 h-full ${p.type === 'recruitment' ? 'bg-sky-500' : 'bg-purple-500'}`}></div>
                     
                     <div className="flex justify-between items-start pl-2 mb-3 border-b border-slate-200/50 pb-3">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.type === 'recruitment' ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}`}>{p.type}</span>
                              <span className="text-xs text-slate-400">Created: {p.creationDate}</span>
                           </div>
                           <h3 className="text-lg font-bold text-slate-800">{p.name} <span className="text-sm font-medium text-slate-500 ml-1">({p.rank})</span></h3>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm shadow-sm flex flex-col items-center leading-tight min-w-[70px] ${getAvgColor(avg)}`}>
                             <span className="text-[10px] font-semibold opacity-80 mb-0.5">AVG. SCORE</span>
                             {avg}
                           </div>
                           
                           {tab === 'active' && currentUser.role !== 'viewer' ? (
                              <div className="flex gap-2">
                                <button onClick={() => setEditModal(p)} className="bg-white hover:bg-slate-50 text-blue-600 px-3 py-1.5 rounded border border-slate-200 font-bold text-xs shadow-sm transition-colors">Evaluate</button>
                                {currentUser.role === 'admin' && (
                                  <>
                                    <button onClick={() => onUpdate(p.id, 'status', 'archived')} className="bg-white hover:bg-slate-50 text-emerald-600 px-3 py-1.5 rounded border border-slate-200 font-bold text-xs shadow-sm transition-colors" title="Complete Process">Complete</button>
                                    <button onClick={() => setDeleteConfirmId(p.id)} className="bg-white hover:bg-slate-50 text-slate-400 hover:text-red-500 px-2 py-1.5 rounded border border-slate-200 transition-colors shadow-sm"><Trash2 size={16}/></button>
                                  </>
                                )}
                              </div>
                           ) : (
                              <div className="flex items-center">
                                 {currentUser.role === 'admin' && <button onClick={() => onUpdate(p.id, 'status', 'active')} className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-xs font-medium mr-3"><RotateCcw size={14}/> Restore</button>}
                                 <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase tracking-wide">Archived</span>
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="pl-2 flex flex-wrap gap-2">
                        {p.steps.map((step, idx) => (
                           <div key={idx} className={`flex-1 min-w-[200px] border rounded-lg p-2.5 flex flex-col gap-1.5 bg-white shadow-sm ${step.reject ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                <span className="font-bold text-slate-700 text-xs">{idx+1}. {step.role}</span>
                                {step.date && <span className="text-[10px] text-slate-400">{step.date}</span>}
                              </div>
                              
                              {step.reject ? (
                                <div className="text-red-600 font-bold text-xs flex items-center gap-1 justify-center py-2 bg-red-100 rounded border border-red-200"><X size={14}/> DIRECT REJECT</div>
                              ) : (
                                <div className="flex items-center justify-between mt-1">
                                  {step.note ? (
                                     <button className="text-blue-500 cursor-help opacity-70 hover:opacity-100 text-[11px] font-medium flex items-center gap-1" title={step.note}><Info size={12} /> View Note</button>
                                  ) : <span className="text-[10px] text-slate-300 italic">No notes</span>}
                                  
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700`}>
                                     {step.score ? `${step.score}/100` : '-'}
                                  </span>
                                </div>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
                );
              })}
              {displayData.length === 0 && <div className="text-center py-20 text-slate-400">No records found.</div>}
           </div>
        </div>
      </div>

      {addModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">Add Candidate</h2>
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Process Type</label>
                 <select value={newPromo.type} onChange={e=>setNewPromo({...newPromo, type: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm bg-white outline-none">
                    <option value="recruitment">Recruitment (External)</option>
                    <option value="promotion">Promotion (Internal)</option>
                 </select>
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name</label>
                 <input type="text" value={newPromo.name} onChange={e=>setNewPromo({...newPromo, name: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none"/>
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Target Rank</label>
                 <select value={newPromo.rank} onChange={e=>setNewPromo({...newPromo, rank: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm bg-white outline-none">
                    <option value="">-- Select Rank --</option>
                    {ranks.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
                 </select>
                 <p className="text-[10px] text-slate-400 mt-1">Approval steps will be generated automatically based on Settings.</p>
               </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button onClick={()=>setAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={handleCreate} disabled={!newPromo.name || !newPromo.rank} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50">Create Process</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-slate-50 rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{editModal.type}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">{editModal.name} <span className="text-sm font-medium text-slate-500">({editModal.rank})</span></h2>
               </div>
               <button onClick={()=>setEditModal(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded shadow-sm border border-slate-200"><X size={20}/></button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 bg-slate-100/50">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {editModal.steps.map((step, idx) => {
                   // Güvenlik ve Yetkilendirme Kontrolü
                   const isAdminOrCTO = currentUser.role === 'admin' || currentUser.jobTitle === 'CTO';
                   const isMyStep = currentUser.jobTitle === step.role;
                   const canEdit = isAdminOrCTO || isMyStep;

                   return (
                     <div key={idx} className={`bg-white p-4 rounded-xl border shadow-sm relative ${step.reject ? 'border-red-300' : canEdit ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200 opacity-80'}`}>
                       {!canEdit && <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">READ ONLY</div>}
                       
                       <div className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">{idx+1}</span> 
                          {step.role}
                       </div>
                       
                       <div className="space-y-3">
                         <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Evaluation Date</label>
                           <input type="date" disabled={!canEdit} value={step.date || ''} onChange={e=>{
                             onUpdateStep(editModal.id, idx, 'date', e.target.value);
                             const nm = {...editModal}; nm.steps[idx].date = e.target.value; setEditModal(nm);
                           }} className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none bg-slate-50 disabled:bg-slate-100"/>
                         </div>
                         
                         <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                           <textarea disabled={!canEdit} placeholder="Enter comments..." value={step.note || ''} onChange={e=>{
                             onUpdateStep(editModal.id, idx, 'note', e.target.value);
                             const nm = {...editModal}; nm.steps[idx].note = e.target.value; setEditModal(nm);
                           }} className="w-full border border-slate-300 rounded p-2 text-sm outline-none resize-none h-16 bg-slate-50 disabled:bg-slate-100"/>
                         </div>
                         
                         <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Score (0-100)</label>
                              <input type="number" max="100" min="0" disabled={!canEdit || step.reject} value={step.score || ''} onChange={e=>{
                                onUpdateStep(editModal.id, idx, 'score', e.target.value);
                                const nm = {...editModal}; nm.steps[idx].score = e.target.value; setEditModal(nm);
                              }} className="w-full border border-slate-300 rounded p-1.5 text-sm outline-none font-bold text-blue-600 bg-slate-50 disabled:bg-slate-100 text-center"/>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center border border-red-200 rounded bg-red-50/50 mt-4 cursor-pointer">
                              <label className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer w-full h-full justify-center p-1 rounded transition-colors ${step.reject ? 'text-white bg-red-500' : 'text-red-500 hover:bg-red-100'}`}>
                                <input type="checkbox" disabled={!canEdit} checked={step.reject || false} onChange={e=>{
                                   const isRej = e.target.checked;
                                   onUpdateStep(editModal.id, idx, 'reject', isRej);
                                   if(isRej) onUpdateStep(editModal.id, idx, 'score', ''); // Clear score if rejected
                                   const nm = {...editModal}; nm.steps[idx].reject = isRej; if(isRej) nm.steps[idx].score=''; setEditModal(nm);
                                }} className="hidden"/>
                                <X size={14} strokeWidth={3}/> DIRECT REJECT
                              </label>
                            </div>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button onClick={()=>setEditModal(null)} className="px-8 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">Close / Done</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <DeleteConfirmModal 
          message="Are you sure you want to permanently delete this record?" 
          showConfirm={true} 
          onClose={() => setDeleteConfirmId(null)} 
          onConfirm={() => { onDelete(deleteConfirmId); setDeleteConfirmId(null); }} 
        />
      )}
    </div>
  );
}