import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  AlertTriangle, CheckCircle, Users, Ship, ShieldAlert, 
  Settings, LayoutDashboard, Filter, ChevronRight, Anchor, Plus, X, UserPlus, LogOut, Search, Trash2,
  FileWarning, LifeBuoy, Lock, UserCog, LogIn, Edit
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';



// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: 'AIzaSyBodyi-nGpL7TExhyxJQkL5boZxVzB-NKs',
  authDomain: 'crew-change-follow-up.firebaseapp.com',
  projectId: 'crew-change-follow-up',
  storageBucket: 'crew-change-follow-up.firebasestorage.app',
  messagingSenderId: '224379023927',
  appId: '1:224379023927:web:4e6b7cd7dc87519b0685b2',
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TYPESCRIPT INTERFACES ---
export interface ShipData {
  id: string;
  name: string;
  flag: string;
  minSafeManning: number;
  cabinCapacity: number;
  lsaCapacity: number;
  color: string;
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
}

export interface AppUserData {
  id: string;
  username: string;
  password?: string;
  role: string;
}

// --- CONSTANTS (Tanker Specific) ---
const COMPETENCIES = [
  'Master Mariner', 'Chief Mate', 'OOW (Deck)',
  'Chief Engineer', 'Second Engineer', 'OOW (Engine)',
  'Pumpman', 'Rating (Deck)', 'AB', 'O/S', 
  'Rating (Engine)', 'Oiler', 'Wiper',
  'Ship\'s Cook', 'Cadet (Deck)', 'Cadet (Engine)'
];

const RANKS = ['Master', 'C/O', '2/O', '3/O', 'C/E', '1/E', '2/E', '3/E', 'Pumpman', 'Bosun', 'AB', 'O/S', 'Oiler', 'Wiper', 'Cook', 'Messman', 'Cadet'];

const RANK_COMPETENCY_MATRIX: Record<string, string[]> = {
  'Master': ['Master Mariner'],
  'C/O': ['Master Mariner', 'Chief Mate'],
  '2/O': ['Master Mariner', 'Chief Mate', 'OOW (Deck)'],
  '3/O': ['Master Mariner', 'Chief Mate', 'OOW (Deck)'],
  'C/E': ['Chief Engineer'],
  '1/E': ['Chief Engineer', 'Second Engineer'],
  '2/E': ['Chief Engineer', 'Second Engineer', 'OOW (Engine)'],
  '3/E': ['Chief Engineer', 'Second Engineer', 'OOW (Engine)'],
  'Pumpman': ['Pumpman', 'Rating (Engine)', 'Second Engineer'],
  'Bosun': ['Rating (Deck)', 'AB'],
  'AB': ['Rating (Deck)', 'AB', 'OOW (Deck)', 'Chief Mate', 'Master Mariner'],
  'O/S': ['Rating (Deck)', 'AB', 'O/S', 'OOW (Deck)', 'Cadet (Deck)'],
  'Oiler': ['Rating (Engine)', 'Oiler', 'OOW (Engine)', 'Second Engineer', 'Chief Engineer'],
  'Wiper': ['Rating (Engine)', 'Oiler', 'Wiper', 'OOW (Engine)', 'Cadet (Engine)'],
  'Cook': ['Ship\'s Cook'],
  'Messman': ['Ship\'s Cook', 'Rating (Deck)', 'Rating (Engine)', 'O/S', 'Wiper'],
  'Cadet': ['Cadet (Deck)', 'Cadet (Engine)']
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
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
      ships: collection(db, 'ships'),
      crew: collection(db, 'crew'),
      appUsers: collection(db, 'appUsers')
    };

    const dataLoadedFlags = { ships: false, crew: false, appUsers: false };

    const checkAllLoaded = () => {
      if (dataLoadedFlags.ships && dataLoadedFlags.crew && dataLoadedFlags.appUsers) {
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
        // Initial Admin creation
        await setDoc(doc(paths.appUsers, 'admin_user'), { id: 'admin_user', username: 'admin', password: 'Bt.admin.86!', role: 'admin' });
      } else {
        setAppUsers(snap.docs.map(d => d.data() as AppUserData));
      }
      dataLoadedFlags.appUsers = true; checkAllLoaded();
    }, (err) => console.error(err));

    return () => { unsubShips(); unsubCrew(); unsubUsers(); };
  }, [firebaseUser]);


  const calculateDaysRemaining = (endDateStr: string | null) => {
    if (!endDateStr) return 0;
    const diffTime = new Date(endDateStr).getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getContractColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return 'bg-red-500';
    if (daysRemaining < 15) return 'bg-orange-500';
    if (daysRemaining < 45) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const getStatusText = (daysRemaining: number) => {
    if (daysRemaining < 0) return `Expired ${Math.abs(daysRemaining)} days ago`;
    if (daysRemaining === 0) return `Expires today`;
    return `${daysRemaining} days left`;
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

  const checkCompetencyMatch = (competency: string, rank: string) => (RANK_COMPETENCY_MATRIX[rank] || []).includes(competency);

  const handleAddShipToDb = async (newShipData: Partial<ShipData>) => {
    const newId = `ship_${Date.now()}`;
    const ship = { ...newShipData, id: newId };
    await setDoc(doc(db, 'ships', newId), ship);
  };

  const handleUpdateShipToDb = async (shipId: string, updatedData: Partial<ShipData>) => {
    await setDoc(doc(db, 'ships', shipId), updatedData, { merge: true });
  };

  const handleDeleteShipDb = async (id: string, name: string) => {
    if(window.confirm(`Are you sure you want to permanently delete vessel '${name}'?\nWarning: Personnel onboard will lose their vessel assignment.`)) {
      await deleteDoc(doc(db, 'ships', id));
    }
  };

  const attemptAssignment = (newCrewData: CrewData) => {
    const executeAssignment = async (isRelieve = false, existingCrewToRelieveId: string | null = null) => {
      const targetCrewId = newCrewData.id || `crew_${Date.now()}`;
      const finalCrewData = { ...newCrewData, id: targetCrewId };

      if (isRelieve && existingCrewToRelieveId) {
        const existingCrewRef = doc(db, 'crew', existingCrewToRelieveId);
        const relievedData = crews.find(c => c.id === existingCrewToRelieveId);
        if (relievedData) {
          await setDoc(existingCrewRef, { 
            ...relievedData, status: 'onleave', shipId: null, rank: null, contractStart: null, contractEnd: null, readinessDate: today.toISOString() 
          });
        }
      }

      await setDoc(doc(db, 'crew', targetCrewId), finalCrewData, { merge: true });
      setShowCrewModal(false);
      setEditCrewData(null);
      setAssignCrewData(null);
    };

    const checkOverlap = () => {
      const existingCrew = crews.find(c => c.shipId === newCrewData.shipId && c.status === 'onboard' && c.rank === newCrewData.rank && c.id !== newCrewData.id);
      if (existingCrew) {
        setOverlapWarning({
          newCrew: newCrewData, existingCrew: existingCrew,
          onRelieve: () => { executeAssignment(true, existingCrew.id); setOverlapWarning(null); },
          onAdditional: () => { executeAssignment(false); setOverlapWarning(null); }
        });
      } else { executeAssignment(false); }
    };

    if (newCrewData.rank && !checkCompetencyMatch(newCrewData.competency, newCrewData.rank)) {
      setOverrideWarning({
        message: `The competency of ${newCrewData.name} (${newCrewData.competency}) does not match the selected rank (${newCrewData.rank}). Do you still want to proceed?`,
        onConfirm: () => { setOverrideWarning(null); checkOverlap(); }
      });
    } else { checkOverlap(); }
  };

  const processSignOffDb = async (crewId: string, rejoinDate: string | null) => {
    const c = crews.find(cr => cr.id === crewId);
    if(c) {
      await setDoc(doc(db, 'crew', crewId), { 
        ...c, status: 'onleave', shipId: null, rank: null, contractStart: null, contractEnd: null, readinessDate: rejoinDate ? new Date(rejoinDate).toISOString() : null
      });
    }
  };

  const handleDeleteCrewDb = async (id: string, name: string) => {
    if(window.confirm(`Are you sure you want to permanently delete ${name} from the database?`)) {
      await deleteDoc(doc(db, 'crew', id));
    }
  };

  const handleAddUserToDb = async (userData: Partial<AppUserData>) => {
    const newId = `user_${Date.now()}`;
    const user = { ...userData, id: newId };
    await setDoc(doc(db, 'appUsers', newId), user);
  };

  const handleUpdateUserToDb = async (userId: string, updatedData: Partial<AppUserData>) => {
    await setDoc(doc(db, 'appUsers', userId), updatedData, { merge: true });
  };

  const handleDeleteUserDb = async (id: string, username: string) => {
    if (appUsers.length <= 1) {
      alert("Cannot delete the last remaining user.");
      return;
    }
    if (window.confirm(`Delete user access for '${username}'?`)) {
      await deleteDoc(doc(db, 'appUsers', id));
    }
  };


  // --- LOGIN SCREEN ---
  if (isDbLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white font-bold">Connecting to Secure Database...</div>;
  }

  if (!appUser) {
    const handleLogin = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const u = fd.get('username') as string;
      const p = fd.get('password') as string;
      const foundUser = appUsers.find(user => user.username === u && user.password === p);
      
      if (foundUser) setAppUser(foundUser);
      else alert('Invalid username or password.');
    };

    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-800">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-sm border-t-8 border-blue-600">
          <div className="flex justify-center mb-6"><Anchor size={48} className="text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6 tracking-wide">CREW MASTER PRO</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
              <div className="relative">
                <UserCog size={18} className="absolute left-3 top-3 text-gray-400"/>
                <input name="username" required className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Enter username" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-gray-400"/>
                <input name="password" type="password" required className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Enter password" />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center mt-2">
              <LogIn className="mr-2" size={18} /> Secure Login
            </button>
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
          <div className="flex justify-end space-x-3">
            <button onClick={() => setOverrideWarning(null)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={overrideWarning.onConfirm} className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 font-bold">Confirm & Proceed</button>
          </div>
        </div>
      </div>
    );
  };

  const HandoverModal = () => {
    if (!overlapWarning) return null;
    const { newCrew, existingCrew, onRelieve, onAdditional } = overlapWarning;
    const shipName = ships.find(s => s.id === newCrew.shipId)?.name;

    return (
      <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 border-l-8 border-blue-500">
          <div className="flex items-center text-blue-700 mb-4"><Users size={32} className="mr-3" /><h2 className="text-xl font-bold">Rank Overlap Detected</h2></div>
          <p className="text-gray-700 mb-4">
            <strong>{existingCrew.name}</strong> is currently assigned as <strong>{newCrew.rank}</strong> onboard <strong>{shipName}</strong>.
          </p>
          <div className="bg-blue-50 p-3 rounded mb-6 text-sm text-blue-800">
            How would you like to proceed with this assignment? <br/><br/>
            - <strong>Relieve:</strong> Signs off the current personnel and assigns the new one.<br/>
            - <strong>Additional:</strong> Keeps current personnel onboard, assigns the new one simultaneously (Handover/Parallel).
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button onClick={() => setOverlapWarning(null)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={onAdditional} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-bold flex items-center justify-center">Assign as Additional</button>
            <button onClick={onRelieve} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center justify-center">Relieve Existing Crew</button>
          </div>
        </div>
      </div>
    );
  };

  const SignOffModal = () => {
    if (!signOffCrewData) return null;
    const daysLeft = calculateDaysRemaining(signOffCrewData.contractEnd);
    const isEarlySignOff = daysLeft > 30;
    const contractStatusMsg = daysLeft < 0 ? `Their contract expired ${Math.abs(daysLeft)} days ago.` : `They have ${daysLeft} days left on their contract.`;

    const handleSignOff = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const rejoinDate = new FormData(e.currentTarget).get('rejoinDate') as string | null;
      processSignOffDb(signOffCrewData.id, rejoinDate);
      setSignOffCrewData(null);
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
        <form onSubmit={handleSignOff} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border-l-8 border-red-500">
          <div className="flex items-center text-red-600 mb-4"><LogOut size={32} className="mr-3" /><h2 className="text-xl font-bold">Sign-Off Personnel</h2></div>
          <p className="text-gray-800 font-medium mb-1">Are you sure you want to sign-off <strong>{signOffCrewData.name}</strong>?</p>
          <p className={`text-sm mb-4 font-semibold ${daysLeft < 0 ? 'text-red-600' : 'text-blue-600'}`}>{contractStatusMsg}</p>
          {isEarlySignOff && (
            <div className="bg-orange-50 border border-orange-200 p-3 mb-4 rounded text-sm text-orange-800 shadow-sm flex items-start">
              <AlertTriangle className="mr-2 shrink-0 mt-0.5 text-orange-600" size={16} />
              <div><strong>Early Sign-Off Notice:</strong><br/>Crew member still has a valid contract. Please be reminded that early sign-off or resignation must be properly justified.</div>
            </div>
          )}
          <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
            <label className="block text-sm font-bold text-gray-700 mb-2">Expected rejoin date (Optional):</label>
            <input name="rejoinDate" type="date" className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setSignOffCrewData(null)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Confirm Sign-Off</button>
          </div>
        </form>
      </div>
    );
  };

  // Shared Add/Edit Ship Modal
  const ShipFormModal = () => {
    if (!showShipModal && !editShipData) return null;
    const isEditing = !!editShipData;
    
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const shipData: Partial<ShipData> = {
        name: fd.get('name') as string, 
        flag: fd.get('flag') as string, 
        minSafeManning: parseInt(fd.get('minSafeManning') as string), 
        cabinCapacity: parseInt(fd.get('cabinCapacity') as string), 
        lsaCapacity: parseInt(fd.get('lsaCapacity') as string), 
        color: editShipData ? editShipData.color : 'bg-blue-100'
      };
      
      if (isEditing && editShipData) {
        handleUpdateShipToDb(editShipData.id, shipData);
        setEditShipData(null);
      } else {
        handleAddShipToDb(shipData);
        setShowShipModal(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Ship className="mr-2" /> {isEditing ? 'Edit Vessel' : 'Add New Vessel'}</h2>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Vessel Name</label><input name="name" defaultValue={editShipData?.name} required className="w-full border p-2 rounded" /></div>
            <div><label className="block text-sm font-bold text-gray-700">Flag (e.g., TR, PA)</label><input name="flag" defaultValue={editShipData?.flag} required className="w-full border p-2 rounded" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs font-bold text-gray-700">Min. Safe</label><input name="minSafeManning" defaultValue={editShipData?.minSafeManning} type="number" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-xs font-bold text-gray-700">Cabin Cap.</label><input name="cabinCapacity" defaultValue={editShipData?.cabinCapacity} type="number" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-xs font-bold text-gray-700">LSA Cap.</label><input name="lsaCapacity" defaultValue={editShipData?.lsaCapacity} type="number" required className="w-full border p-2 rounded" /></div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => { setShowShipModal(false); setEditShipData(null); }} className="px-4 py-2 border rounded font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">{isEditing ? 'Update Vessel' : 'Save Vessel'}</button>
          </div>
        </form>
      </div>
    );
  };

  // Shared Add/Edit Crew Modal
  const CrewFormModal = () => {
    if (!showCrewModal && !editCrewData) return null;
    const isEditing = !!editCrewData;
    const [statusOption, setStatusOption] = useState(editCrewData ? editCrewData.status : 'onleave');

    useEffect(() => {
      if (editCrewData) setStatusOption(editCrewData.status);
      else setStatusOption('onleave');
    }, [editCrewData, showCrewModal]);

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
      };

      attemptAssignment(crewData);
    };

    const formatDateForInput = (isoString?: string | null) => isoString ? isoString.split('T')[0] : '';

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Users className="mr-2" /> {isEditing ? 'Edit Personnel' : 'Add New Personnel'}</h2>
          <div className="flex space-x-4 mb-4 border-b pb-4">
            <label className="flex items-center cursor-pointer"><input type="radio" checked={statusOption === 'onleave'} onChange={() => setStatusOption('onleave')} className="mr-2" /> Crew Pool (On Leave)</label>
            <label className="flex items-center cursor-pointer"><input type="radio" checked={statusOption === 'onboard'} onChange={() => setStatusOption('onboard')} className="mr-2" /> Assign to Vessel</label>
          </div>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Full Name</label><input name="name" defaultValue={editCrewData?.name} required className="w-full border p-2 rounded" /></div>
            <div><label className="block text-sm font-bold text-gray-700">Competency (License)</label><select name="competency" defaultValue={editCrewData?.competency} required className="w-full border p-2 rounded">{COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            {statusOption === 'onleave' && (<div><label className="block text-sm font-bold text-gray-700">Readiness / Rejoin Date</label><input name="readinessDate" defaultValue={formatDateForInput(editCrewData?.readinessDate)} type="date" className="w-full border p-2 rounded" /></div>)}
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
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => { setShowCrewModal(false); setEditCrewData(null); }} className="px-4 py-2 border rounded font-semibold">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">{isEditing ? 'Update Personnel' : 'Save Personnel'}</button></div>
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
        readinessDate: null
      });
    };
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center text-blue-700"><UserPlus className="mr-2" /> Assign to Vessel</h2>
          <p className="text-gray-600 mb-4 pb-4 border-b">Assigning <strong>{assignCrewData.name}</strong>. <br/><span className="text-sm">Competency: {assignCrewData.competency}</span></p>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Target Vessel</label><select name="shipId" required className="w-full border p-2 rounded">{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-sm font-bold text-gray-700">Assign Rank</label><select name="rank" required className="w-full border p-2 rounded">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-bold text-gray-700">Contract Start</label><input name="contractStart" type="date" required className="w-full border p-2 rounded" /></div>
              <div><label className="block text-sm font-bold text-gray-700">Contract End</label><input name="contractEnd" type="date" required className="w-full border p-2 rounded" /></div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setAssignCrewData(null)} className="px-4 py-2 border rounded font-semibold">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Complete Assignment</button></div>
        </form>
      </div>
    );
  };

  // Shared Add/Edit System User Modal
  const SystemUserFormModal = () => {
    if (!showUserModal && !editUserData) return null;
    const isEditing = !!editUserData;
    
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const userData: Partial<AppUserData> = { 
        username: fd.get('username') as string, 
        password: fd.get('password') as string, 
        role: fd.get('role') as string 
      };
      
      if (isEditing && editUserData) {
        handleUpdateUserToDb(editUserData.id, userData);
        setEditUserData(null);
      } else {
        handleAddUserToDb(userData);
        setShowUserModal(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-700"><UserCog className="mr-2" /> {isEditing ? 'Edit System User' : 'Add System User'}</h2>
          <div className="space-y-3">
            <div><label className="block text-sm font-bold text-gray-700">Username</label><input name="username" defaultValue={editUserData?.username} required className="w-full border p-2 rounded" placeholder="e.g. john.doe" disabled={isEditing && editUserData?.username === 'admin'} /></div>
            <div><label className="block text-sm font-bold text-gray-700">Password</label><input name="password" defaultValue={editUserData?.password} required type="text" className="w-full border p-2 rounded" placeholder="Strong password" /></div>
            <div>
              <label className="block text-sm font-bold text-gray-700">Role</label>
              <select name="role" defaultValue={editUserData?.role || 'user'} className="w-full border p-2 rounded" disabled={isEditing && editUserData?.username === 'admin'}>
                <option value="user">User (Standard Access)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => { setShowUserModal(false); setEditUserData(null); }} className="px-4 py-2 border rounded font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">{isEditing ? 'Update User' : 'Save User'}</button>
          </div>
        </form>
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
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div className="flex items-center text-gray-800 font-bold"><FileWarning size={18} className="mr-2 text-orange-500"/> Contract Expiries</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.expiredContracts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.expiredContracts.length}</span>
            </div>
            {systemAlerts.expiredContracts.length > 0 ? (
              <ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">
                {systemAlerts.expiredContracts.map((alert, idx) => (
                  <li key={idx} className="flex justify-between items-center text-red-600"><span className="truncate w-3/5" title={alert.crewName}>{alert.crewName}</span><span className="text-xs font-semibold bg-red-50 px-1 rounded">{alert.shipName}</span></li>
                ))}
              </ul>
            ) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> All contracts valid</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div className="flex items-center text-gray-800 font-bold"><ShieldAlert size={18} className="mr-2 text-red-500"/> Safe Manning Alerts</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.manning.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.manning.length}</span>
            </div>
            {systemAlerts.manning.length > 0 ? (
              <ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">
                {systemAlerts.manning.map((alert, idx) => (
                  <li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current}/{alert.min}</span></li>
                ))}
              </ul>
            ) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> Safe Mannings OK</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div className="flex items-center text-gray-800 font-bold"><Ship size={18} className="mr-2 text-blue-500"/> Cabin Cap. Exceeded</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.cabin.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.cabin.length}</span>
            </div>
            {systemAlerts.cabin.length > 0 ? (
              <ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">
                {systemAlerts.cabin.map((alert, idx) => (
                  <li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current} (Max: {alert.max})</span></li>
                ))}
              </ul>
            ) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> Capacities compliant</div>)}
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div className="flex items-center text-gray-800 font-bold"><LifeBuoy size={18} className="mr-2 text-indigo-500"/> LSA Cap. Exceeded</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${systemAlerts.lsa.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{systemAlerts.lsa.length}</span>
            </div>
            {systemAlerts.lsa.length > 0 ? (
              <ul className="text-sm space-y-1 max-h-24 overflow-y-auto pr-1">
                {systemAlerts.lsa.map((alert, idx) => (
                  <li key={idx} className="flex justify-between items-center text-red-600"><span className="font-semibold">{alert.shipName}</span><span className="text-xs">POB: {alert.current} (Max: {alert.max})</span></li>
                ))}
              </ul>
            ) : (<div className="text-green-600 text-sm flex items-center"><CheckCircle size={14} className="mr-1"/> LSA Capacities OK</div>)}
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
                  <div className="flex justify-between items-start mb-4"><h3 className="font-bold text-lg text-gray-800">{ship.name}</h3><span className="bg-white text-xs px-2 py-1 rounded shadow-sm font-semibold">{ship.flag}</span></div>
                  <div className="space-y-2 text-sm text-gray-700 mb-4 min-h-[60px]">
                    {isSafeManningLow && <p className="text-red-600 font-semibold flex items-center"><ShieldAlert size={14} className="mr-1"/> Safe Manning not met!</p>}
                    {isCabinExceeded && <p className="text-red-600 font-semibold flex items-center"><AlertTriangle size={14} className="mr-1"/> Cabin capacity exceeded!</p>}
                    {expiredCount > 0 && <p className="font-medium text-red-600">{expiredCount} crew contract(s) expired</p>}
                    {expiringSoonCount > 0 && <p className="font-medium text-orange-600">{expiringSoonCount} contract(s) expiring soon</p>}
                    {!isSafeManningLow && !isCabinExceeded && expiredCount === 0 && expiringSoonCount === 0 && <p className="text-green-700">Status normal.</p>}
                  </div>
                  <div className="border-t border-gray-300/50 pt-2 flex justify-between items-center text-xs text-gray-600">
                    <div className="flex items-center"><Users size={14} className="mr-1" /> POB: {onboard.length} / {ship.cabinCapacity}</div><div className="flex items-center text-blue-600 font-semibold">View Lineup <ChevronRight size={14} /></div>
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
                      <span className="font-bold text-gray-800 block truncate" title={crew.name}>{crew.name}</span>
                      <span className="text-xs text-gray-500 block truncate">{crew.competency}</span>
                    </div>
                    <button onClick={() => setAssignCrewData(crew)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-600 hover:text-white transition flex items-center"><UserPlus size={12} className="mr-1"/> Assign</button>
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
    const onboard = crews.filter(c => c.shipId === selectedShipId && c.status === 'onboard');
    const months = Array.from({length: 4}).map((_,i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i); return d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
    });

    return (
      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{ship.name} - Crew Lineup</h2>
              <div className="text-sm text-gray-500 mt-1 flex gap-4">
                <span>Safe Manning: <strong className={onboard.length < ship.minSafeManning ? 'text-red-500' : ''}>{onboard.length}/{ship.minSafeManning}</strong></span>
                <span>Cabin Cap: <strong className={onboard.length > ship.cabinCapacity ? 'text-red-500' : ''}>{onboard.length}/{ship.cabinCapacity}</strong></span>
              </div>
            </div>
            <button onClick={() => setSelectedShipId(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={24} /></button>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            <div className="flex border-b pb-2 mb-4 sticky top-0 bg-white z-10 text-sm font-bold text-gray-600">
              <div className="w-1/4">Personnel Info</div>
              <div className="w-3/4 flex">
                <div className="w-1/4 border-l pl-2 text-center text-blue-600">{months[0]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[1]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[2]}</div>
                <div className="w-1/4 border-l pl-2 text-center">{months[3]}</div>
              </div>
            </div>
            <div className="space-y-4">
              {onboard.map(crew => {
                const daysRemaining = calculateDaysRemaining(crew.contractEnd);
                const colorClass = getContractColor(daysRemaining);
                let barWidth = daysRemaining < 0 ? 0 : Math.min((daysRemaining / 120) * 100, 100);

                return (
                  <div key={crew.id} className="flex items-center text-sm border-b border-gray-100 pb-3 hover:bg-gray-50 p-2 rounded group relative">
                    <div className="w-1/4 flex justify-between items-center pr-2">
                      <div><div className="font-bold text-gray-800 truncate" title={crew.name}>{crew.name}</div><div className="text-gray-500 text-xs flex gap-1"><span className="font-semibold text-gray-800">{crew.rank}</span> <span className="truncate" title={crew.competency}>({crew.competency})</span></div></div>
                      <button onClick={() => setSignOffCrewData(crew)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-100 p-1.5 rounded transition-all" title="Sign-off from vessel"><LogOut size={16} /></button>
                    </div>
                    <div className="w-3/4 flex flex-col relative h-8 justify-center bg-gray-100 rounded">
                      <div className="absolute left-0 top-0 h-full border-r border-dashed border-gray-300 w-1/4"></div><div className="absolute left-1/4 top-0 h-full border-r border-dashed border-gray-300 w-1/4"></div><div className="absolute left-2/4 top-0 h-full border-r border-dashed border-gray-300 w-1/4"></div>
                      {daysRemaining < 0 ? (
                        <div className="relative z-10 pl-2 text-red-600 font-bold flex items-center"><AlertTriangle size={14} className="mr-1"/> Expired ({Math.abs(daysRemaining)} days)</div>
                      ) : (
                        <div className="relative z-10 w-full px-1">
                          <div className={`h-4 rounded-full ${colorClass} transition-all`} style={{ width: `${barWidth}%` }}></div>
                          <div className="text-[10px] mt-1 font-semibold text-gray-600 text-right pr-2" style={{ width: `${barWidth}%` }}>{getStatusText(daysRemaining)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {onboard.length === 0 && <div className="text-center text-gray-500 py-8">No personnel onboard.</div>}
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

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-gray-200 text-gray-900 overflow-hidden">
      <header className="bg-slate-900 text-white p-4 shadow-md z-10 flex justify-between items-center">
        <div className="flex items-center"><Anchor className="mr-3" size={28} /><h1 className="text-xl font-bold tracking-wider">CREW MASTER PRO</h1></div>
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-2">
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center px-4 py-2 rounded transition-colors ${activeTab === 'dashboard' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18} className="mr-2" /> Dashboard</button>
            <button onClick={() => setActiveTab('admin')} className={`flex items-center px-4 py-2 rounded transition-colors ${activeTab === 'admin' ? 'bg-slate-700 font-bold' : 'hover:bg-slate-800'}`}><Settings size={18} className="mr-2" /> Settings</button>
          </nav>
          <div className="h-6 w-px bg-slate-600 mx-2"></div>
          <div className="flex items-center">
            <span className="mr-3 text-sm text-slate-300 hidden md:block">Hi, <strong>{appUser?.username}</strong></span>
            <button onClick={() => setAppUser(null)} className="text-red-400 hover:text-red-300 hover:bg-slate-800 p-2 rounded flex items-center transition" title="Secure Logout"><LogOut size={20} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'dashboard' ? <Dashboard /> : <AdminPanel />}
        <ShipDetailsModal />
        <ShipFormModal />
        <CrewFormModal />
        <AssignCrewModal />
        <OverrideModal />
        <HandoverModal />
        <SignOffModal />
        <SystemUserFormModal />
      </main>
    </div>
  );
}