import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  AlertTriangle, CheckCircle, Users, Ship, ShieldAlert, 
  Settings, LayoutDashboard, Filter, ChevronRight, Anchor, Plus, X, UserPlus, LogOut, Search, Trash2,
  FileWarning, LifeBuoy, Lock, UserCog, LogIn, Edit, TableProperties, Check,
  ArrowUp, ArrowDown, MessageSquareText, MessageCircle
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

declare global {
  var __firebase_config: string | undefined;
  var __initial_auth_token: string | undefined;
  var __app_id: string | undefined;
}




const firebaseConfig = {
  apiKey: "AIzaSyBodyi-nGpL7TExhyxJQkL5boZxVzB-NKs",
  authDomain: "crew-change-follow-up.firebaseapp.com",
  projectId: "crew-change-follow-up",
  storageBucket: "crew-change-follow-up.firebasestorage.app",
  messagingSenderId: "224379023927",
  appId: "1:224379023927:web:4e6b7cd7dc87519b0685b2"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- DİNAMİK VERİTABANI YOLLARI ---
const getCollectionRef = (colName: string) => {
  return typeof __app_id !== 'undefined' 
    ? collection(db, 'artifacts', appId, 'public', 'data', colName)
    : collection(db, colName);
};

const getDocRef = (colName: string, docId: string) => {
  return typeof __app_id !== 'undefined'
    ? doc(db, 'artifacts', appId, 'public', 'data', colName, docId)
    : doc(db, colName, docId);
};

// --- TYPESCRIPT INTERFACES ---
export interface Note {
  id: string;
  text: string;
  author: string;
  date: string;
}

export interface ShipData {
  id: string;
  name: string;
  flag: string;
  minSafeManning: number;
  cabinCapacity: number;
  lsaCapacity: number;
  color: string;
  notes?: Note[];
}

export interface CrewData {
  id: string;
  name: string;
  competency: string;
  status: string;
  shipId: string | null;
  rank: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  readinessDate: string | null;
  isProbation?: boolean;
  notes?: Note[];
}

export interface AppUserData {
  id: string;
  username: string;
  password?: string;
  role: string; // 'admin', 'user', 'viewer'
}

export interface RankDef {
  competencies: string[];
  checkOverlap: boolean;
  order: number;
}

// --- DEFAULT MATRIX (Seeding for Database) ---
const DEFAULT_RANK_COMPETENCY_MATRIX: Record<string, RankDef> = {
  'Master': { competencies: ['Master Mariner'], checkOverlap: true, order: 10 },
  'C/O': { competencies: ['Master Mariner', 'Chief Mate'], checkOverlap: true, order: 20 },
  '2/O': { competencies: ['Master Mariner', 'Chief Mate', 'OOW (Deck)'], checkOverlap: true, order: 30 },
  '3/O': { competencies: ['Master Mariner', 'Chief Mate', 'OOW (Deck)'], checkOverlap: true, order: 40 },
  'C/E': { competencies: ['Chief Engineer'], checkOverlap: true, order: 50 },
  '1/E': { competencies: ['Chief Engineer', 'Second Engineer'], checkOverlap: true, order: 60 },
  '2/E': { competencies: ['Chief Engineer', 'Second Engineer', 'OOW (Engine)'], checkOverlap: true, order: 70 },
  '3/E': { competencies: ['Chief Engineer', 'Second Engineer', 'OOW (Engine)'], checkOverlap: true, order: 80 },
  'Pumpman': { competencies: ['Pumpman', 'Rating (Engine)', 'Second Engineer'], checkOverlap: false, order: 90 }, 
  'Bosun': { competencies: ['Rating (Deck)', 'AB'], checkOverlap: true, order: 100 },
  'AB': { competencies: ['Rating (Deck)', 'AB', 'OOW (Deck)', 'Chief Mate', 'Master Mariner'], checkOverlap: false, order: 110 }, 
  'O/S': { competencies: ['Rating (Deck)', 'AB', 'O/S', 'OOW (Deck)', 'Cadet (Deck)'], checkOverlap: false, order: 120 }, 
  'Oiler': { competencies: ['Rating (Engine)', 'Oiler', 'OOW (Engine)', 'Second Engineer', 'Chief Engineer'], checkOverlap: false, order: 130 }, 
  'Wiper': { competencies: ['Rating (Engine)', 'Oiler', 'Wiper', 'OOW (Engine)', 'Cadet (Engine)'], checkOverlap: false, order: 140 }, 
  'Cook': { competencies: ['Ship\'s Cook'], checkOverlap: true, order: 150 },
  'Messman': { competencies: ['Ship\'s Cook', 'Rating (Deck)', 'Rating (Engine)', 'O/S', 'Wiper'], checkOverlap: false, order: 160 }, 
  'Cadet': { competencies: ['Cadet (Deck)', 'Cadet (Engine)'], checkOverlap: false, order: 170 } 
};

const today = new Date();

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appUser, setAppUser] = useState<AppUserData | null>(null); 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isDbLoading, setIsDbLoading] = useState(true);

  const [ships, setShips] = useState<ShipData[]>([]);
  const [crews, setCrews] = useState<CrewData[]>([]);
  const [appUsers, setAppUsers] = useState<AppUserData[]>([]);
  
  const [rankMatrix, setRankMatrix] = useState<Record<string, RankDef>>({});
  
  // Sıralanmış Rank Listesi (Order bazlı)
  const RANKS = useMemo(() => {
    return Object.keys(rankMatrix).sort((a, b) => (rankMatrix[a]?.order || 999) - (rankMatrix[b]?.order || 999));
  }, [rankMatrix]);

  const COMPETENCIES = useMemo(() => {
    const comps = new Set<string>();
    Object.values(rankMatrix).forEach(def => def.competencies.forEach(c => comps.add(c)));
    return Array.from(comps).sort();
  }, [rankMatrix]);

  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);

  const [showShipModal, setShowShipModal] = useState(false);
  const [editShipData, setEditShipData] = useState<ShipData | null>(null); 
  
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [editCrewData, setEditCrewData] = useState<CrewData | null>(null); 

  const [showUserModal, setShowUserModal] = useState(false); 
  const [editUserData, setEditUserData] = useState<AppUserData | null>(null); 
  
  const [assignCrewData, setAssignCrewData] = useState<CrewData | null>(null); 
  const [signOffCrewData, setSignOffCrewData] = useState<CrewData | null>(null);
  const [overrideWarning, setOverrideWarning] = useState<{message: string, onConfirm: () => void} | null>(null); 
  const [overlapWarning, setOverlapWarning] = useState<{newCrew: CrewData, existingCrew: CrewData, onRelieve: () => void, onAdditional: () => void} | null>(null);

  // YENİ: Notlar Modalı State
  const [notesEntity, setNotesEntity] = useState<{type: 'ship'|'crew', id: string, name: string} | null>(null);

  const isViewer = appUser?.role === 'viewer';

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const paths = {
      ships: getCollectionRef('ships'),
      crew: getCollectionRef('crew'),
      appUsers: getCollectionRef('appUsers'),
      settings: getCollectionRef('settings')
    };

    const dataLoadedFlags = { ships: false, crew: false, appUsers: false, settings: false };

    const checkAllLoaded = () => {
      if (dataLoadedFlags.ships && dataLoadedFlags.crew && dataLoadedFlags.appUsers && dataLoadedFlags.settings) {
        setIsDbLoading(false);
      }
    };

    const unsubShips = onSnapshot(paths.ships, (snap) => {
      setShips(snap.docs.map(d => d.data() as ShipData));
      dataLoadedFlags.ships = true; checkAllLoaded();
    }, (err) => console.error(err));

    const unsubCrew = onSnapshot(paths.crew, (snap) => {
      setCrews(snap.docs.map(d => d.data() as CrewData));
      dataLoadedFlags.crew = true; checkAllLoaded();
    }, (err) => console.error(err));

    const unsubUsers = onSnapshot(paths.appUsers, async (snap) => {
      if (snap.empty) {
        await setDoc(getDocRef('appUsers', 'admin_user'), { id: 'admin_user', username: 'admin', password: 'Bt.admin.86!', role: 'admin' });
      } else {
        setAppUsers(snap.docs.map(d => d.data() as AppUserData));
      }
      dataLoadedFlags.appUsers = true; checkAllLoaded();
    }, (err) => console.error(err));

    const unsubSettings = onSnapshot(paths.settings, async (snap) => {
      const matrixDoc = snap.docs.find(d => d.id === 'rank_matrix');
      if (!matrixDoc) {
        await setDoc(getDocRef('settings', 'rank_matrix'), { data: DEFAULT_RANK_COMPETENCY_MATRIX });
      } else {
        const rawData = matrixDoc.data().data;
        const firstKey = Object.keys(rawData)[0];
        if (firstKey && Array.isArray(rawData[firstKey])) {
          // Eski versiyon datayı göç ettir (Migration)
          const migratedData: Record<string, RankDef> = {};
          let orderIdx = 10;
          Object.keys(rawData).forEach(k => {
            migratedData[k] = { competencies: rawData[k], checkOverlap: true, order: orderIdx };
            orderIdx += 10;
          });
          setRankMatrix(migratedData);
        } else {
          setRankMatrix(rawData as Record<string, RankDef>);
        }
      }
      dataLoadedFlags.settings = true; checkAllLoaded();
    }, (err) => console.error(err));

    return () => { unsubShips(); unsubCrew(); unsubUsers(); unsubSettings(); };
  }, [firebaseUser]);

  const calculateDaysRemaining = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diffTime = new Date(dateStr).getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getContractColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-700', light: 'bg-red-50' };
    if (daysRemaining < 15) return { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-700', light: 'bg-orange-50' };
    if (daysRemaining < 45) return { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-700', light: 'bg-yellow-50' };
    return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-700', light: 'bg-green-50' };
  };

  const systemAlerts = useMemo(() => {
    const alerts = { 
      expiredContracts: [] as {crewName: string, rank: string | null, shipName: string}[], 
      manning: [] as {shipName: string, current: number, min: number}[], 
      cabin: [] as {shipName: string, current: number, max: number}[], 
      lsa: [] as {shipName: string, current: number, max: number}[] 
    };
    
    ships.forEach(ship => {
      const onboard = crews.filter(c => c.shipId === ship.id && c.status === 'onboard');
      if (onboard.length < ship.minSafeManning) alerts.manning.push({ shipName: ship.name, current: onboard.length, min: ship.minSafeManning });
      if (onboard.length > ship.cabinCapacity) alerts.cabin.push({ shipName: ship.name, current: onboard.length, max: ship.cabinCapacity });
      if (onboard.length > ship.lsaCapacity) alerts.lsa.push({ shipName: ship.name, current: onboard.length, max: ship.lsaCapacity });
      onboard.filter(c => calculateDaysRemaining(c.contractEnd) < 0).forEach(c => alerts.expiredContracts.push({ crewName: c.name, rank: c.rank, shipName: ship.name }));
    });
    return alerts;
  }, [ships, crews]);

  const checkCompetencyMatch = (competency: string, rank: string) => (rankMatrix[rank]?.competencies || []).includes(competency);

  const handleUpdateMatrixToDb = async (newMatrix: Record<string, RankDef>) => { 
    await setDoc(getDocRef('settings', 'rank_matrix'), { data: newMatrix }); 
  };
  const handleAddShipToDb = async (newShipData: Partial<ShipData>) => { 
    const newId = `ship_${Date.now()}`; 
    await setDoc(getDocRef('ships', newId), { ...newShipData, id: newId }); 
  };
  const handleUpdateShipToDb = async (shipId: string, updatedData: Partial<ShipData>) => { 
    await setDoc(getDocRef('ships', shipId), updatedData, { merge: true }); 
  };
  const handleDeleteShipDb = async (id: string, name: string) => { 
    if(window.confirm(`Delete vessel '${name}'?`)) await deleteDoc(getDocRef('ships', id)); 
  };

  const attemptAssignment = (newCrewData: CrewData) => {
    const executeAssignment = async (isRelieve = false, existingCrewToRelieveId: string | null = null) => {
      const targetCrewId = newCrewData.id || `crew_${Date.now()}`;
      const finalCrewData = { ...newCrewData, id: targetCrewId };

      if (isRelieve && existingCrewToRelieveId) {
        const existingCrewRef = getDocRef('crew', existingCrewToRelieveId);
        const relievedData = crews.find(c => c.id === existingCrewToRelieveId);
        if (relievedData) {
          await setDoc(existingCrewRef, { ...relievedData, status: 'onleave', shipId: null, rank: null, contractStart: null, contractEnd: null, readinessDate: today.toISOString() }, { merge: true });
        }
      }

      await setDoc(getDocRef('crew', targetCrewId), finalCrewData, { merge: true });
      setShowCrewModal(false); setEditCrewData(null); setAssignCrewData(null);
    };

    const checkOverlap = () => {
      const rankDef = rankMatrix[newCrewData.rank || ''];
      
      if (rankDef && rankDef.checkOverlap) {
        const existingCrew = crews.find(c => c.shipId === newCrewData.shipId && c.status === 'onboard' && c.rank === newCrewData.rank && c.id !== newCrewData.id);
        if (existingCrew) {
          setOverlapWarning({
            newCrew: newCrewData, existingCrew: existingCrew,
            onRelieve: () => { executeAssignment(true, existingCrew.id); setOverlapWarning(null); },
            onAdditional: () => { executeAssignment(false); setOverlapWarning(null); }
          });
        } else { executeAssignment(false); }
      } else {
        executeAssignment(false); 
      }
    };

    if (newCrewData.rank && !checkCompetencyMatch(newCrewData.competency, newCrewData.rank)) {
      setOverrideWarning({ message: `Competency (${newCrewData.competency}) does not match rank (${newCrewData.rank}). Proceed?`, onConfirm: () => { setOverrideWarning(null); checkOverlap(); } });
    } else { checkOverlap(); }
  };

  const processSignOffDb = async (crewId: string, rejoinDate: string | null) => {
    const c = crews.find(cr => cr.id === crewId);
    if(c) await setDoc(getDocRef('crew', crewId), { ...c, status: 'onleave', shipId: null, rank: null, contractStart: null, contractEnd: null, readinessDate: rejoinDate ? new Date(rejoinDate).toISOString() : null }, { merge: true });
  };

  const handleDeleteCrewDb = async (id: string, name: string) => { 
    if(window.confirm(`Delete ${name} from database?`)) await deleteDoc(getDocRef('crew', id)); 
  };
  const handleAddUserToDb = async (userData: Partial<AppUserData>) => { 
    const newId = `user_${Date.now()}`; 
    await setDoc(getDocRef('appUsers', newId), { ...userData, id: newId }); 
  };
  const handleUpdateUserToDb = async (userId: string, updatedData: Partial<AppUserData>) => { 
    await setDoc(getDocRef('appUsers', userId), updatedData, { merge: true }); 
  };
  const handleDeleteUserDb = async (id: string, username: string) => { 
    if (appUsers.length <= 1) return alert("Cannot delete the last remaining user."); 
    if (window.confirm(`Delete user '${username}'?`)) await deleteDoc(getDocRef('appUsers', id)); 
  };

  if (isDbLoading) return <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white font-bold">Connecting to Secure Database...</div>;

  if (!appUser) {
    const handleLogin = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const foundUser = appUsers.find(user => user.username === fd.get('username') && user.password === fd.get('password'));
      if (foundUser) setAppUser(foundUser); else alert('Invalid username or password.');
    };
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-800">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-sm border-t-8 border-blue-600">
          <div className="flex justify-center mb-6"><Anchor size={48} className="text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6 tracking-wide">CREW MASTER PRO</h1>
          <div className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Username</label><div className="relative"><UserCog size={18} className="absolute left-3 top-3 text-gray-400"/><input name="username" required className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Password</label><div className="relative"><Lock size={18} className="absolute left-3 top-3 text-gray-400"/><input name="password" type="password" required className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center mt-2"><LogIn className="mr-2" size={18} /> Secure Login</button>
          </div>
        </form>
      </div>
    );
  }

  // --- MODALS ---
  
  const OverrideModal = () => {
    if (!overrideWarning) return null;
    return (
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border-l-8 border-orange-500">
          <div className="flex items-center text-orange-600 mb-4"><AlertTriangle size={32} className="mr-3" /><h2 className="text-xl font-bold">Competency Warning</h2></div>
          <p className="text-gray-700 mb-6">{overrideWarning.message}</p>
          <div className="flex justify-end space-x-3"><button onClick={() => setOverrideWarning(null)} className="px-4 py-2 border rounded">Cancel</button><button onClick={overrideWarning.onConfirm} className="px-4 py-2 bg-orange-500 text-white rounded font-bold">Proceed</button></div>
        </div>
      </div>
    );
  };

  const HandoverModal = () => {
    if (!overlapWarning) return null;
    const { newCrew, existingCrew, onRelieve, onAdditional } = overlapWarning;
    return (
      <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 border-l-8 border-blue-500">
          <div className="flex items-center text-blue-700 mb-4"><Users size={32} className="mr-3" /><h2 className="text-xl font-bold">Rank Overlap Detected</h2></div>
          <p className="text-gray-700 mb-4"><strong>{existingCrew.name}</strong> is currently assigned as <strong>{newCrew.rank}</strong>.</p>
          <div className="bg-blue-50 p-3 rounded mb-6 text-sm text-blue-800">
            How would you like to proceed with this assignment? <br/><br/>
            - <strong>Relieve Immediately:</strong> Signs off current crew right now.<br/>
            - <strong>Plan as Relief / Additional:</strong> Keeps current crew, adds new crew to timeline for parallel or future handover.
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button onClick={() => setOverlapWarning(null)} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={onAdditional} className="px-4 py-2 bg-gray-600 text-white rounded font-bold">Plan / Additional</button>
            <button onClick={onRelieve} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Relieve Immediately</button>
          </div>
        </div>
      </div>
    );
  };

  const SignOffModal = () => {
    if (!signOffCrewData) return null;
    const daysLeft = calculateDaysRemaining(signOffCrewData.contractEnd);
    const isEarlySignOff = daysLeft > 30;
    const handleSignOff = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      processSignOffDb(signOffCrewData.id, new FormData(e.currentTarget).get('rejoinDate') as string | null);
      setSignOffCrewData(null);
    };
    return (
      <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
        <form onSubmit={handleSignOff} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border-l-8 border-red-500">
          <div className="flex items-center text-red-600 mb-4"><LogOut size={32} className="mr-3" /><h2 className="text-xl font-bold">Sign-Off Personnel</h2></div>
          <p className="text-gray-800 font-medium mb-1">Sign-off <strong>{signOffCrewData.name}</strong>?</p>
          <p className={`text-sm mb-4 font-semibold ${daysLeft < 0 ? 'text-red-600' : 'text-blue-600'}`}>{daysLeft < 0 ? `Contract expired ${Math.abs(daysLeft)} days ago.` : `He has ${daysLeft} days left.`}</p>
          {isEarlySignOff && (
            <div className="bg-orange-50 border border-orange-200 p-3 mb-4 rounded text-sm text-orange-800 shadow-sm flex items-start"><AlertTriangle className="mr-2 shrink-0 mt-0.5 text-orange-600" size={16} /><div><strong>Early Sign-Off Notice:</strong><br/>Crew still has valid contract. Early sign-off must be properly justified.</div></div>
          )}
          <div className="bg-gray-50 p-4 rounded-lg mb-6 border"><label className="block text-sm font-bold text-gray-700 mb-2">Expected rejoin date (Optional):</label><input name="rejoinDate" type="date" className="w-full border p-2 rounded" /></div>
          <div className="flex justify-end space-x-3"><button type="button" onClick={() => setSignOffCrewData(null)} className="px-4 py-2 border rounded font-semibold">Cancel</button><button type="submit" className="px-4 py-2 bg-red-600 text-white rounded font-bold">Confirm</button></div>
        </form>
      </div>
    );
  };

  const ShipFormModal = () => {
    if (!showShipModal && !editShipData) return null;
    const isEditing = !!editShipData;
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const shipData: Partial<ShipData> = { name: fd.get('name') as string, flag: fd.get('flag') as string, minSafeManning: parseInt(fd.get('minSafeManning') as string), cabinCapacity: parseInt(fd.get('cabinCapacity') as string), lsaCapacity: parseInt(fd.get('lsaCapacity') as string), color: editShipData ? editShipData.color : 'bg-blue-100' };
      if (isEditing && editShipData) { handleUpdateShipToDb(editShipData.id, shipData); setEditShipData(null); } 
      else { handleAddShipToDb(shipData); setShowShipModal(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Ship className="mr-2" /> {isEditing ? 'Edit Vessel' : 'Add Vessel'}</h2>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Vessel Name</label><input name="name" defaultValue={editShipData?.name} required className="w-full border p-2 rounded" /></div>
            <div><label className="block text-sm font-bold text-gray-700">Flag</label><input name="flag" defaultValue={editShipData?.flag} required className="w-full border p-2 rounded" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs font-bold text-gray-700">Min. Safe</label><input name="minSafeManning" defaultValue={editShipData?.minSafeManning} type="number" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-xs font-bold text-gray-700">Cabin Cap.</label><input name="cabinCapacity" defaultValue={editShipData?.cabinCapacity} type="number" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-xs font-bold text-gray-700">LSA Cap.</label><input name="lsaCapacity" defaultValue={editShipData?.lsaCapacity} type="number" required className="w-full border p-2 rounded" /></div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => { setShowShipModal(false); setEditShipData(null); }} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button></div>
        </form>
      </div>
    );
  };

  const CrewFormModal = () => {
    if (!showCrewModal && !editCrewData) return null;
    const isEditing = !!editCrewData;
    const [statusOption, setStatusOption] = useState(editCrewData ? editCrewData.status : 'onleave');

    useEffect(() => { setStatusOption(editCrewData ? editCrewData.status : 'onleave'); }, [editCrewData, showCrewModal]);

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const crewData: CrewData = {
        id: editCrewData ? editCrewData.id : `crew_${Date.now()}`,
        name: fd.get('name') as string, 
        competency: fd.get('competency') as string, 
        status: statusOption,
        shipId: statusOption === 'onboard' ? fd.get('shipId') as string : null,
        rank: statusOption === 'onboard' ? fd.get('rank') as string : null,
        contractStart: statusOption === 'onboard' && fd.get('contractStart') ? new Date(fd.get('contractStart') as string).toISOString() : null,
        contractEnd: statusOption === 'onboard' && fd.get('contractEnd') ? new Date(fd.get('contractEnd') as string).toISOString() : null,
        readinessDate: statusOption === 'onleave' && fd.get('readinessDate') ? new Date(fd.get('readinessDate') as string).toISOString() : null,
        isProbation: fd.get('isProbation') === 'on' 
      };
      attemptAssignment(crewData);
    };

    const formatDateForInput = (isoString?: string | null) => isoString ? isoString.split('T')[0] : '';

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Users className="mr-2" /> {isEditing ? 'Edit Personnel' : 'Add Personnel'}</h2>
          <div className="flex space-x-4 mb-4 border-b pb-4">
            <label className="flex items-center cursor-pointer"><input type="radio" checked={statusOption === 'onleave'} onChange={() => setStatusOption('onleave')} className="mr-2" /> Crew Pool</label>
            <label className="flex items-center cursor-pointer"><input type="radio" checked={statusOption === 'onboard'} onChange={() => setStatusOption('onboard')} className="mr-2" /> Assign to Vessel</label>
          </div>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Full Name</label><input name="name" defaultValue={editCrewData?.name} required className="w-full border p-2 rounded" /></div>
            <div>
              <label className="block text-sm font-bold text-gray-700">Competency</label>
              <input name="competency" list="competency-options" defaultValue={editCrewData?.competency} required className="w-full border p-2 rounded" autoComplete="off" />
              <datalist id="competency-options">{COMPETENCIES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            {statusOption === 'onleave' && (<div><label className="block text-sm font-bold text-gray-700">Readiness Date</label><input name="readinessDate" defaultValue={formatDateForInput(editCrewData?.readinessDate)} type="date" className="w-full border p-2 rounded" /></div>)}
            {statusOption === 'onboard' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-bold text-gray-700">Vessel</label><select name="shipId" defaultValue={editCrewData?.shipId || undefined} required className="w-full border p-2 rounded">{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><label className="block text-sm font-bold text-gray-700">Rank</label><select name="rank" defaultValue={editCrewData?.rank || undefined} required className="w-full border p-2 rounded">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-bold text-gray-700">Contract Start</label><input name="contractStart" defaultValue={formatDateForInput(editCrewData?.contractStart)} type="date" required className="w-full border p-2 rounded" /></div>
                  <div><label className="block text-sm font-bold text-gray-700">Contract End</label><input name="contractEnd" defaultValue={formatDateForInput(editCrewData?.contractEnd)} type="date" required className="w-full border p-2 rounded" /></div>
                </div>
                <div className="flex items-center pt-2">
                  <input type="checkbox" name="isProbation" id="isProbation" defaultChecked={editCrewData?.isProbation} className="mr-2 h-4 w-4 text-blue-600 rounded" />
                  <label htmlFor="isProbation" className="text-sm font-bold text-gray-700">This is a Probation Period Contract</label>
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => { setShowCrewModal(false); setEditCrewData(null); }} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button></div>
        </form>
      </div>
    );
  };

  const AssignCrewModal = () => {
    if (!assignCrewData) return null;
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      attemptAssignment({
        ...assignCrewData, 
        status: 'onboard', 
        shipId: fd.get('shipId') as string, 
        rank: fd.get('rank') as string,
        contractStart: new Date(fd.get('contractStart') as string).toISOString(), 
        contractEnd: new Date(fd.get('contractEnd') as string).toISOString(), 
        readinessDate: null,
        isProbation: fd.get('isProbation') === 'on'
      });
    };
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center text-blue-700"><UserPlus className="mr-2" /> Assign to Vessel</h2>
          <p className="text-gray-600 mb-4 pb-4 border-b">Assigning <strong>{assignCrewData.name}</strong>.</p>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Target Vessel</label><select name="shipId" required className="w-full border p-2 rounded">{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-sm font-bold text-gray-700">Assign Rank</label><select name="rank" required className="w-full border p-2 rounded">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-bold text-gray-700">Start Date</label><input name="contractStart" type="date" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-sm font-bold text-gray-700">End Date</label><input name="contractEnd" type="date" required className="w-full border p-2 rounded" /></div>
            </div>
            <div className="flex items-center pt-2">
              <input type="checkbox" name="isProbation" id="isProbationAssign" className="mr-2 h-4 w-4 text-blue-600 rounded" />
              <label htmlFor="isProbationAssign" className="text-sm font-bold text-gray-700">Probation Period Contract</label>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setAssignCrewData(null)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Assign</button></div>
        </form>
      </div>
    );
  };

  const SystemUserFormModal = () => {
    if (!showUserModal && !editUserData) return null;
    const isEditing = !!editUserData;
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const userData: Partial<AppUserData> = { username: fd.get('username') as string, password: fd.get('password') as string, role: fd.get('role') as string };
      if (isEditing && editUserData) { handleUpdateUserToDb(editUserData.id, userData); setEditUserData(null); } 
      else { handleAddUserToDb(userData); setShowUserModal(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-700"><UserCog className="mr-2" /> {isEditing ? 'Edit User' : 'Add User'}</h2>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Username</label><input name="username" defaultValue={editUserData?.username} required className="w-full border p-2 rounded" disabled={isEditing && editUserData?.username === 'admin'} /></div>
            <div><label className="block text-sm font-bold text-gray-700">Password</label><input name="password" defaultValue={editUserData?.password} required type="text" className="w-full border p-2 rounded" /></div>
            <div>
              <label className="block text-sm font-bold text-gray-700">Role</label>
              <select name="role" defaultValue={editUserData?.role || 'user'} className="w-full border p-2 rounded" disabled={isEditing && editUserData?.username === 'admin'}>
                <option value="user">User (Crewing Dept)</option>
                <option value="viewer">Viewer (Read-Only + Notes)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => { setShowUserModal(false); setEditUserData(null); }} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Save</button></div>
        </form>
      </div>
    );
  };

  // YENİ: Notlar (Notes) Modal
  const NotesModal = () => {
    if (!notesEntity) return null;
    const isShip = notesEntity.type === 'ship';
    const entity = isShip ? ships.find(s => s.id === notesEntity.id) : crews.find(c => c.id === notesEntity.id);
    const notes = entity?.notes || [];

    const handleAddNote = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = new FormData(e.currentTarget).get('text') as string;
      if (!text.trim()) return;

      const newNote: Note = { id: Date.now().toString(), text, author: appUser?.username || 'Unknown', date: new Date().toISOString() };
      const updatedNotes = [...notes, newNote];
      await setDoc(getDocRef(isShip ? 'ships' : 'crew', notesEntity.id), { notes: updatedNotes }, { merge: true });
      e.currentTarget.reset();
    };

    const handleDeleteNote = async (noteId: string) => {
      if (!window.confirm('Delete note?')) return;
      const updatedNotes = notes.filter(n => n.id !== noteId);
      await setDoc(getDocRef(isShip ? 'ships' : 'crew', notesEntity.id), { notes: updatedNotes }, { merge: true });
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <h2 className="text-xl font-bold flex items-center text-gray-800">
              <MessageSquareText className="mr-2 text-blue-600" /> Notes: {notesEntity.name}
            </h2>
            <button onClick={() => setNotesEntity(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-100">
            {notes.map(n => (
              <div key={n.id} className="bg-white p-3 rounded shadow-sm border border-gray-200 relative group">
                <p className="text-gray-800 text-sm mb-2 pr-6 whitespace-pre-wrap">{n.text}</p>
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold uppercase">
                  <span>{n.author}</span>
                  <span>{new Date(n.date).toLocaleString('en-GB')}</span>
                </div>
                <button onClick={() => handleDeleteNote(n.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
              </div>
            ))}
            {notes.length === 0 && <div className="text-center text-gray-500 py-8 text-sm">No notes available.</div>}
          </div>
          <div className="p-4 bg-white border-t rounded-b-lg">
            <form onSubmit={handleAddNote} className="flex gap-2">
              <textarea name="text" required placeholder="Add a new note..." className="flex-1 border p-2 rounded text-sm resize-none h-10 outline-none focus:ring-1 focus:ring-blue-500" />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition">Post</button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // --- VIEWS ---
  const Dashboard = () => {
    const [compFilter, setCompFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const waitingList = crews
      .filter(c => c.status === 'onleave')
      .filter(c => compFilter === 'All' || c.competency === compFilter)
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (!a.readinessDate) return 1;
        if (!b.readinessDate) return -1;
        return new Date(a.readinessDate).getTime() - new Date(b.readinessDate).getTime();
      });

    return (
      <div className="flex flex-col h-full bg-gray-100 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2"><div className="flex items-center text-gray-800 font-bold"><FileWarning size={18} className="mr-2 text-orange-500"/> Contract Expiries</div><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.expiredContracts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.expiredContracts.length}</span></div>
            {systemAlerts.expiredContracts.length > 0 ? (<ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">{systemAlerts.expiredContracts.map((alert, idx) => (<li key={idx} className="flex justify-between items-center text-red-600"><span className="truncate w-3/5" title={alert.crewName}>{alert.crewName}</span><span className="text-xs font-semibold bg-red-50 px-1 rounded">{alert.shipName}</span></li>))}</ul>) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> All valid</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2"><div className="flex items-center text-gray-800 font-bold"><ShieldAlert size={18} className="mr-2 text-red-500"/> Safe Manning</div><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.manning.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.manning.length}</span></div>
            {systemAlerts.manning.length > 0 ? (<ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">{systemAlerts.manning.map((alert, idx) => (<li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current}/{alert.min}</span></li>))}</ul>) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> All OK</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2"><div className="flex items-center text-gray-800 font-bold"><Ship size={18} className="mr-2 text-blue-500"/> Cabin Capacity</div><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.cabin.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.cabin.length}</span></div>
            {systemAlerts.cabin.length > 0 ? (<ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">{systemAlerts.cabin.map((alert, idx) => (<li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current} (Max: {alert.max})</span></li>))}</ul>) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> Capacities compliant</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2"><div className="flex items-center text-gray-800 font-bold"><LifeBuoy size={18} className="mr-2 text-indigo-500"/> LSA Capacity</div><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.lsa.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.lsa.length}</span></div>
            {systemAlerts.lsa.length > 0 ? (<ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">{systemAlerts.lsa.map((alert, idx) => (<li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current} (Max: {alert.max})</span></li>))}</ul>) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> Compliant</div>)}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {ships.map(ship => {
              const onboard = crews.filter(c => c.shipId === ship.id && c.status === 'onboard');
              const expiredCount = onboard.filter(c => calculateDaysRemaining(c.contractEnd) < 0).length;
              const expiringSoonCount = onboard.filter(c => calculateDaysRemaining(c.contractEnd) >= 0 && calculateDaysRemaining(c.contractEnd) <= 30).length;
              const isCabinExceeded = onboard.length > ship.cabinCapacity;
              const isSafeManningLow = onboard.length < ship.minSafeManning;

              return (
                <div key={ship.id} onClick={() => setSelectedShipId(ship.id)} className={`${ship.color} p-4 rounded-lg shadow cursor-pointer transform transition hover:scale-105 border border-transparent hover:border-gray-400 relative`}>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-gray-800">{ship.name}</h3>
                    <span className="bg-white text-xs px-2 py-1 rounded shadow-sm font-semibold">{ship.flag}</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700 mb-4 min-h-[60px]">
                    {isSafeManningLow && <p className="text-red-600 font-semibold flex items-center"><ShieldAlert size={14} className="mr-1"/> Safe Manning not met!</p>}
                    {isCabinExceeded && <p className="text-red-600 font-semibold flex items-center"><AlertTriangle size={14} className="mr-1"/> Cabin capacity exceeded!</p>}
                    {expiredCount > 0 && <p className="font-medium text-red-600">{expiredCount} contract(s) expired</p>}
                    {expiringSoonCount > 0 && <p className="font-medium text-orange-600">{expiringSoonCount} contract(s) expiring soon</p>}
                    {!isSafeManningLow && !isCabinExceeded && expiredCount === 0 && expiringSoonCount === 0 && <p className="text-green-700">Status normal.</p>}
                  </div>
                  <div className="border-t border-gray-300/50 pt-3 flex justify-between items-center text-xs text-gray-600">
                    <div className="flex items-center"><Users size={14} className="mr-1" /> POB: {onboard.length} / {ship.cabinCapacity}</div>
                    
                    <div className="flex items-center gap-3">
                      {/* NOTLAR BUTONU */}
                      <button onClick={(e) => { e.stopPropagation(); setNotesEntity({type: 'ship', id: ship.id, name: ship.name}); }} className="relative flex items-center hover:scale-110 transition-transform" title="Notes">
                        <MessageCircle className={ship.notes?.length ? "text-red-500 fill-red-100" : "text-gray-400"} size={24} />
                        {ship.notes && ship.notes.length > 0 && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-red-800">{ship.notes.length}</span>}
                      </button>
                      <div className="flex items-center text-blue-600 font-semibold">Lineup <ChevronRight size={14} /></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-full lg:w-96 bg-white rounded-lg shadow p-4 flex flex-col">
            <h3 className="font-bold text-lg border-b pb-2 mb-3 flex items-center"><Anchor className="mr-2 text-blue-600" size={20} /> Crew Pool</h3>
            <div className="flex items-center mb-2 bg-gray-50 p-2 rounded border focus-within:ring-1 focus-within:ring-blue-500">
              <Search size={16} className="text-gray-500 mr-2" /><input type="text" placeholder="Search personnel..." className="bg-transparent text-sm w-full outline-none text-gray-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
            <div className="flex items-center mb-4 bg-gray-50 p-2 rounded border">
              <Filter size={16} className="text-gray-500 mr-2" /><select className="bg-transparent text-sm w-full outline-none font-medium text-gray-700" value={compFilter} onChange={(e) => setCompFilter(e.target.value)}><option value="All">All Competencies</option>{COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {waitingList.map((crew) => (
                <div key={crew.id} className="border-l-4 border-blue-500 bg-gray-50 p-3 rounded shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="max-w-[70%]">
                      <div className="flex items-center">
                        <span className="font-bold text-gray-800 block truncate" title={crew.name}>{crew.name}</span>
                        {/* KİŞİ NOTLARI BUTONU */}
                        <button onClick={(e) => { e.stopPropagation(); setNotesEntity({type: 'crew', id: crew.id, name: crew.name}); }} className="relative flex items-center hover:scale-110 transition-transform ml-2" title="Notes">
                          <MessageCircle className={crew.notes?.length ? "text-red-500 fill-red-100" : "text-gray-300"} size={18} />
                          {crew.notes && crew.notes.length > 0 && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-red-800">{crew.notes.length}</span>}
                        </button>
                      </div>
                      <span className="text-xs text-gray-500 block truncate">{crew.competency}</span>
                    </div>
                    {!isViewer && <button onClick={() => setAssignCrewData(crew)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-600 hover:text-white transition flex items-center"><UserPlus size={12} className="mr-1"/> Assign</button>}
                  </div>
                  <div className="mt-2 text-xs text-gray-600"><span className="text-gray-400">Readiness: </span>{crew.readinessDate ? new Date(crew.readinessDate).toLocaleDateString('en-GB') : 'TBA'}</div>
                </div>
              ))}
              {waitingList.length === 0 && <div className="text-center text-gray-500 text-sm py-4">No personnel found in pool.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ShipDetailsModal = () => {
    if (!selectedShipId) return null;
    const ship = ships.find(s => s.id === selectedShipId);
    if (!ship) return null;
    
    // Sort ranks based on Matrix Order
    const onboard = crews
      .filter(c => c.shipId === selectedShipId && c.status === 'onboard')
      .sort((a, b) => {
        const orderA = rankMatrix[a.rank || '']?.order || 999;
        const orderB = rankMatrix[b.rank || '']?.order || 999;
        return orderA - orderB;
      });

    const timelineSpan = 120; 
    const months = Array.from({length: 4}).map((_,i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i); return d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
    });

    return (
      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                {ship.name} - Lineup
                {/* GEMİ NOTLARI BUTONU */}
                <button onClick={(e) => { e.stopPropagation(); setNotesEntity({type: 'ship', id: ship.id, name: ship.name}); }} className="relative flex items-center hover:scale-110 transition-transform ml-3" title="Notes">
                  <MessageCircle className={ship.notes?.length ? "text-red-500 fill-red-100" : "text-gray-300"} size={28} />
                  {ship.notes && ship.notes.length > 0 && <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-red-800">{ship.notes.length}</span>}
                </button>
              </h2>
              <div className="text-sm text-gray-500 mt-1 flex gap-4">
                <span>Safe Manning: <strong className={onboard.length < ship.minSafeManning ? 'text-red-500' : ''}>{onboard.length}/{ship.minSafeManning}</strong></span>
                <span>Cabin Cap: <strong className={onboard.length > ship.cabinCapacity ? 'text-red-500' : ''}>{onboard.length}/{ship.cabinCapacity}</strong></span>
              </div>
            </div>
            <button onClick={() => setSelectedShipId(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={24} /></button>
          </div>
          
          <div className="p-2 flex-1 overflow-auto bg-white">
            <div className="flex border-b pb-2 mb-2 sticky top-0 bg-white z-20 text-xs font-bold text-gray-600">
              <div className="w-1/4 pl-2">Personnel Info</div>
              <div className="w-3/4 flex pr-6">
                <div className="w-1/4 border-l pl-2 text-center text-blue-600">{months[0]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[1]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[2]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[3]}</div>
              </div>
            </div>
            
            <div className="space-y-0 relative">
              {onboard.map((crew, idx) => {
                const startOffset = calculateDaysRemaining(crew.contractStart);
                const endOffset = calculateDaysRemaining(crew.contractEnd);
                
                const isPlanned = startOffset > 0;
                const isExpired = endOffset < 0;
                
                const colors = getContractColor(endOffset);
                
                let leftPercent = 0;
                let widthPercent = 0;

                if (!isExpired) {
                  const barStart = Math.max(0, startOffset);
                  const barEnd = Math.min(timelineSpan, endOffset);
                  if (barStart < timelineSpan) {
                    leftPercent = (barStart / timelineSpan) * 100;
                    widthPercent = ((barEnd - barStart) / timelineSpan) * 100;
                  }
                }

                const stripeStyle = crew.isProbation ? {
                  backgroundImage: isPlanned 
                    ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 8px, transparent 8px, transparent 16px)'
                    : 'repeating-linear-gradient(45deg, rgba(255,255,255,0.25), rgba(255,255,255,0.25) 8px, transparent 8px, transparent 16px)'
                } : {};

                // Aynı görevdeki personellerin margin'i silindi (dipdibe olması için)
                const prevCrew = idx > 0 ? onboard[idx - 1] : null;
                const isSameRankAsPrev = prevCrew?.rank === crew.rank;

                return (
                  <div 
                    key={crew.id} 
                    className={`flex items-center text-xs hover:bg-gray-50 px-2 group ${isSameRankAsPrev ? 'py-0 border-t-0' : 'pt-2 pb-1 border-t border-gray-200 mt-1'}`}
                  >
                    <div className="w-1/4 flex justify-between items-center pr-2">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="font-bold text-gray-800 truncate leading-tight" title={crew.name}>{crew.name}</span>
                          {/* KİŞİ NOTLARI BUTONU */}
                          <button onClick={(e) => { e.stopPropagation(); setNotesEntity({type: 'crew', id: crew.id, name: crew.name}); }} className="relative flex items-center hover:scale-110 transition-transform ml-1" title="Notes">
                            <MessageCircle className={crew.notes?.length ? "text-red-500 fill-red-100" : "text-gray-300"} size={16} />
                            {crew.notes && crew.notes.length > 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-red-800">{crew.notes.length}</span>}
                          </button>
                        </div>
                        <div className="text-gray-500 text-[10px] flex gap-1 leading-tight mt-0.5">
                          <span className={`font-bold ${isPlanned ? 'text-blue-500' : 'text-gray-800'}`}>{crew.rank}</span> 
                          <span className="truncate" title={crew.competency}>({crew.competency})</span>
                        </div>
                      </div>
                      {!isViewer && <button onClick={() => setSignOffCrewData(crew)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-100 p-1 rounded transition-all" title="Sign-off from vessel"><LogOut size={14} /></button>}
                    </div>

                    <div className="w-3/4 flex relative h-6 items-center rounded pr-6 overflow-visible">
                      <div className="absolute left-1/4 top-0 h-full border-l border-dashed border-gray-200 w-1/4 z-0"></div>
                      <div className="absolute left-2/4 top-0 h-full border-l border-dashed border-gray-200 w-1/4 z-0"></div>
                      <div className="absolute left-3/4 top-0 h-full border-l border-dashed border-gray-200 w-1/4 z-0"></div>
                      
                      {isExpired ? (
                        <div className="relative z-10 pl-2 text-red-600 font-bold flex items-center text-[10px]">
                          <AlertTriangle size={12} className="mr-1"/> Expired ({Math.abs(endOffset)}d)
                        </div>
                      ) : (
                        <div className="absolute h-[18px] flex items-center z-10" style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '40px' }}>
                          <div 
                            className={`h-full w-full rounded shadow-sm flex items-center justify-center text-[9px] font-bold overflow-hidden transition-all duration-300
                              ${isPlanned ? `border-2 border-dashed ${colors.border} ${colors.light} ${colors.text}` : `${colors.bg} text-white`}`
                            }
                            style={stripeStyle}
                            title={crew.isProbation ? 'Probation Period' : (isPlanned ? `Planned to join in ${startOffset} days` : `Ends in ${endOffset} days`)}
                          >
                            {isPlanned ? 'PLANNED' : ''}
                          </div>

                          {!isViewer && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditCrewData(crew); setShowCrewModal(true); }}
                              className={`absolute -right-5 p-0.5 rounded-full hover:bg-gray-200 transition-transform hover:scale-110 ${colors.text}`}
                              title="Extension / Edit Contract"
                            >
                              <ChevronRight size={14} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {onboard.length === 0 && <div className="text-center text-gray-500 py-8 text-sm">No personnel onboard.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const AdminPanel = () => {
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [adminCompFilter, setAdminCompFilter] = useState('All');
    const filteredAdminCrews = crews.filter(c => adminCompFilter === 'All' || c.competency === adminCompFilter).filter(c => c.name.toLowerCase().includes(adminSearchTerm.toLowerCase()));

    return (
      <div className="p-6 h-full overflow-y-auto bg-gray-50">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center"><Settings className="mr-2" /> System Settings</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center text-blue-800 border-b pb-2"><Ship className="mr-2" size={20}/> Fleet Configurations</h3>
            <div className="space-y-4">
              {ships.map(ship => (
                <div key={ship.id} className="border p-3 rounded bg-gray-50 flex flex-col xl:flex-row gap-4 items-center text-sm group transition-colors">
                  <div className="flex-1 font-bold">{ship.name} ({ship.flag})</div>
                  <div className="flex gap-2">
                    <div className="bg-white p-1 px-2 border rounded text-center shadow-sm"><span className="text-gray-500 text-xs block">Min Safe</span><strong className="text-base">{ship.minSafeManning}</strong></div>
                    <div className="bg-white p-1 px-2 border rounded text-center shadow-sm"><span className="text-gray-500 text-xs block">Cabin</span><strong className="text-base">{ship.cabinCapacity}</strong></div>
                    <div className="bg-white p-1 px-2 border rounded text-center shadow-sm"><span className="text-gray-500 text-xs block">LSA Cap.</span><strong className="text-base">{ship.lsaCapacity}</strong></div>
                  </div>
                  {appUser?.role === 'admin' && (
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditShipData(ship)} className="text-blue-500 hover:text-blue-700 p-2 bg-blue-100 rounded" title="Edit Vessel"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteShipDb(ship.id, ship.name)} className="text-red-400 hover:text-red-600 p-2 bg-red-100 rounded" title="Delete Vessel"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
              {appUser?.role === 'admin' && (
                <button onClick={() => setShowShipModal(true)} className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded flex items-center justify-center hover:border-blue-500 hover:text-blue-600 transition"><Plus size={20} className="mr-2" /> Add New Vessel</button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center text-blue-800 border-b pb-2"><Users className="mr-2" size={20}/> Personnel Database</h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="flex-1 flex items-center bg-gray-50 p-2 rounded border focus-within:ring-1 focus-within:ring-blue-500"><Search size={16} className="text-gray-500 mr-2" /><input type="text" placeholder="Search personnel..." className="bg-transparent text-sm w-full outline-none text-gray-700" value={adminSearchTerm} onChange={(e) => setAdminSearchTerm(e.target.value)} /></div>
              <div className="flex-1 flex items-center bg-gray-50 p-2 rounded border"><Filter size={16} className="text-gray-500 mr-2" /><select className="bg-transparent text-sm w-full outline-none font-medium text-gray-700" value={adminCompFilter} onChange={(e) => setAdminCompFilter(e.target.value)}><option value="All">All Competencies</option>{COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2">
              {filteredAdminCrews.map(crew => (
                <div key={crew.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 group transition-colors">
                  <div className="max-w-[70%]">
                    <div className="font-bold text-sm text-gray-800 truncate" title={crew.name}>{crew.name}</div>
                    <div className="text-xs text-gray-500 truncate" title={crew.competency}>{crew.competency} • {crew.status === 'onboard' ? `Onboard (${ships.find(s=>s.id===crew.shipId)?.name || 'Unknown'} - ${crew.rank})` : 'On Leave (Pool)'}</div>
                  </div>
                  {appUser?.role === 'admin' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditCrewData(crew)} className="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 rounded shadow-sm" title="Edit Personnel"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteCrewDb(crew.id, crew.name)} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded shadow-sm" title="Delete Personnel"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {appUser?.role === 'admin' && (
              <button onClick={() => setShowCrewModal(true)} className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded flex items-center justify-center hover:border-blue-500 hover:text-blue-600 transition"><Plus size={20} className="mr-2" /> Add New Personnel</button>
            )}
          </div>
          
          {appUser?.role === 'admin' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
              <h3 className="text-lg font-bold mb-4 flex items-center text-indigo-800 border-b pb-2"><UserCog className="mr-2" size={20}/> System Users & Access</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 items-start">
                 {appUsers.map(u => (
                   <div key={u.id} className="border border-indigo-100 bg-indigo-50/50 p-4 rounded-lg flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-gray-800">{u.username}</div>
                        <div className="text-xs text-indigo-600 uppercase tracking-wider font-semibold mt-1">Role: {u.role}</div>
                        <div className="text-xs text-gray-500 mt-1">Pwd: {u.password}</div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditUserData(u)} className="text-indigo-500 hover:text-indigo-700 p-2 bg-white rounded shadow-sm" title="Edit User"><Edit size={16}/></button>
                        <button onClick={() => handleDeleteUserDb(u.id, u.username)} className="text-red-400 hover:text-red-600 p-2 bg-white rounded shadow-sm" title="Delete User"><Trash2 size={16}/></button>
                      </div>
                   </div>
                 ))}
              </div>
              <button onClick={() => setShowUserModal(true)} className="w-full md:w-auto px-6 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 font-bold rounded flex items-center justify-center hover:border-indigo-500 hover:bg-indigo-50 transition"><Plus size={20} className="mr-2" /> Add System User</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ComplianceMatrixPanel = () => {
    const [newRankName, setNewRankName] = useState('');
    const [addingCompToRank, setAddingCompToRank] = useState<string | null>(null);

    const handleMoveRank = (rank: string, direction: 'up' | 'down') => {
      const sorted = [...RANKS];
      const idx = sorted.indexOf(rank);
      if (direction === 'up' && idx > 0) {
        [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
      } else if (direction === 'down' && idx < sorted.length - 1) {
        [sorted[idx + 1], sorted[idx]] = [sorted[idx], sorted[idx + 1]];
      } else return;
      
      const newMatrix = { ...rankMatrix };
      sorted.forEach((r, i) => { newMatrix[r] = { ...newMatrix[r], order: (i + 1) * 10 }; });
      handleUpdateMatrixToDb(newMatrix);
    };

    const handleAddRank = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!newRankName.trim()) return;
      const updatedMatrix = { ...rankMatrix, [newRankName.trim()]: { competencies: [], checkOverlap: true, order: (RANKS.length + 1) * 10 } };
      handleUpdateMatrixToDb(updatedMatrix);
      setNewRankName('');
    };

    const handleDeleteRank = (rankToDelete: string) => {
      if (window.confirm(`Are you sure you want to delete the rank '${rankToDelete}'?\nNote: Existing personnel with this rank will not be deleted but may be flagged for compliance.`)) {
        const updatedMatrix = { ...rankMatrix };
        delete updatedMatrix[rankToDelete];
        handleUpdateMatrixToDb(updatedMatrix);
      }
    };

    const handleAddCompetency = (rank: string, compToAdd: string) => {
      if (!compToAdd.trim()) return;
      const currentDef = rankMatrix[rank] || { competencies: [], checkOverlap: true, order: 999 };
      if (currentDef.competencies.includes(compToAdd.trim())) return;

      const updatedMatrix = { ...rankMatrix, [rank]: { ...currentDef, competencies: [...currentDef.competencies, compToAdd.trim()] } };
      handleUpdateMatrixToDb(updatedMatrix);
      setAddingCompToRank(null);
    };

    const handleDeleteCompetency = (rank: string, compToDelete: string) => {
      if (window.confirm(`Remove '${compToDelete}' competency from rank '${rank}'?`)) {
        const currentDef = rankMatrix[rank];
        const updatedMatrix = { ...rankMatrix, [rank]: { ...currentDef, competencies: currentDef.competencies.filter(c => c !== compToDelete) } };
        handleUpdateMatrixToDb(updatedMatrix);
      }
    };

    const handleToggleOverlap = (rank: string, isChecked: boolean) => {
      const currentDef = rankMatrix[rank];
      const updatedMatrix = { ...rankMatrix, [rank]: { ...currentDef, checkOverlap: isChecked } };
      handleUpdateMatrixToDb(updatedMatrix);
    };

    const InlineAddCompForm = ({ rank }: { rank: string }) => {
      const [val, setVal] = useState('');
      return (
        <form className="flex items-center gap-2 mt-2 bg-gray-50 p-2 rounded border border-blue-200 shadow-sm" onSubmit={(e) => { e.preventDefault(); handleAddCompetency(rank, val); }}>
          <input type="text" list="matrix-comp-list" autoFocus className="border p-1.5 rounded text-sm w-48 outline-none focus:ring-1 focus:ring-blue-500" placeholder="Type or select competency..." value={val} onChange={(e) => setVal(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 transition" title="Save"><Check size={16} /></button>
          <button type="button" onClick={() => setAddingCompToRank(null)} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300 transition" title="Cancel"><X size={16} /></button>
        </form>
      );
    };

    return (
      <div className="p-6 h-full overflow-y-auto bg-gray-50">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 flex items-center"><TableProperties className="mr-3" /> Rank - Competency Compliance Matrix</h2>
        <p className="text-gray-600 mb-6 border-b pb-4">Define acceptable competencies, overlap rules and hierarchy order for each rank here. The values added here will automatically populate the dropdown menus throughout the system.</p>

        <datalist id="matrix-comp-list">{COMPETENCIES.map(c => <option key={c} value={c} />)}</datalist>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-gray-200 text-sm">
                <th className="p-4 font-bold w-12 text-center">Order</th>
                <th className="p-4 font-bold w-1/4">Rank (Position)</th>
                <th className="p-4 font-bold w-24 text-center" title="Warn when multiple crew assigned">Overlap?</th>
                <th className="p-4 font-bold w-full">Accepted Competencies</th>
                <th className="p-4 font-bold w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((rank, idx) => (
                <tr key={rank} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
                  <td className="p-2 align-middle text-center">
                    <div className="flex flex-col items-center opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleMoveRank(rank, 'up')} disabled={idx===0} className="hover:text-blue-600 disabled:opacity-30"><ArrowUp size={16}/></button>
                      <button onClick={() => handleMoveRank(rank, 'down')} disabled={idx===RANKS.length-1} className="hover:text-blue-600 disabled:opacity-30"><ArrowDown size={16}/></button>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-gray-800 align-middle">{rank}</td>
                  <td className="p-4 align-middle text-center">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" checked={rankMatrix[rank]?.checkOverlap ?? true} onChange={(e) => handleToggleOverlap(rank, e.target.checked)} title="Warn on overlap" />
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex flex-wrap gap-2 items-center">
                      {(rankMatrix[rank]?.competencies || []).map(comp => (
                        <div key={comp} className="flex items-center bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                          {comp}<button onClick={() => handleDeleteCompetency(rank, comp)} className="ml-2 text-blue-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                        </div>
                      ))}
                      {addingCompToRank === rank ? <InlineAddCompForm rank={rank} /> : <button onClick={() => setAddingCompToRank(rank)} className="flex items-center text-sm font-bold text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 px-3 py-1.5 rounded-full transition-colors"><Plus size={16} className="mr-1" /> Add</button>}
                    </div>
                  </td>
                  <td className="p-4 align-middle text-center"><button onClick={() => handleDeleteRank(rank)} className="text-red-400 hover:text-red-600 p-2 rounded bg-white shadow-sm border" title="Delete Rank"><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {RANKS.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-gray-500">No ranks defined in the matrix yet.</td></tr>)}
            </tbody>
          </table>
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <form onSubmit={handleAddRank} className="flex items-center gap-3">
              <input type="text" placeholder="Enter new Rank name..." className="border p-2 rounded w-64 focus:ring-2 focus:ring-blue-500 outline-none" value={newRankName} onChange={(e) => setNewRankName(e.target.value)} />
              <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded font-bold hover:bg-slate-700 transition flex items-center"><Plus size={18} className="mr-2" /> Add Rank</button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-gray-200 text-gray-900 overflow-hidden">
      <header className="bg-slate-900 text-white p-4 shadow-md z-10 flex justify-between items-center">
        <div className="flex items-center"><Anchor className="mr-3" size={28} /><h1 className="text-xl font-bold tracking-wider hidden sm:block">CREW MASTER PRO</h1></div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <nav className="flex space-x-1 md:space-x-2">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center px-3 py-2 rounded transition-colors text-sm md:text-base ${activeTab === 'dashboard' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18} className="mr-1 md:mr-2" /> Dashboard</button>
            {appUser?.role === 'admin' && (
              <button onClick={() => setActiveTab('matrix')} className={`flex items-center px-3 py-2 rounded transition-colors text-sm md:text-base ${activeTab === 'matrix' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}><TableProperties size={18} className="mr-1 md:mr-2" /> Matrix</button>
            )}
            {!isViewer && (
              <button onClick={() => setActiveTab('admin')} className={`flex items-center px-3 py-2 rounded transition-colors text-sm md:text-base ${activeTab === 'admin' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}><Settings size={18} className="mr-1 md:mr-2" /> Settings</button>
            )}
          </nav>
          <div className="h-6 w-px bg-slate-600 mx-1 md:mx-2"></div>
          <div className="flex items-center">
            <span className="mr-3 text-sm text-slate-300 hidden md:block">Hi, <strong>{appUser?.username}</strong></span>
            <button onClick={() => setAppUser(null)} className="text-red-400 hover:text-red-300 hover:bg-slate-800 p-2 rounded flex items-center transition" title="Secure Logout"><LogOut size={20} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'matrix' && <ComplianceMatrixPanel />}
        {activeTab === 'admin' && !isViewer && <AdminPanel />}
        
        <ShipDetailsModal />
        <ShipFormModal />
        <CrewFormModal />
        <AssignCrewModal />
        <OverrideModal />
        <HandoverModal />
        <SignOffModal />
        <SystemUserFormModal />
        <NotesModal />
      </main>
    </div>
  );
}