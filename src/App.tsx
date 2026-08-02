// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Ship, LayoutDashboard, FileCheck, Star, Settings, 
  MessageCircle, AlertTriangle, Calendar, Plus, X, Search, 
  ChevronRight, ChevronDown, ChevronUp, UserCheck, 
  Archive, Edit2, LogOut, UserPlus, Trash2, Filter, Info, RotateCcw,
  UserCheck as RecruitIcon, Briefcase
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';

const customFirebaseConfig = {
  apiKey: "AIzaSyDob7zaTPNIDBgoMH9WBiEBSBp91atzJDA",
  authDomain: "armona-crew-manager.firebaseapp.com",
  projectId: "armona-crew-manager",
  storageBucket: "armona-crew-manager.firebasestorage.app",
  messagingSenderId: "916422821733",
  appId: "1:916422821733:web:ffeef86ed539928cca838c"
};

let firebaseConfigObj = customFirebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined') firebaseConfigObj = JSON.parse(__firebase_config);
} catch (err) { console.warn("Using local firebase config."); }

const app = initializeApp(firebaseConfigObj);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = typeof __app_id !== 'undefined' ? __app_id : 'armona-crew-manager';
const getPath = (col) => typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/${col}` : col;

const JOB_TITLES = ['Admin', 'Crew Manager', 'Welfare Officer', 'Marine S.I.', 'Tech S.I.', 'Tech. Manager', 'DPA', 'Marine Manager', 'CTO', 'Other'];

const ArmonaLogo = ({ className = "w-8 h-8" }) => (
  <img src="https://www.atlantis-tankers.com/assets/images/logo.png" alt="Armona Crew Manager Logo" className={`${className} object-contain`} />
);

const generateId = () => Math.random().toString(36).substr(2, 9);
const today = new Date();

const getScoreColor = (score) => {
  if (!score && score !== 0) return 'text-slate-600 bg-slate-100';
  const s = Number(score);
  if (s < 60) return 'text-white bg-red-500';
  if (s <= 75) return 'text-white bg-orange-500';
  if (s <= 85) return 'text-slate-800 bg-yellow-400';
  return 'text-white bg-green-500';
};

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('armonaCurrentUser');
    return saved ? JSON.parse(saved) : null;
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
  const [deleteWarnModal, setDeleteWarnModal] = useState({ isOpen: false, message: '', crewId: null, callback: null });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (err) { console.error("Firebase Auth Error:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setFbUser);
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    
    const unsubShips = onSnapshot(collection(db, getPath('ships')), snap => setShips(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubCrew = onSnapshot(collection(db, getPath('crew')), snap => setCrew(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubProcs = onSnapshot(collection(db, getPath('procedures')), snap => setProcedures(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubEvals = onSnapshot(collection(db, getPath('evaluations')), snap => setEvaluations(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubDebriefs = onSnapshot(collection(db, getPath('debriefings')), snap => setDebriefings(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    const unsubPromos = onSnapshot(collection(db, getPath('promotions')), snap => setPromotions(snap.docs.map(d => ({id: d.id, ...d.data()}))), console.error);
    
    const unsubUsers = onSnapshot(collection(db, getPath('appUsers')), snap => {
      setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
      setIsDbLoading(false);
    }, console.error);

    const unsubMatrix = onSnapshot(doc(db, getPath('settings'), 'rank_matrix'), snap => { if(snap.exists()) setMatrix(snap.data().items || []); }, console.error);
    const unsubSchema = onSnapshot(doc(db, getPath('settings'), 'proc_schema'), snap => { if(snap.exists()) setProcSchema(snap.data().items || []); }, console.error);
    const unsubPromoMat = onSnapshot(doc(db, getPath('settings'), 'promo_matrix'), snap => { if(snap.exists()) setPromoMatrix(snap.data().items || []); }, console.error);

    return () => { unsubShips(); unsubCrew(); unsubProcs(); unsubEvals(); unsubDebriefs(); unsubPromos(); unsubUsers(); unsubMatrix(); unsubSchema(); unsubPromoMat(); };
  }, [fbUser]);

  const handleLogin = (user) => { setCurrentUser(user); localStorage.setItem('armonaCurrentUser', JSON.stringify(user)); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('armonaCurrentUser'); };

  // Note Handlers
  const handleAddNote = async (targetId, targetType, text) => {
    const note = { id: generateId(), author: currentUser.username, text, date: new Date().toISOString() };
    const colName = targetType === 'ship' ? 'ships' : 'crew';
    const existing = (targetType === 'ship' ? ships : crew).find(x => x.id === targetId);
    if(existing) await updateDoc(doc(db, getPath(colName), targetId), { notes: [...(existing.notes || []), note] });
  };
  const handleDeleteNote = async (targetId, targetType, noteId) => {
    const colName = targetType === 'ship' ? 'ships' : 'crew';
    const existing = (targetType === 'ship' ? ships : crew).find(x => x.id === targetId);
    if(existing) await updateDoc(doc(db, getPath(colName), targetId), { notes: existing.notes.filter(n => n.id !== noteId) });
  };

  const attemptDeleteCrew = (c) => {
    if (c.shipId || (c.contractStart && new Date(c.contractStart).getTime() > today.getTime())) {
      setDeleteWarnModal({ isOpen: true, message: `Cannot delete ${c.name}. They are assigned to a vessel or have a planned contract. Sign them off first.`, crewId: null });
    } else {
      setDeleteWarnModal({ isOpen: true, message: `Are you sure you want to permanently delete ${c.name}?`, crewId: c.id, callback: async () => {
         await deleteDoc(doc(db, getPath('crew'), c.id));
      }});
    }
  };

  if (isDbLoading && fbUser) return <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">Loading database...</div>;
  if (!currentUser) return <Login users={users} onLogin={handleLogin} isDbEmpty={users.length === 0} onSeed={async () => {
     await setDoc(doc(db, getPath('appUsers'), 'u1'), { username: 'Admin', password: 'Bt.admin.86!', role: 'admin', jobTitle: 'Admin' });
     window.location.reload();
  }} />;

  const activeDebriefsCount = debriefings.filter(d => d.status === 'active').length;
  const activePromoCount = promotions.filter(p => p.status === 'active').length;

  return (
    <div className="flex flex-col h-screen bg-[#f1f5f9] text-slate-800 font-sans">
      <header className="bg-[#0f172a] text-white px-6 py-3 flex justify-between items-center shadow-md z-10 shrink-0">
        <div className="font-bold text-lg flex items-center gap-3 tracking-wide w-72">
          <ArmonaLogo className="w-7 h-7" /> ARMONA CREW MANAGER
        </div>
        <nav className="flex-1 flex justify-center items-center gap-2 overflow-x-auto mx-4">
          <TopNavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          {currentUser.role !== 'viewer' && <TopNavItem icon={<FileCheck />} label="Procedures" active={activeTab === 'procedures'} onClick={() => setActiveTab('procedures')} />}
          <TopNavItem icon={<Star />} label="Evals" active={activeTab === 'eval_overview'} onClick={() => setActiveTab('eval_overview')} />
          {currentUser.role !== 'viewer' && <TopNavItem icon={<UserCheck />} label="Debriefings" active={activeTab === 'debriefings'} onClick={() => setActiveTab('debriefings')} badge={activeDebriefsCount} />}
          <TopNavItem icon={<Briefcase />} label="Promo/Recruit" active={activeTab === 'promo'} onClick={() => setActiveTab('promo')} badge={activePromoCount} />
          {currentUser.role === 'admin' && <TopNavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
        </nav>
        <div className="flex items-center gap-4 border-l border-slate-700 pl-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-right">Hi, <strong className="text-white">{currentUser.username}</strong><br/><span className="text-[10px] opacity-70">{currentUser.jobTitle}</span></span>
            <span className="bg-slate-800 px-2 py-1 rounded text-[10px] uppercase font-bold text-slate-400 border border-slate-600">{currentUser.role}</span>
          </div>
          <LogOut size={18} className="text-slate-400 hover:text-red-400 cursor-pointer" onClick={handleLogout} title="Sign Out" />
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <main className="absolute inset-0 overflow-y-auto p-4 md:p-6">
          {activeTab === 'dashboard' && (
            <Dashboard ships={ships} crew={crew} matrix={matrix} currentUser={currentUser} today={today}
              onOpenLineup={(shipId) => setLineupModal({ isOpen: true, shipId })}
              onOpenNotes={(id, type, name) => setNotesModal({ isOpen: true, targetId: id, targetType: type, targetName: name })}
              onAssign={(c) => setAssignModal({ isOpen: true, crew: c })} onAddCrew={() => setCrewFormModal({ isOpen: true, crew: null })}
              onEditCrew={(c) => setCrewFormModal({ isOpen: true, crew: c })} onDeleteCrew={attemptDeleteCrew}
            />
          )}
          {activeTab === 'procedures' && currentUser.role !== 'viewer' && (
            <Procedures procedures={procedures} schema={procSchema} currentUser={currentUser} db={db} getPath={getPath} generateId={generateId}
              onAddEval={(proc) => { setEvalPrefill(proc); setActiveTab('eval_add'); updateDoc(doc(db, getPath('procedures'), proc.id), { evaluationDone: true }); }}
              onAddDebrief={(proc) => {
                const newDebrief = { crewName: proc.crewName, shipName: proc.shipName, rank: proc.rank, signOffDate: proc.date, startDate: '', endDate: '', status: 'active', depts: [{name:'Deck', note:'', score:''},{name:'Engine', note:'', score:''},{name:'Safety', note:'', score:''},{name:'HR', note:'', score:''}] };
                setDoc(doc(db, getPath('debriefings'), generateId()), newDebrief);
                updateDoc(doc(db, getPath('procedures'), proc.id), { debriefDone: true });
                setActiveTab('debriefings');
              }}
            />
          )}
          {activeTab === 'eval_overview' && <EvaluationsOverview evals={evaluations} ships={ships} matrix={matrix} currentUser={currentUser} db={db} getPath={getPath} setEvalPrefill={setEvalPrefill} setActiveTab={setActiveTab} />}
          {activeTab === 'eval_add' && currentUser.role !== 'viewer' && <EvaluationsAdd currentUser={currentUser} crew={crew} ships={ships} prefillData={evalPrefill} today={today} db={db} getPath={getPath} generateId={generateId} onClearPrefill={() => setEvalPrefill(null)} setActiveTab={setActiveTab} />}
          {activeTab === 'debriefings' && <Debriefings debriefings={debriefings} currentUser={currentUser} db={db} getPath={getPath} generateId={generateId} ships={ships} matrix={matrix} />}
          {activeTab === 'promo' && <PromotionsRecruitment promotions={promotions} promoMatrix={promoMatrix} currentUser={currentUser} db={db} getPath={getPath} generateId={generateId} matrix={matrix} />}
          {activeTab === 'settings' && currentUser.role === 'admin' && <SettingsPage matrix={matrix} setMatrix={async (nm) => await setDoc(doc(db, getPath('settings'), 'rank_matrix'), { items: nm })} procSchema={procSchema} setProcSchema={async (ns) => await setDoc(doc(db, getPath('settings'), 'proc_schema'), { items: ns })} promoMatrix={promoMatrix} setPromoMatrix={async (pm) => await setDoc(doc(db, getPath('settings'), 'promo_matrix'), { items: pm })} users={users} db={db} getPath={getPath} ships={ships} currentUser={currentUser} setCurrentUser={handleLogin} />}
        </main>
      </div>

      {/* Shared Modals */}
      {lineupModal.isOpen && <LineupModal ship={ships.find(s => s.id === lineupModal.shipId)} crew={crew.filter(c => c.shipId === lineupModal.shipId)} matrix={matrix} currentUser={currentUser} today={today} onClose={() => setLineupModal({ isOpen: false, shipId: null })} onSignOff={(c) => setSignOffModal({ isOpen: true, crew: c })} onNotes={(id, name) => setNotesModal({ isOpen: true, targetId: id, targetType: 'crew', targetName: name })} onEditContract={(c) => setEditContractModal({ isOpen: true, crew: c })} />}
      {notesModal.isOpen && <NotesModal isOpen={notesModal.isOpen} name={notesModal.targetName} notes={notesModal.targetType === 'ship' ? ships.find(s=>s.id === notesModal.targetId)?.notes || [] : crew.find(c=>c.id === notesModal.targetId)?.notes || []} onClose={() => setNotesModal({ isOpen: false, targetId: null, targetType: null })} onAdd={(txt) => handleAddNote(notesModal.targetId, notesModal.targetType, txt)} onDelete={(noteId) => handleDeleteNote(notesModal.targetId, notesModal.targetType, noteId)} currentUser={currentUser} />}
      {assignModal.isOpen && (
        <AssignModal crewMember={assignModal.crew} ships={ships} matrix={matrix} onboardCrew={crew.filter(c=>c.status==='onboard')} onClose={() => setAssignModal({ isOpen: false, crew: null })} onConfirm={async (shipId, rank, start, end, overlap, addToProc) => {
          if (!assignModal.crew) return;
          if (overlap === 'relieve') {
             const existing = crew.find(c => c.shipId === shipId && c.rank === rank && c.status === 'onboard');
             if (existing) await updateDoc(doc(db, getPath('crew'), existing.id), { status: 'onleave', shipId: null });
          }
          await updateDoc(doc(db, getPath('crew'), assignModal.crew.id), { status: 'onboard', shipId, rank, contractStart: start, contractEnd: end });
          if (addToProc) {
             const rankInfo = matrix.find(m => m.rank === rank);
             await setDoc(doc(db, getPath('procedures'), generateId()), { crewId: assignModal.crew.id, crewName: assignModal.crew.name, rank: rank, dept: rankInfo?.dept || 'Other', shipName: ships.find(s=>s.id===shipId)?.name, type: 'onsigner', date: start, status: 'active', evaluationDone: false, debriefDone: false, dynamicData: {}, notes: [] });
          }
          setAssignModal({ isOpen: false, crew: null });
        }}/>
      )}
      {signOffModal.isOpen && (
        <SignOffModal crewMember={signOffModal.crew} today={today} onClose={() => setSignOffModal({ isOpen: false, crew: null })} onConfirm={async (date, addToProc) => {
          if(!signOffModal.crew) return;
          await updateDoc(doc(db, getPath('crew'), signOffModal.crew.id), { status: 'onleave', shipId: null, contractStart: '', contractEnd: '' });
          if (addToProc) {
             const rankInfo = matrix.find(m => m.rank === signOffModal.crew.rank);
             const dept = rankInfo?.dept || 'Other';
             let snapshotData = null;
             if (['Master', 'Chief Engineer'].includes(signOffModal.crew.rank)) {
                snapshotData = crew.filter(c => c.shipId === signOffModal.crew.shipId && c.id !== signOffModal.crew.id && c.contractStart && new Date(c.contractStart).getTime() <= today.getTime() && matrix.find(m => m.rank === c.rank)?.dept === dept).map(c => ({ name: c.name, rank: c.rank, score: '' }));
             } else {
                const managerRank = dept === 'Engine' ? 'Chief Engineer' : 'Master';
                const manager = crew.find(c => c.shipId === signOffModal.crew.shipId && c.rank === managerRank && c.contractStart && new Date(c.contractStart).getTime() <= today.getTime());
                snapshotData = manager ? manager.name : 'Office';
             }
             await setDoc(doc(db, getPath('procedures'), generateId()), { crewId: signOffModal.crew.id, crewName: signOffModal.crew.name, rank: signOffModal.crew.rank, dept: dept, shipName: ships.find(s=>s.id===signOffModal.crew.shipId)?.name, type: 'offsigner', date: date, status: 'active', evaluationDone: false, debriefDone: false, dynamicData: {}, notes: [], evalSnapshot: snapshotData });
          }
          setSignOffModal({ isOpen: false, crew: null });
        }} />
      )}
      {crewFormModal.isOpen && <CrewFormModal matrix={matrix} crewMember={crewFormModal.crew} onClose={() => setCrewFormModal({ isOpen: false, crew: null })} onConfirm={async (data) => { if(crewFormModal.crew) await updateDoc(doc(db, getPath('crew'), crewFormModal.crew.id), data); else await setDoc(doc(db, getPath('crew'), generateId()), { ...data, status: 'onleave', shipId: null, contractStart: '', contractEnd: '', notes: [], isProbation: false, rank: 'TBA' }); setCrewFormModal({ isOpen: false, crew: null }); }} />}
      {editContractModal.isOpen && <EditContractModal crewMember={editContractModal.crew} onClose={() => setEditContractModal({ isOpen: false, crew: null })} onConfirm={async (s, e) => { if(editContractModal.crew?.id) await updateDoc(doc(db, getPath('crew'), editContractModal.crew.id), { contractStart: s, contractEnd: e }); setEditContractModal({ isOpen: false, crew: null }); }} />}
      {deleteWarnModal.isOpen && <DeleteConfirmModal message={deleteWarnModal.message} showConfirm={!!deleteWarnModal.callback} onClose={() => setDeleteWarnModal({ isOpen: false, message: '', crewId: null, callback: null })} onConfirm={() => { if(deleteWarnModal.callback) deleteWarnModal.callback(); setDeleteWarnModal({ isOpen: false, message: '', crewId: null, callback: null }); }} />}
    </div>
  );
}

function TopNavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm font-medium whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
      {React.cloneElement(icon, { size: 16 })} {label}
      {badge > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-sm">{badge}</span>}
    </button>
  );
}

function PromotionsRecruitment({ promotions, promoMatrix, currentUser, db, getPath, generateId, matrix }) {
  const [tab, setTab] = useState('active');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Add Form State
  const [newPromo, setNewPromo] = useState({ type: 'promotion', crewName: '', currentRank: '', targetRank: '' });

  const displayData = promotions.filter(p => p.status === tab);

  const exportToCSV = () => {
    if(displayData.length === 0) return;
    const csvRows = [];
    // Dynamic headers based on max steps in displayData
    let maxSteps = 0;
    displayData.forEach(d => { if(d.stepsData.length > maxSteps) maxSteps = d.stepsData.length; });
    const headers = ['Name', 'Target Rank', 'Type'];
    for(let i=1; i<=maxSteps; i++) { headers.push(`Step ${i} Role`); headers.push(`Step ${i} Date`); headers.push(`Step ${i} Score`); headers.push(`Step ${i} Notes`); }
    headers.push('Avg Score', 'Status');
    csvRows.push(headers.join(','));

    displayData.forEach(row => {
      const scores = row.stepsData.map(s => Number(s.score)).filter(s => !isNaN(s) && s > 0);
      const isRejected = row.stepsData.some(s => s.isRejected);
      let avg = scores.length > 0 ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '';
      let finalStatus = isRejected ? 'REJECTED' : (row.stepsData.every(s=>s.score || s.isRejected) ? 'COMPLETED' : 'PENDING');

      const csvData = [`"${row.crewName}"`, `"${row.targetRank}"`, `"${row.type}"`];
      row.stepsData.forEach(step => {
         csvData.push(`"${step.roleName}"`, `"${step.date}"`, `"${step.isRejected ? 'REJECTED' : step.score}"`, `"${step.note.replace(/"/g, '""')}"`);
      });
      // Fill empty steps if this row has fewer steps than maxSteps
      for(let i=row.stepsData.length; i<maxSteps; i++) { csvData.push('', '', '', ''); }
      csvData.push(`"${avg}"`, `"${finalStatus}"`);
      csvRows.push(csvData.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `promo_recruit_archive.csv`;
    link.click();
  };

  const handleCreate = async () => {
    const pMatrix = promoMatrix.find(m => m.targetRank === newPromo.targetRank);
    if (!pMatrix || !pMatrix.steps || pMatrix.steps.length === 0) {
       alert("No approval matrix found for this target rank. Please configure it in Settings first.");
       return;
    }
    const initSteps = pMatrix.steps.map(role => ({ roleName: role, date: '', note: '', score: '', isRejected: false, filledBy: '' }));
    
    await setDoc(doc(db, getPath('promotions'), generateId()), {
       ...newPromo, status: 'active', dateAdded: new Date().toISOString(), stepsData: initSteps
    });
    setAddModal(false);
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Promotions & Recruitment</h1>
        <div className="flex items-center gap-3">
          {currentUser.role !== 'viewer' && (
             <button onClick={() => { setNewPromo({ type: 'promotion', crewName: '', currentRank: '', targetRank: '' }); setAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-2">
               <Plus size={14}/> Add New
             </button>
          )}
          {tab === 'archived' && (
             <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm transition-colors">Export to Excel</button>
          )}
          <div className="bg-slate-200 p-1 rounded-md flex text-sm font-medium shrink-0 shadow-sm">
            <button onClick={() => setTab('active')} className={`px-4 py-1 rounded transition-colors ${tab==='active'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Active</button>
            <button onClick={() => setTab('archived')} className={`px-4 py-1 rounded transition-colors ${tab==='archived'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Archived</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 p-2">
          {tab === 'active' ? (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 sticky top-0 bg-white z-10">
                <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Target Rank</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {displayData.map(p => {
                  const completedSteps = p.stepsData.filter(s => s.score || s.isRejected).length;
                  const isRejected = p.stepsData.some(s => s.isRejected);
                  const progressPct = (completedSteps / p.stepsData.length) * 100;
                  const rowBg = p.type === 'promotion' ? 'bg-purple-50/40 hover:bg-purple-50/80' : 'bg-blue-50/40 hover:bg-blue-50/80';
                  const badgeColor = p.type === 'promotion' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200';

                  return (
                    <tr key={p.id} className={`border-b border-slate-100 transition-colors ${rowBg}`}>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${badgeColor}`}>{p.type}</span></td>
                      <td className="px-4 py-3"><div className="font-bold text-slate-800">{p.crewName}</div><div className="text-[11px] text-slate-500">Current: {p.currentRank || 'N/A (External)'}</div></td>
                      <td className="px-4 py-3 font-bold text-slate-700">{p.targetRank}</td>
                      <td className="px-4 py-3">
                         {isRejected ? <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">REJECTED</span> : (
                            <div className="w-48">
                              <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{completedSteps} / {p.stepsData.length} Completed</span></div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{width: `${progressPct}%`}}></div></div>
                            </div>
                         )}
                      </td>
                      <td className="px-4 py-3 text-right">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => setEditModal(p)} className="text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded border border-blue-200 font-medium text-xs bg-white shadow-sm">Review / Fill</button>
                           {currentUser.role === 'admin' && <button onClick={() => setDeleteConfirmId(p.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                         </div>
                      </td>
                    </tr>
                  );
                })}
                {displayData.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">No active processes found.</td></tr>}
              </tbody>
            </table>
          ) : (
            <div className="space-y-3">
               {displayData.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No archived records found.</div>}
               {displayData.map(p => {
                 const scores = p.stepsData.map(s => Number(s.score)).filter(s => !isNaN(s) && s > 0);
                 const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : null;
                 const isRejected = p.stepsData.some(s => s.isRejected);
                 const badgeColor = p.type === 'promotion' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';

                 return (
                   <div key={p.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-wrap gap-4 items-center">
                     <div className="w-48 shrink-0 border-r border-slate-200 pr-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mb-1 inline-block ${badgeColor}`}>{p.type}</span>
                        <div className="font-bold text-slate-800 truncate" title={p.crewName}>{p.crewName}</div>
                        <div className="text-[11px] font-medium text-slate-500">Target: <strong className="text-slate-700">{p.targetRank}</strong></div>
                     </div>
                     
                     <div className="flex-1 flex flex-wrap gap-2 items-center">
                        {p.stepsData.map((step, idx) => (
                           <div key={idx} className="bg-white border border-slate-200 p-1.5 rounded-md text-[10px] w-32 flex flex-col items-center justify-center text-center relative group">
                              <span className="font-bold text-slate-700 truncate w-full">{step.roleName}</span>
                              <span className="text-slate-400">{step.date || '---'}</span>
                              {step.isRejected ? <span className="font-bold text-red-600 mt-0.5 border-t border-slate-100 w-full pt-0.5"><X size={12} className="inline"/> REJECT</span> : 
                               (step.score ? <span className={`font-bold mt-0.5 border-t border-slate-100 w-full pt-0.5 ${getScoreColor(step.score)} rounded-b-sm`}>{step.score}</span> : <span className="text-slate-300 mt-0.5 border-t border-slate-100 w-full pt-0.5">-</span>)
                              }
                              {step.note && <div className="absolute hidden group-hover:block bottom-full mb-1 bg-slate-800 text-white p-2 rounded text-xs w-48 shadow-lg z-50 text-left whitespace-pre-wrap">{step.note}</div>}
                           </div>
                        ))}
                     </div>

                     <div className="w-24 shrink-0 flex flex-col items-center border-l border-slate-200 pl-2">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Final</div>
                        {isRejected ? <span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-xs">REJECTED</span> :
                         <span className={`font-bold px-3 py-1 rounded text-sm shadow-sm border border-slate-200 ${getScoreColor(avg)}`}>{avg || '-'}</span>
                        }
                     </div>

                     <div className="flex flex-col gap-1 items-end shrink-0 pl-2">
                        {currentUser.role === 'admin' && <button onClick={() => async () => await updateDoc(doc(db, getPath('promotions'), p.id), { status: 'active' })} className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-[10px] font-bold"><RotateCcw size={12}/> RESTORE</button>}
                        {currentUser.role === 'admin' && <button onClick={() => setDeleteConfirmId(p.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>}
                     </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>
      </div>

      {/* Modals for Promotions */}
      {addModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Start Process</h2>
               <button onClick={()=>setAddModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded shadow-sm border border-slate-200"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Process Type</label>
                 <select value={newPromo.type} onChange={e=>setNewPromo({...newPromo, type: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                   <option value="promotion">Internal Promotion</option><option value="recruitment">External Recruitment</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Candidate Name</label>
                 <input type="text" value={newPromo.crewName} onChange={e=>setNewPromo({...newPromo, crewName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-slate-50"/>
               </div>
               {newPromo.type === 'promotion' && (
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Current Rank</label>
                   <select value={newPromo.currentRank} onChange={e=>setNewPromo({...newPromo, currentRank: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                     <option value="">Select Current Rank</option>
                     {matrix?.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
                   </select>
                 </div>
               )}
               <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">Target Rank (Applying For)</label>
                 <select value={newPromo.targetRank} onChange={e=>setNewPromo({...newPromo, targetRank: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white border-blue-400">
                   <option value="">Select Target Rank</option>
                   {matrix?.map(m => <option key={m.id} value={m.rank}>{m.rank}</option>)}
                 </select>
               </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button onClick={()=>setAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-white rounded text-sm font-medium">Cancel</button>
                <button disabled={!newPromo.crewName || !newPromo.targetRank || (newPromo.type==='promotion' && !newPromo.currentRank)} onClick={handleCreate} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${editModal.type === 'promotion' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{editModal.type}</span>
                     <h2 className="text-lg font-bold text-slate-800">{editModal.crewName}</h2>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Applying for: <strong className="text-blue-600">{editModal.targetRank}</strong></p>
               </div>
               <div className="flex gap-2">
                 <button onClick={async () => { await updateDoc(doc(db, getPath('promotions'), editModal.id), { status: 'archived' }); setEditModal(null); }} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Complete & Archive</button>
                 <button onClick={()=>setEditModal(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded shadow-sm border border-slate-200"><X size={18}/></button>
               </div>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto bg-slate-100/50 flex-1">
               {editModal.stepsData.map((step, idx) => {
                 // Auth Logic: Admin/CTO edit all. Others edit only their specific role.
                 const isGlobalEditor = currentUser.role === 'admin' || currentUser.jobTitle === 'CTO';
                 const isMyRole = currentUser.role !== 'viewer' && currentUser.jobTitle === step.roleName;
                 const canEdit = isGlobalEditor || isMyRole;
                 const isRejectedGlobal = editModal.stepsData.some(s => s.isRejected);

                 return (
                   <div key={idx} className={`bg-white p-4 rounded-lg border ${step.isRejected ? 'border-red-300 shadow-sm' : 'border-slate-200 shadow-sm'} flex flex-wrap gap-4 items-start relative overflow-hidden`}>
                     {step.isRejected && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>}
                     <div className="w-32 shrink-0 border-r border-slate-100 pr-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Step {idx + 1}</div>
                        <div className={`font-bold text-sm ${canEdit ? 'text-blue-600' : 'text-slate-700'}`}>{step.roleName}</div>
                        {!canEdit && <div className="text-[9px] text-slate-400 italic mt-1 flex items-center gap-0.5"><Info size={10}/> Read Only</div>}
                     </div>
                     
                     <div className="w-36 shrink-0">
                       <label className="block text-[10px] font-bold text-slate-500 mb-1">Action Date</label>
                       <input type="date" value={step.date} disabled={!canEdit || (isRejectedGlobal && !step.isRejected)} onChange={e => { const ns=[...editModal.stepsData]; ns[idx].date = e.target.value; setEditModal({...editModal, stepsData: ns}); }} className="w-full border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"/>
                     </div>

                     <div className="flex-1 min-w-[200px]">
                       <label className="block text-[10px] font-bold text-slate-500 mb-1">Review Notes</label>
                       <textarea placeholder={canEdit ? "Enter detailed feedback..." : "No notes provided."} value={step.note} disabled={!canEdit || (isRejectedGlobal && !step.isRejected)} onChange={e => { const ns=[...editModal.stepsData]; ns[idx].note = e.target.value; setEditModal({...editModal, stepsData: ns}); }} className="w-full border border-slate-300 rounded p-2 text-xs resize-none h-16 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"/>
                     </div>

                     <div className="w-24 shrink-0 flex flex-col gap-2 border-l border-slate-100 pl-4">
                       <div>
                         <label className="block text-[10px] font-bold text-slate-500 mb-1 text-center">Score (0-100)</label>
                         <input type="number" max="100" min="0" value={step.score} disabled={!canEdit || step.isRejected || isRejectedGlobal} onChange={e => { const ns=[...editModal.stepsData]; ns[idx].score = e.target.value; setEditModal({...editModal, stepsData: ns}); }} className={`w-full border rounded p-1.5 text-sm font-bold text-center outline-none focus:border-blue-500 disabled:bg-slate-100 ${step.isRejected ? 'border-red-200 text-slate-300' : 'border-slate-300 text-blue-600'}`}/>
                       </div>
                       <label className={`flex items-center justify-center gap-1.5 text-[10px] font-bold cursor-pointer bg-slate-50 py-1 rounded border ${step.isRejected ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-slate-500'} ${(!canEdit || (isRejectedGlobal && !step.isRejected)) ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-100'}`}>
                         <input type="checkbox" checked={step.isRejected} disabled={!canEdit || (isRejectedGlobal && !step.isRejected)} onChange={e => { const ns=[...editModal.stepsData]; ns[idx].isRejected = e.target.checked; if(e.target.checked) ns[idx].score = ''; setEditModal({...editModal, stepsData: ns}); }} className="w-3 h-3 accent-red-500 rounded-sm"/> Reject
                       </label>
                     </div>
                   </div>
                 );
               })}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                <button onClick={()=>setEditModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium">Cancel</button>
                <button onClick={async () => {
                   await updateDoc(doc(db, getPath('promotions'), editModal.id), { stepsData: editModal.stepsData });
                   setEditModal(null);
                }} className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm transition-colors">Save All Changes</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && <DeleteConfirmModal message="Permanently delete this process record?" showConfirm={true} onClose={() => setDeleteConfirmId(null)} onConfirm={async () => { await deleteDoc(doc(db, getPath('promotions'), deleteConfirmId)); setDeleteConfirmId(null); }} />}
    </div>
  );
}

function Procedures({ procedures, schema, currentUser, db, getPath, generateId, onAddEval, onAddDebrief }) {
  const [tab, setTab] = useState('active'); 
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [typeFilter, setTypeFilter] = useState('');
  const [crewSearch, setCrewSearch] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');

  const displayData = procedures.filter(p => {
    if (p.status !== tab) return false;
    if (typeFilter && p.type !== typeFilter) return false;
    if (crewSearch && !(p.crewName || '').toLowerCase().includes(crewSearch.toLowerCase())) return false;
    if (vesselSearch && !(p.shipName || '').toLowerCase().includes(vesselSearch.toLowerCase())) return false;
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
         <div><select className="border border-slate-300 rounded text-sm p-1.5 focus:outline-none bg-white" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">All Types</option><option value="onsigner">Onsigner</option><option value="offsigner">Offsigner</option></select></div>
         <div><input type="text" placeholder="Crew Name..." className="border border-slate-300 rounded text-sm p-1.5 w-36 focus:outline-none bg-slate-50" value={crewSearch} onChange={e=>setCrewSearch(e.target.value)} /></div>
         <div><input type="text" placeholder="Vessel..." className="border border-slate-300 rounded text-sm p-1.5 w-32 focus:outline-none bg-slate-50" value={vesselSearch} onChange={e=>setVesselSearch(e.target.value)} /></div>
         {(typeFilter||crewSearch||vesselSearch) && <button onClick={()=>{setTypeFilter('');setCrewSearch('');setVesselSearch('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 sticky top-0 bg-white z-10">
              <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Crew</th><th className="px-4 py-3">Vessel</th><th className="px-4 py-3">Date</th>{schema.map(col => <th key={col.id} className="px-4 py-3 text-center">{col.name}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {displayData.map(p => (
                <tr key={p.id} className={`border-b border-slate-100 hover:brightness-95 transition-all ${p.type==='onsigner'?'bg-emerald-50/50':'bg-slate-200/40'}`}>
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-xs font-bold ${p.type==='onsigner'?'bg-emerald-100 text-emerald-800':'bg-slate-300 text-slate-700'}`}>{p.type}</span></td>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.crewName} <br/><span className="text-[11px] text-slate-500 font-normal">{p.rank}</span></td>
                  <td className="px-4 py-2 text-slate-700 font-medium">{p.shipName}</td>
                  <td className="px-4 py-2 text-slate-600">{p.date}</td>
                  
                  {schema.map(col => {
                    const applies = col.appliesTo === 'both' || col.appliesTo === p.type;
                    if (!applies) return <td key={col.id} className="px-4 py-2 text-center text-slate-300">-</td>;
                    const val = p.dynamicData[col.id];
                    if (tab === 'archive') return <td key={col.id} className="px-4 py-2 text-center">{col.type === 'checkbox' ? (val ? 'Yes' : 'No') : (val || '-')}</td>;
                    return (
                      <td key={col.id} className="px-4 py-2 text-center">
                        {col.type === 'checkbox' ? 
                          <input type="checkbox" checked={val || false} onChange={e => updateDoc(doc(db, getPath('procedures'), p.id), { dynamicData: {...p.dynamicData, [col.id]: e.target.checked} })} className="rounded border-slate-400 w-4 h-4" />
                          : <input type="date" value={val || ''} onChange={e => updateDoc(doc(db, getPath('procedures'), p.id), { dynamicData: {...p.dynamicData, [col.id]: e.target.value} })} className="text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none bg-white" />
                        }
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right">
                    {tab === 'active' ? (
                      <div className="flex justify-end items-center gap-3">
                        {p.type === 'offsigner' && (
                          <>
                            <button onClick={() => !p.evaluationDone && onAddEval(p)} disabled={p.evaluationDone} title="Evaluation" className={`transition-colors ${p.evaluationDone ? 'text-slate-300 cursor-not-allowed' : 'text-amber-500 hover:text-amber-600'}`}><Star size={18} fill={p.evaluationDone ? "currentColor" : "none"}/></button>
                            {['Master', 'Chief Officer', 'Chief Engineer', 'Second Engineer', 'C/E', 'C/O', '2/E'].some(r => (p.rank||'').toLowerCase().includes(r.toLowerCase())) && (
                              <button onClick={() => !p.debriefDone && onAddDebrief(p)} disabled={p.debriefDone} title="Debriefing" className={`transition-colors ${p.debriefDone ? 'text-slate-300 cursor-not-allowed' : 'text-blue-500 hover:text-blue-600'}`}><UserCheck size={18}/></button>
                            )}
                          </>
                        )}
                        <button onClick={async () => await updateDoc(doc(db, getPath('procedures'), p.id), { status: 'archive' })} title="Archive" className="text-slate-400 hover:text-slate-700 ml-2 transition-colors"><Archive size={18}/></button>
                        {currentUser.role === 'admin' && <button onClick={() => setDeleteConfirmId(p.id)} title="Delete Procedure" className="text-slate-300 hover:text-red-500 ml-1 transition-colors"><Trash2 size={18}/></button>}
                      </div>
                    ) : (
                      <div className="flex justify-end items-center">
                         {currentUser.role === 'admin' && <button onClick={async () => await updateDoc(doc(db, getPath('procedures'), p.id), { status: 'active' })} className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-xs font-medium"><RotateCcw size={14}/> Restore</button>}
                         {currentUser.role !== 'admin' && <span className="text-xs text-slate-400 italic bg-slate-100 px-2 py-1 rounded">Archived</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {deleteConfirmId && <DeleteConfirmModal message="Permanently delete procedure?" showConfirm={true} onClose={() => setDeleteConfirmId(null)} onConfirm={async () => { await deleteDoc(doc(db, getPath('procedures'), deleteConfirmId)); setDeleteConfirmId(null); }} />}
    </div>
  );
}

function EvaluationsOverview({ evals, matrix, ships, currentUser, db, getPath, setEvalPrefill, setActiveTab }) {
  const [fRank, setFRank] = useState('');
  const [fName, setFName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const displayEvals = evals.filter(e => {
    if(fRank && e.rank !== fRank) return false;
    if(fName && !(e.crewName || '').toLowerCase().includes(fName.toLowerCase())) return false;
    return true;
  });

  const exportToCSV = () => {
    const csvRows = ['Date,Crew Name,Rank,Vessel,Score,Evaluator'];
    displayEvals.forEach(e => csvRows.push(`"${e.date}","${e.crewName}","${e.rank}","${e.shipName}","${e.score}","${e.evaluatedBy}"`));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `evaluations_export.csv`; link.click();
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Evaluations Overview</h1>
        <div className="flex gap-2">
           {currentUser.role !== 'viewer' && <button onClick={()=>{setEvalPrefill(null); setActiveTab('eval_add');}} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-2"><Plus size={16}/> Add Manual</button>}
           <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow-sm transition-colors">Export Excel</button>
        </div>
      </div>
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end shrink-0">
         <div className="flex items-center gap-2 text-sm text-slate-500 mr-2"><Filter size={16}/> Filters:</div>
         <div><select className="border border-slate-300 rounded text-sm p-1.5 outline-none bg-white" value={fRank} onChange={e=>setFRank(e.target.value)}><option value="">All Ranks</option>{matrix.map(m=><option key={m.id} value={m.rank}>{m.rank}</option>)}</select></div>
         <div><input type="text" placeholder="Search Name..." className="border border-slate-300 rounded text-sm p-1.5 w-40 outline-none bg-slate-50" value={fName} onChange={e=>setFName(e.target.value)} /></div>
         {(fRank||fName) && <button onClick={()=>{setFRank('');setFName('');}} className="text-xs text-blue-500 hover:underline mb-2 ml-2">Clear</button>}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 sticky top-0 bg-white">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Vessel</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Evaluator</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {displayEvals.map(e => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{e.date}</td><td className="px-4 py-3 font-bold text-slate-800">{e.crewName}</td>
                  <td className="px-4 py-3 text-slate-600">{e.rank}</td><td className="px-4 py-3 text-slate-600">{e.shipName}</td>
                  <td className={`px-4 py-3 font-bold ${Number(e.score)<70?'text-red-600':'text-slate-800'}`}>{e.score}/100</td>
                  <td className="px-4 py-3 text-slate-600">{e.evaluatedBy}</td>
                  <td className="px-4 py-3 text-right">{currentUser.role === 'admin' && <button onClick={()=>setDeleteConfirmId(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {deleteConfirmId && <DeleteConfirmModal message="Permanently delete evaluation?" showConfirm={true} onClose={() => setDeleteConfirmId(null)} onConfirm={async () => { await deleteDoc(doc(db, getPath('evaluations'), deleteConfirmId)); setDeleteConfirmId(null); }} />}
    </div>
  );
}

function EvaluationsAdd({ currentUser, crew, ships, prefillData, today, db, getPath, generateId, onClearPrefill, setActiveTab }) {
  const [addRows, setAddRows] = useState([]);
  
  useEffect(() => {
    if (!prefillData) { setAddRows([{ id: 1, crewName: '', rank: '', shipName: '', score: '', evaluatedBy: currentUser.username, date: today.toISOString().split('T')[0] }]); return; }
    const isManager = ['Master', 'Chief Engineer'].includes(prefillData.rank);
    if (!isManager) {
      setAddRows([{ id: 1, crewName: prefillData.crewName, rank: prefillData.rank, shipName: prefillData.shipName, score: '', evaluatedBy: typeof prefillData.evalSnapshot === 'string' ? prefillData.evalSnapshot : 'Office', date: prefillData.date }]);
    } else {
      const cList = Array.isArray(prefillData.evalSnapshot) ? prefillData.evalSnapshot : [];
      if(cList.length === 0) setAddRows([{ id: 1, crewName: '', rank: '', shipName: prefillData.shipName, score: '', evaluatedBy: prefillData.crewName, date: prefillData.date }]);
      else setAddRows(cList.map((c, i) => ({ id: i+1, crewName: c.name, rank: c.rank, shipName: prefillData.shipName, score: '', evaluatedBy: prefillData.crewName, date: prefillData.date })));
    }
  }, [prefillData]);

  const updateRow = (id, field, val) => setAddRows(addRows.map(r => r.id === id ? {...r, [field]: val} : r));
  const submitAll = async () => {
    const validRows = addRows.filter(r => r.crewName && r.score).map(r => ({...r, id: 'e'+generateId()}));
    for(let e of validRows) await setDoc(doc(db, getPath('evaluations'), e.id), e);
    if(validRows.length > 0) { onClearPrefill(); setActiveTab('eval_overview'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end"><h1 className="text-2xl font-bold text-slate-800">Add Evaluations</h1>{prefillData && <button onClick={onClearPrefill} className="text-sm text-blue-600 hover:underline">Clear Auto-fill</button>}</div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="overflow-x-auto">
          <div className="min-w-[900px] space-y-3">
            {addRows.map((row, i) => (
              <div key={row.id} className="flex gap-3 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="font-bold text-slate-400 w-6 text-center">{i+1}.</span>
                <input type="date" className="border border-slate-300 rounded p-2 text-sm w-36 outline-none bg-slate-50" value={row.date} onChange={e=>updateRow(row.id, 'date', e.target.value)}/>
                <input type="text" placeholder="Name" className="border border-slate-300 rounded p-2 text-sm flex-1 outline-none bg-slate-50" value={row.crewName} onChange={e=>updateRow(row.id, 'crewName', e.target.value)} list="crewList"/>
                <input type="text" placeholder="Rank" className="border border-slate-300 rounded p-2 text-sm w-32 outline-none bg-slate-50" value={row.rank} onChange={e=>updateRow(row.id, 'rank', e.target.value)}/>
                <select className="border border-slate-300 rounded p-2 text-sm w-40 bg-white outline-none" value={row.shipName} onChange={e=>updateRow(row.id, 'shipName', e.target.value)}><option value="">Ship</option>{ships.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                <input type="number" placeholder="Score" className="border border-slate-300 rounded p-2 text-sm w-24 outline-none font-bold text-blue-600 text-center" value={row.score} onChange={e=>updateRow(row.id, 'score', e.target.value)} max="100" min="0"/>
                <input type="text" placeholder="Evaluator" className="border border-slate-300 rounded p-2 text-sm w-40 outline-none bg-slate-50" value={row.evaluatedBy} onChange={e=>updateRow(row.id, 'evaluatedBy', e.target.value)}/>
                <button onClick={() => setAddRows(addRows.filter(r=>r.id !== row.id))} className="text-slate-400 hover:text-red-500 p-1"><X size={20}/></button>
              </div>
            ))}
          </div>
        </div>
        <datalist id="crewList">{crew.map(c => <option key={c.id} value={c.name}/>)}</datalist>
        <div className="flex justify-between items-center mt-4 border-t border-slate-100 pt-4">
          <button onClick={()=>setAddRows([...addRows, { id: Date.now(), crewName: '', rank: '', shipName: '', score: '', evaluatedBy: currentUser.username, date: today.toISOString().split('T')[0] }])} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100"><Plus size={16}/> Add Row</button>
          <button onClick={submitAll} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-sm">Submit Valid Rows</button>
        </div>
      </div>
    </div>
  );
}

function Debriefings({ debriefings, currentUser, db, getPath, generateId, ships, matrix }) {
  const [tab, setTab] = useState('active');
  const [editModal, setEditModal] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [newDebrief, setNewDebrief] = useState({ crewName: '', rank: '', shipName: '', signOffDate: new Date().toISOString().split('T')[0] });

  const displayData = debriefings.filter(d => d.status === tab);

  const exportToCSV = () => {
    const csvRows = ['Sign-off Date,Name,Rank,Vessel,Deck Score,Deck Note,Engine Score,Engine Note,Safety Score,Safety Note,HR Score,HR Note'];
    displayData.forEach(d => {
       const clean = (str) => `"${(str||'').replace(/"/g, '""')}"`;
       csvRows.push(`${d.signOffDate},${clean(d.crewName)},${clean(d.rank)},${clean(d.shipName)},${d.depts[0]?.score||''},${clean(d.depts[0]?.note)},${d.depts[1]?.score||''},${clean(d.depts[1]?.note)},${d.depts[2]?.score||''},${clean(d.depts[2]?.note)},${d.depts[3]?.score||''},${clean(d.depts[3]?.note)}`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `debriefings_archive.csv`; link.click();
  };

  const DeptCell = ({ dept }) => {
    if(!dept.score) return <span className="text-slate-300">-</span>;
    return (
      <div className="flex items-center gap-1 group relative">
        <span className={Number(dept.score) < 70 ? 'text-red-600 font-bold' : 'font-bold text-slate-700'}>{dept.score}</span>
        {dept.note && <button className="text-blue-500 opacity-70 hover:opacity-100" title={dept.note}><Info size={14}/></button>}
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Senior Officer Debriefings</h1>
        <div className="flex items-center gap-3">
          {currentUser.role !== 'viewer' && <button onClick={() => setAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm flex items-center gap-2"><Plus size={14}/> Add Manual</button>}
          {tab === 'archived' && <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold text-sm shadow-sm">Export Excel</button>}
          <div className="bg-slate-200 p-1 rounded-md flex text-sm font-medium shrink-0 shadow-sm">
            <button onClick={() => setTab('active')} className={`px-4 py-1 rounded transition-colors ${tab==='active'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Active</button>
            <button onClick={() => setTab('archived')} className={`px-4 py-1 rounded transition-colors ${tab==='archived'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>Archived</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 sticky top-0 bg-white z-10">
              <tr><th className="px-4 py-3">Sign-off Date</th><th className="px-4 py-3">Crew</th><th className="px-4 py-3">Vessel</th><th className="px-4 py-3">Deck</th><th className="px-4 py-3">Engine</th><th className="px-4 py-3">Safety</th><th className="px-4 py-3">HR</th><th className="px-4 py-3 text-center border-l border-slate-200">Avg</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {displayData.map(d => {
                const scores = d.depts.map(x=>Number(x.score)).filter(x => !isNaN(x) && x > 0);
                const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : null;
                return (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{d.signOffDate}</td>
                    <td className="px-4 py-3"><div className="font-bold text-slate-800">{d.crewName}</div><div className="text-[11px] text-slate-500">{d.rank}</div></td>
                    <td className="px-4 py-3 text-slate-600">{d.shipName}</td>
                    <td className="px-4 py-3"><DeptCell dept={d.depts[0]} /></td><td className="px-4 py-3"><DeptCell dept={d.depts[1]} /></td><td className="px-4 py-3"><DeptCell dept={d.depts[2]} /></td><td className="px-4 py-3"><DeptCell dept={d.depts[3]} /></td>
                    <td className="px-4 py-3 text-center border-l border-slate-100"><span className={`bg-slate-100 px-2 py-1 rounded font-bold ${avg && avg < 70 ? 'text-red-600' : 'text-slate-700'}`}>{avg || '-'}</span></td>
                    <td className="px-4 py-3 text-right">
                      {tab === 'active' ? (
                        <div className="flex justify-end gap-2">
                           <button onClick={() => setEditModal(d)} className="text-blue-600 border border-blue-200 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold">Review / Fill</button>
                           {currentUser.role === 'admin' && <button onClick={() => setDeleteConfirmId(d.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                        </div>
                      ) : (
                        currentUser.role === 'admin' ? <button onClick={async () => await updateDoc(doc(db, getPath('debriefings'), d.id), { status: 'active' })} className="text-slate-400 hover:text-blue-500 flex items-center gap-1 text-[10px] font-bold ml-auto"><RotateCcw size={12}/> RESTORE</button> : <span className="text-xs text-slate-400 italic">Archived</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayData.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between shrink-0"><h2 className="font-bold text-slate-800">Add Debriefing</h2><button onClick={()=>setAddModal(false)}><X size={18}/></button></div>
            <div className="p-4 space-y-3">
               <input type="text" placeholder="Name" value={newDebrief.crewName} onChange={e=>setNewDebrief({...newDebrief, crewName: e.target.value})} className="w-full border p-2 text-sm rounded outline-none"/>
               <select value={newDebrief.rank} onChange={e=>setNewDebrief({...newDebrief, rank: e.target.value})} className="w-full border p-2 text-sm rounded outline-none"><option value="">Rank</option>{matrix.map(m=><option key={m.id} value={m.rank}>{m.rank}</option>)}</select>
               <select value={newDebrief.shipName} onChange={e=>setNewDebrief({...newDebrief, shipName: e.target.value})} className="w-full border p-2 text-sm rounded outline-none"><option value="">Vessel</option>{ships.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>
               <input type="date" value={newDebrief.signOffDate} onChange={e=>setNewDebrief({...newDebrief, signOffDate: e.target.value})} className="w-full border p-2 text-sm rounded outline-none"/>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
               <button onClick={()=>setAddModal(false)} className="text-sm font-medium px-4">Cancel</button>
               <button disabled={!newDebrief.crewName} onClick={async () => {
                  await setDoc(doc(db, getPath('debriefings'), generateId()), { ...newDebrief, startDate:'', endDate:'', status:'active', depts: [{name:'Deck', note:'', score:''},{name:'Engine', note:'', score:''},{name:'Safety', note:'', score:''},{name:'HR', note:'', score:''}] });
                  setAddModal(false);
               }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
               <div><h2 className="text-lg font-bold text-slate-800">Edit Debriefing</h2><p className="text-xs text-slate-500">{editModal.crewName} ({editModal.rank}) - {editModal.shipName}</p></div>
               <div className="flex gap-2">
                 <button onClick={async () => { await updateDoc(doc(db, getPath('debriefings'), editModal.id), { status: 'archived' }); setEditModal(null); }} className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded text-xs font-bold">Complete & Archive</button>
                 <button onClick={()=>setEditModal(null)} className="text-slate-400 bg-white p-1 rounded shadow-sm border"><X size={18}/></button>
               </div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto bg-slate-50 flex-1">
               {editModal.depts.map((dept, idx) => (
                 <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex gap-3 items-start">
                   <div className="w-24 font-bold text-slate-700 text-sm mt-1">{dept.name}</div>
                   <textarea placeholder="Feedback..." value={dept.note} onChange={e=>{ const ns=[...editModal.depts]; ns[idx].note=e.target.value; setEditModal({...editModal, depts: ns}); }} className="flex-1 border border-slate-300 rounded p-2 text-sm resize-none outline-none focus:border-blue-500 h-16 bg-slate-50"/>
                   <div className="w-20"><input type="number" placeholder="Score" max="100" min="0" value={dept.score} onChange={e=>{ const ns=[...editModal.depts]; ns[idx].score=e.target.value; setEditModal({...editModal, depts: ns}); }} className="w-full border rounded p-2 text-sm font-bold text-blue-600 text-center outline-none bg-slate-50"/><div className="text-center text-[10px] text-slate-400 mt-1">out of 100</div></div>
                 </div>
               ))}
            </div>
            <div className="p-4 border-t bg-white flex justify-end gap-2 shrink-0">
                <button onClick={()=>setEditModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium">Cancel</button>
                <button onClick={async () => { await updateDoc(doc(db, getPath('debriefings'), editModal.id), { depts: editModal.depts }); setEditModal(null); }} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmId && <DeleteConfirmModal message="Permanently delete debriefing?" showConfirm={true} onClose={() => setDeleteConfirmId(null)} onConfirm={async () => { await deleteDoc(doc(db, getPath('debriefings'), deleteConfirmId)); setDeleteConfirmId(null); }} />}
    </div>
  );
}

function SettingsPage({ matrix, setMatrix, procSchema, setProcSchema, promoMatrix, setPromoMatrix, users, db, getPath, ships, currentUser, setCurrentUser }) {
  const [newCol, setNewCol] = useState({ name: '', type: 'checkbox', appliesTo: 'both' });
  const [newRank, setNewRank] = useState({ rank: '', dept: 'Deck', checkOverlap: false, competencies: [] });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user', jobTitle: 'Other' });
  
  // Promo Matrix Builder
  const [promoRank, setPromoRank] = useState('');
  const [promoSteps, setPromoSteps] = useState([]);
  const [stepSelect, setStepSelect] = useState('');

  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">System Administration</h1>
      
      {/* USER MANAGEMENT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Users size={20} className="text-indigo-500"/> User Management</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Add users, define their Job Titles (for Promotion Matrix routing), and set Access Levels (Admin = full access, User = specific edits, Viewer = read-only).</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg whitespace-nowrap bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr><th className="p-3">Username</th><th className="p-3">Password</th><th className="p-3">Job Title (Role)</th><th className="p-3">Access Level</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isEditing = editingUserId === u.id;
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3">{isEditing ? <input value={editUserData.username} onChange={e=>setEditUserData({...editUserData, username: e.target.value})} className="border rounded p-1 text-xs w-full"/> : <span className="font-bold">{u.username}</span>}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{isEditing ? <input value={editUserData.password} onChange={e=>setEditUserData({...editUserData, password: e.target.value})} className="border rounded p-1 text-xs w-full"/> : (u.role==='admin'?'********':u.password)}</td>
                    <td className="p-3">
                       {isEditing ? (
                         <select value={editUserData.jobTitle || 'Other'} onChange={e=>setEditUserData({...editUserData, jobTitle: e.target.value})} className="border rounded p-1 text-xs">
                           {JOB_TITLES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                         </select>
                       ) : <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded text-xs">{u.jobTitle || 'Other'}</span>}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <select value={editUserData.role} onChange={e=>setEditUserData({...editUserData, role: e.target.value})} className="border rounded p-1 text-xs" disabled={u.role==='admin'}>
                           <option value="admin">Admin</option><option value="user">User (Editor)</option><option value="viewer">Viewer</option>
                        </select>
                      ) : <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role==='admin'?'bg-red-100 text-red-700':u.role==='user'?'bg-blue-100 text-blue-700':'bg-slate-200 text-slate-700'}`}>{u.role}</span>}
                    </td>
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2"><button onClick={async () => { await updateDoc(doc(db, getPath('appUsers'), editingUserId), editUserData); if(currentUser.id===editingUserId) setCurrentUser(editUserData); setEditingUserId(null); }} className="text-white bg-green-500 px-2 py-1 rounded font-bold text-xs">Save</button><button onClick={()=>setEditingUserId(null)} className="text-slate-400 text-xs">Cancel</button></div>
                      ) : (
                        <div className="flex justify-end gap-2">
                           <button onClick={() => { setEditingUserId(u.id); setEditUserData(u); }} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 size={16}/></button>
                           {u.role !== 'admin' && <button onClick={async () => await deleteDoc(doc(db, getPath('appUsers'), u.id))} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-indigo-50/50">
                <td className="p-3"><input type="text" placeholder="Username" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})} className="w-full border rounded p-1 text-sm outline-none"/></td>
                <td className="p-3"><input type="text" placeholder="Password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})} className="w-full border rounded p-1 text-sm outline-none"/></td>
                <td className="p-3">
                  <select className="border rounded p-1 text-sm outline-none bg-white" value={newUser.jobTitle} onChange={e=>setNewUser({...newUser, jobTitle: e.target.value})}>
                     {JOB_TITLES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <select className="border rounded p-1 text-sm outline-none bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}><option value="user">User</option><option value="viewer">Viewer</option></select>
                </td>
                <td className="p-3 text-right"><button onClick={async () => { await setDoc(doc(db, getPath('appUsers'), generateId()), newUser); setNewUser({ username: '', password: '', role: 'user', jobTitle: 'Other' }); }} disabled={!newUser.username || !newUser.password} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">Add</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PROMOTION MATRIX BUILDER */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Briefcase size={20} className="text-purple-500"/> Promotion & Recruitment Matrix</h2>
        <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded border border-slate-100">Define the approval steps required for each rank. Users will only be able to edit the step that matches their Job Title.</p>
        
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border border-slate-200 rounded-lg bg-white">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr><th className="p-3 w-48">Target Rank</th><th className="p-3">Approval Process Steps (In Order)</th><th className="p-3 text-right w-16">Actions</th></tr>
            </thead>
            <tbody>
              {promoMatrix.map((pm, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-3 font-bold text-slate-800">{pm.targetRank}</td>
                  <td className="p-3 flex flex-wrap gap-2 items-center">
                    {pm.steps.map((step, idx) => (
                       <React.Fragment key={idx}>
                         <div className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold shadow-sm">{step}</div>
                         {idx < pm.steps.length - 1 && <ChevronRight size={12} className="text-slate-300"/>}
                       </React.Fragment>
                    ))}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={async () => { const nm = promoMatrix.filter(x=>x.targetRank!==pm.targetRank); setPromoMatrix(nm); }} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-purple-50/30">
                <td className="p-3 align-top">
                  <select value={promoRank} onChange={e=>setPromoRank(e.target.value)} className="w-full border rounded p-1.5 text-sm outline-none bg-white">
                     <option value="">Select Rank</option>{matrix.map(m=><option key={m.id} value={m.rank}>{m.rank}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2 items-center mb-2 min-h-[30px]">
                    {promoSteps.map((step, idx) => (
                       <React.Fragment key={idx}>
                         <div className="bg-white border border-slate-300 px-2 py-1 rounded text-[10px] font-bold shadow-sm flex items-center gap-1">{step} <button onClick={()=>setPromoSteps(promoSteps.filter((_,i)=>i!==idx))} className="text-red-500 hover:text-red-700"><X size={10}/></button></div>
                         {idx < promoSteps.length - 1 && <ChevronRight size={12} className="text-slate-300"/>}
                       </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-2">
                     <select value={stepSelect} onChange={e=>setStepSelect(e.target.value)} className="border rounded p-1 text-xs outline-none bg-white"><option value="">Add Job Title Step...</option>{JOB_TITLES.map(jt=><option key={jt} value={jt}>{jt}</option>)}</select>
                     <button disabled={!stepSelect} onClick={()=>{ setPromoSteps([...promoSteps, stepSelect]); setStepSelect(''); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-xs font-bold disabled:opacity-50">Add Step</button>
                  </div>
                </td>
                <td className="p-3 text-right align-top">
                   <button onClick={async () => { const nm = [...promoMatrix.filter(x=>x.targetRank!==promoRank), {targetRank: promoRank, steps: promoSteps}]; setPromoMatrix(nm); setPromoRank(''); setPromoSteps([]); }} disabled={!promoRank || promoSteps.length===0} className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm disabled:opacity-50">Save Matrix</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* OTHER SETTINGS (Complience & Procedures) - Compacted for space */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4"><LayoutDashboard size={20} className="inline text-blue-500 mr-2"/> Rank & Competency Matrix</h2>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-left border rounded">
              <thead className="bg-slate-50 border-b"><tr><th className="p-2">Rank</th><th className="p-2">Dept</th><th className="p-2">Comps</th><th className="p-2"></th></tr></thead>
              <tbody>
                {matrix.map((m, i) => (
                  <tr key={i} className="border-b"><td className="p-2 font-bold">{m.rank}</td><td className="p-2">{m.dept}</td><td className="p-2">{m.competencies.join(', ')}</td><td className="p-2 text-right"><button onClick={()=>{const nm=[...matrix];nm.splice(i,1);setMatrix(nm);}} className="text-red-500"><Trash2 size={14}/></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2"><input type="text" placeholder="New Rank" value={newRank.rank} onChange={e=>setNewRank({...newRank, rank:e.target.value})} className="border p-1.5 rounded w-1/2 text-sm"/><button onClick={()=>{if(newRank.rank){ setMatrix([...matrix, {...newRank, id:generateId()}]); setNewRank({rank:'', dept:'Deck', checkOverlap:false, competencies:[]})}}} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">Add</button></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4"><FileCheck size={20} className="inline text-green-500 mr-2"/> Procedure Schema</h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto">{procSchema.map(s => (<li key={s.id} className="flex justify-between bg-slate-50 p-2 border rounded text-sm"><span className="font-bold">{s.name} ({s.type})</span><button onClick={()=>setProcSchema(procSchema.filter(x=>x.id!==s.id))} className="text-red-500"><Trash2 size={14}/></button></li>))}</ul>
          <div className="mt-4 flex gap-2"><input type="text" placeholder="Col Name" value={newCol.name} onChange={e=>setNewCol({...newCol, name:e.target.value})} className="border p-1.5 rounded w-1/2 text-sm"/><button onClick={()=>{if(newCol.name){ setProcSchema([...procSchema, {...newCol, id:generateId()}]); setNewCol({name:'', type:'checkbox', appliesTo:'both'})}}} className="bg-green-600 text-white px-3 rounded text-sm font-bold">Add</button></div>
        </div>
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
    if (user) onLogin(user); else setError('Invalid username or password.');
  };

  return (
    <div className="flex h-screen bg-[#0f172a] items-center justify-center font-sans text-slate-800 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#0f172a] p-3.5 rounded-2xl mb-4 shadow-lg shadow-slate-900/30"><ArmonaLogo className="w-10 h-10" /></div>
          <h1 className="text-2xl font-black text-slate-800 tracking-wide text-center">ARMONA CREW MANAGER</h1>
        </div>
        {isDbEmpty ? (
           <div className="space-y-4 text-center">
              <div className="bg-amber-50 text-amber-700 p-4 rounded-lg border border-amber-200 text-sm"><strong>Database is empty!</strong><br/>Click to initialize Admin.</div>
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-medium border border-red-200 text-left">{error}</div>}
              <button onClick={async()=>{setSeeding(true); try{await onSeed();}catch(err){setError(err.message);} setSeeding(false);}} disabled={seeding} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-sm disabled:opacity-50">{seeding ? 'Initializing...' : 'Initialize Data'}</button>
           </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
            <div><label className="block text-xs font-bold text-slate-600 mb-1">USERNAME</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white" required /></div>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">PASSWORD</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white" required /></div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg mt-2 shadow-sm">Sign In</button>
          </form>
        )}
      </div>
    </div>
  );
}