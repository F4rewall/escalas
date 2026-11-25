import React, { createContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { getDefaultBotConfig } from '../utils/botHelpers';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('eh_user_role') || 'public';
  });

  const [adminSector, setAdminSector] = useState(() => {
    return localStorage.getItem('eh_admin_sector') || 'coroinhas';
  });

  const [chapels, setChapels] = useState([]);
  const [servers, setServers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reports, setReports] = useState([]);
  const [botConfigs, setBotConfigs] = useState({});
  const [botLogs, setBotLogs] = useState([]);
  const [botStatus, setBotStatus] = useState({ connected: false });
  const [systemRequests, setSystemRequests] = useState([]);
  const [parishRequests, setParishRequests] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [pendingEditServerId, setPendingEditServerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync userRole & adminSector to localStorage
  useEffect(() => {
    localStorage.setItem('eh_user_role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('eh_admin_sector', adminSector);
  }, [adminSector]);

  // Realtime synchronization from Firestore
  useEffect(() => {
    let loadedCount = 0;
    const checkLoading = () => {
      loadedCount++;
      if (loadedCount >= 5) {
        setLoading(false);
      }
    };

    const unsubChapels = onSnapshot(collection(db, "chapels"), (snapshot) => {
      const chapelsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      chapelsList.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setChapels(chapelsList);
      checkLoading();
    }, (err) => {
      console.error("Error loading chapels:", err);
      checkLoading();
    });

    const unsubServers = onSnapshot(collection(db, "servers"), (snapshot) => {
      const serversList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      serversList.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setServers(serversList);
      checkLoading();
    }, (err) => {
      console.error("Error loading servers:", err);
      checkLoading();
    });

    const unsubSchedules = onSnapshot(collection(db, "schedules"), (snapshot) => {
      let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      try {
        const cachedUpcoming = JSON.parse(localStorage.getItem('eh_schedule_order_upcoming') || 'null');
        if (Array.isArray(cachedUpcoming)) {
          const map = new Map(cachedUpcoming.map((id, idx) => [id, idx]));
          list = list.map(sc => map.has(sc.id) && typeof sc.order !== 'number' ? { ...sc, order: map.get(sc.id) } : sc);
        }
      } catch (err) {
        // ignore
      }
      setSchedules(list);
      checkLoading();
    }, (err) => {
      console.error("Error loading schedules:", err);
      checkLoading();
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      checkLoading();
    }, (err) => {
      console.error("Error loading attendance:", err);
      checkLoading();
    });

    const unsubReports = onSnapshot(collection(db, "reports"), (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      checkLoading();
    }, (err) => {
      console.error("Error loading reports:", err);
      checkLoading();
    });

    const unsubBotConfigs = onSnapshot(collection(db, "bot_configs"), (snapshot) => {
      const cfgMap = {};
      snapshot.docs.forEach((d) => {
        cfgMap[d.id] = { id: d.id, ...d.data() };
      });
      setBotConfigs(cfgMap);
      if (!cfgMap.global) {
        setDoc(doc(db, "bot_configs", "global"), {
          ...getDefaultBotConfig('global'),
          enabled: true,
          proactiveRemindersEnabled: true,
          initializedAt: new Date().toISOString()
        }).catch(() => {});
      }
    }, (err) => {
      console.error("Error loading bot_configs:", err);
    });

    const unsubBotLogs = onSnapshot(collection(db, "bot_logs"), (snapshot) => {
      const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setBotLogs(logs.slice(0, 100));
    }, (err) => {
      console.error("Error loading bot_logs:", err);
    });

    const unsubBotStatus = onSnapshot(doc(db, "bot_status", "main"), (snapshot) => {
      if (snapshot.exists()) {
        setBotStatus(snapshot.data());
      } else {
        setBotStatus({ connected: false });
      }
    }, (err) => {
      console.error("Error loading bot_status:", err);
    });

    const unsubSystemRequests = onSnapshot(collection(db, "system_requests"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setSystemRequests(list);
    }, (err) => {
      console.error("Error loading system_requests:", err);
    });

    const unsubParishRequests = onSnapshot(collection(db, "parish_requests"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setParishRequests(list);
    }, (err) => {
      console.error("Error loading parish_requests:", err);
    });

    const unsubSwapRequests = onSnapshot(collection(db, "swap_requests"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setSwapRequests(list);
    }, (err) => {
      console.error("Error loading swap_requests:", err);
    });

    // Clean up local storage caches once migrated
    localStorage.removeItem('eh_chapels');
    localStorage.removeItem('eh_servers');
    localStorage.removeItem('eh_schedules');
    localStorage.removeItem('eh_attendance');
    localStorage.removeItem('eh_reports');

    return () => {
      unsubChapels();
      unsubServers();
      unsubSchedules();
      unsubAttendance();
      unsubReports();
      unsubBotConfigs();
      unsubBotLogs();
      unsubBotStatus();
      unsubSystemRequests();
      unsubParishRequests();
      unsubSwapRequests();
    };
  }, []);

  // Auth Operations
  const loginAsAdmin = (password) => {
    const cleanPass = (password || '').trim();
    if (cleanPass === 'admin123') {
      setUserRole('admin');
      setAdminSector('coroinhas');
      return 'coroinhas';
    }
    if (cleanPass === 'musica123') {
      setUserRole('admin');
      setAdminSector('musica');
      return 'musica';
    }
    if (cleanPass === 'liturgia123') {
      setUserRole('admin');
      setAdminSector('liturgia');
      return 'liturgia';
    }
    if (cleanPass === 'mece123' || cleanPass === 'mesce123') {
      setUserRole('admin');
      setAdminSector('mece');
      return 'mece';
    }
    if (cleanPass === 'chat1234') {
      setUserRole('chat');
      setAdminSector('chat');
      return 'chat';
    }
    return false;
  };

  const logoutAdmin = () => {
    setUserRole('public');
    setAdminSector('coroinhas');
  };

  // Helper to strip undefined fields before saving to Firestore
  const sanitizeForFirestore = (obj) => {
    const clean = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        clean[key] = obj[key];
      }
    });
    return clean;
  };

  // --- Servers Actions ---
  const addServer = async (server) => {
    const id = 's_' + Date.now();
    const newServer = sanitizeForFirestore({
      ...server,
      id,
      sector: server.sector || adminSector || 'coroinhas',
      joinedDate: new Date().toISOString().split('T')[0],
      color: server.color || ['#3b82f6', '#ec4899', '#eab308', '#10b981', '#8b5cf6', '#f97316', '#14b8a6', '#6366f1'][Math.floor(Math.random() * 8)]
    });
    setServers((prev) => [...prev.filter(s => s.id !== id), newServer].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    try {
      await setDoc(doc(db, "servers", id), newServer);
    } catch (e) {
      console.error("Error adding server:", e);
    }
  };

  const updateServer = async (updatedServer) => {
    const cleanServer = sanitizeForFirestore({
      ...updatedServer,
      sector: updatedServer.sector || adminSector || 'coroinhas',
      color: updatedServer.color || '#3b82f6'
    });
    setServers((prev) => prev.map(s => s.id === cleanServer.id ? cleanServer : s).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    try {
      await setDoc(doc(db, "servers", cleanServer.id), cleanServer);
    } catch (e) {
      console.error("Error updating server:", e);
    }
  };

  const deleteServer = async (id) => {
    setServers((prev) => prev.filter(s => s.id !== id));
    try {
      // 1. Delete server document
      await deleteDoc(doc(db, "servers", id));
      
      // 2. Cleanup in schedules
      const batch = writeBatch(db);
      schedules.forEach((sc) => {
        let changed = false;
        let serverIds = sc.serverIds || [];
        let ceremonialistIds = sc.ceremonialistIds || [];
        let mainCeremonialistId = sc.mainCeremonialistId;

        if (serverIds.includes(id)) {
          serverIds = serverIds.filter(sid => sid !== id);
          changed = true;
        }
        if (ceremonialistIds.includes(id)) {
          ceremonialistIds = ceremonialistIds.filter(sid => sid !== id);
          changed = true;
        }
        if (mainCeremonialistId === id) {
          mainCeremonialistId = '';
          changed = true;
        }

        if (changed) {
          batch.update(doc(db, "schedules", sc.id), {
            serverIds,
            ceremonialistIds,
            mainCeremonialistId
          });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error deleting server:", e);
    }
  };

  // --- Chapels Actions ---
  const addChapel = async (chapel) => {
    const id = 'c_' + Date.now();
    const newChapel = sanitizeForFirestore({
      ...chapel,
      id,
      massTimes: chapel.massTimes || []
    });
    setChapels((prev) => [...prev.filter(c => c.id !== id), newChapel].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    try {
      await setDoc(doc(db, "chapels", id), newChapel);
    } catch (e) {
      console.error("Error adding chapel:", e);
    }
  };

  const updateChapel = async (updatedChapel) => {
    const cleanChapel = sanitizeForFirestore(updatedChapel);
    setChapels((prev) => prev.map(c => c.id === cleanChapel.id ? cleanChapel : c).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    try {
      await setDoc(doc(db, "chapels", cleanChapel.id), cleanChapel);
    } catch (e) {
      console.error("Error updating chapel:", e);
    }
  };

  const deleteChapel = async (id) => {
    setChapels((prev) => prev.filter(c => c.id !== id));
    try {
      // 1. Delete chapel
      await deleteDoc(doc(db, "chapels", id));
      
      // 2. Remove schedules for this chapel
      const batch = writeBatch(db);
      schedules.forEach((sc) => {
        if (sc.chapelId === id) {
          batch.delete(doc(db, "schedules", sc.id));
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error deleting chapel:", e);
    }
  };

  // --- Schedules Actions ---
  const addSchedule = async (schedule) => {
    const id = 'sc_' + Date.now();
    const newSchedule = sanitizeForFirestore({
      ...schedule,
      id,
      sector: schedule.sector || adminSector || 'coroinhas',
      serverIds: schedule.serverIds || [],
      ceremonialistIds: schedule.ceremonialistIds || [],
      mainCeremonialistId: schedule.mainCeremonialistId || '',
      observation: schedule.observation || '',
      status: 'scheduled',
      published: false,
      reportSubmitted: false,
      code: String(Math.floor(1000 + Math.random() * 9000))
    });
    setSchedules((prev) => [...prev.filter(sc => sc.id !== id), newSchedule]);
    try {
      await setDoc(doc(db, "schedules", id), newSchedule);
    } catch (e) {
      console.error("Error adding schedule:", e);
    }
  };

  const updateSchedule = async (updatedSchedule) => {
    const cleanSchedule = sanitizeForFirestore({
      ...updatedSchedule,
      sector: updatedSchedule.sector || adminSector || 'coroinhas',
      serverIds: updatedSchedule.serverIds || [],
      ceremonialistIds: updatedSchedule.ceremonialistIds || [],
      mainCeremonialistId: updatedSchedule.mainCeremonialistId || ''
    });
    setSchedules((prev) => prev.map(sc => sc.id === cleanSchedule.id ? cleanSchedule : sc));
    try {
      await setDoc(doc(db, "schedules", cleanSchedule.id), cleanSchedule);
    } catch (e) {
      console.error("Error updating schedule:", e);
    }
  };

  const deleteSchedule = async (id) => {
    setSchedules((prev) => prev.filter(sc => sc.id !== id));
    try {
      // 1. Delete schedule
      await deleteDoc(doc(db, "schedules", id));
      
      // 2. Cleanup attendance and reports associated with this schedule
      const batch = writeBatch(db);
      attendance.forEach((att) => {
        if (att.scheduleId === id) {
          batch.delete(doc(db, "attendance", att.id));
        }
      });
      reports.forEach((rep) => {
        if (rep.scheduleId === id) {
          batch.delete(doc(db, "reports", rep.id));
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error deleting schedule:", e);
    }
  };

  const updateSchedulesOrder = async (orderedIds, type = 'upcoming') => {
    if (userRole !== 'admin') return;
    const isUpcoming = type === 'upcoming';
    const orderField = isUpcoming ? 'order' : 'pastOrder';

    // 1. Instant local update
    setSchedules((prev) => {
      const orderMap = new Map();
      orderedIds.forEach((id, index) => {
        orderMap.set(id, index);
      });
      return prev.map((sc) => {
        if (orderMap.has(sc.id)) {
          return { ...sc, [orderField]: orderMap.get(sc.id) };
        }
        return sc;
      });
    });

    // 2. Persist to localStorage
    try {
      localStorage.setItem(`eh_schedule_order_${type}`, JSON.stringify(orderedIds));
    } catch (e) {
      console.warn("Error saving order to localStorage:", e);
    }

    // 3. Batch update in Firestore
    try {
      const batch = writeBatch(db);
      orderedIds.forEach((id, index) => {
        const docRef = doc(db, "schedules", id);
        batch.update(docRef, { [orderField]: index });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error updating schedules order in Firestore:", e);
    }
  };

  const resetSchedulesOrder = async (type = 'upcoming', targetSector = adminSector) => {
    if (userRole !== 'admin') return;
    const isUpcoming = type === 'upcoming';
    const orderField = isUpcoming ? 'order' : 'pastOrder';

    try {
      localStorage.removeItem(`eh_schedule_order_${type}`);
    } catch (e) {
      console.warn(e);
    }

    const targetSchedules = schedules.filter((s) =>
      ((s.sector || 'coroinhas') === targetSector) &&
      (isUpcoming ? s.status === 'scheduled' : s.status === 'completed')
    );

    setSchedules((prev) =>
      prev.map((s) => {
        if (
          ((s.sector || 'coroinhas') === targetSector) &&
          ((isUpcoming && s.status === 'scheduled') || (!isUpcoming && s.status === 'completed'))
        ) {
          const copy = { ...s };
          delete copy[orderField];
          return copy;
        }
        return s;
      })
    );

    try {
      const batch = writeBatch(db);
      targetSchedules.forEach((sc) => {
        if (typeof sc[orderField] === 'number') {
          const docRef = doc(db, "schedules", sc.id);
          batch.update(docRef, { [orderField]: null });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error resetting schedules order in Firestore:", e);
    }
  };

  // --- Attendance and Report Submission ---
  const submitAttendanceAndReport = async (scheduleId, attendanceRecords, reportData) => {
    try {
      const batch = writeBatch(db);

      const scheduleObj = schedules.find((sc) => sc.id === scheduleId);
      const scheduleSector = scheduleObj?.sector || 'coroinhas';

      // 1. Save attendance records
      // First delete any existing attendance for this schedule to avoid duplicates
      attendance.forEach((att) => {
        if (att.scheduleId === scheduleId) {
          batch.delete(doc(db, "attendance", att.id));
        }
      });

      attendanceRecords.forEach((record) => {
        const attId = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        batch.set(doc(db, "attendance", attId), {
          id: attId,
          sector: scheduleSector,
          ...record
        });
      });

      // 2. Add coordinator report
      const date = scheduleObj ? scheduleObj.date : new Date().toISOString().split('T')[0];
      
      const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
      const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
      const justifiedCount = attendanceRecords.filter((r) => r.status === 'justified').length;
      const attendanceSummary = `${presentCount} presente(s), ${absentCount} falta(s), ${justifiedCount} justificada(s)`;

      const repId = 'rep_' + scheduleId;
      const newReport = {
        id: repId,
        scheduleId,
        sector: scheduleSector,
        date,
        attendanceSummary,
        coordinatorName: reportData.confirmacao || 'Coordenador',
        ...reportData
      };
      batch.set(doc(db, "reports", repId), newReport);

      // 3. Mark schedule as completed
      batch.update(doc(db, "schedules", scheduleId), {
        status: 'completed',
        coordinatorName: reportData.confirmacao || 'Coordenador',
        reportSubmitted: true
      });

      await batch.commit();
    } catch (e) {
      console.error("Error submitting attendance and report:", e);
    }
  };

  // Helper stats for servers
  const getServerStats = (serverId) => {
    const serverAttendance = attendance.filter((a) => a.serverId === serverId);
    const present = serverAttendance.filter((a) => a.status === 'present').length;
    const absent = serverAttendance.filter((a) => a.status === 'absent').length;
    const justified = serverAttendance.filter((a) => a.status === 'justified').length;
    const total = present + absent + justified;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, justified, total, rate };
  };

  const clearAllData = async (targetSector = adminSector) => {
    try {
      const batch = writeBatch(db);
      const sectorSchedules = schedules.filter((sc) => (sc.sector || 'coroinhas') === targetSector);
      const sectorScheduleIds = new Set(sectorSchedules.map((sc) => sc.id));

      servers
        .filter((s) => (s.sector || 'coroinhas') === targetSector)
        .forEach((s) => batch.delete(doc(db, "servers", s.id)));
      sectorSchedules.forEach((sc) => batch.delete(doc(db, "schedules", sc.id)));
      attendance
        .filter((att) => sectorScheduleIds.has(att.scheduleId) || (att.sector && att.sector === targetSector))
        .forEach((att) => batch.delete(doc(db, "attendance", att.id)));
      reports
        .filter((rep) => sectorScheduleIds.has(rep.scheduleId) || (rep.sector && rep.sector === targetSector))
        .forEach((rep) => batch.delete(doc(db, "reports", rep.id)));
      await batch.commit();
    } catch (e) {
      console.error("Error clearing sector data:", e);
    }
  };

  // --- Chatbot Actions ---
  const getBotConfig = (sectorId = adminSector) => {
    const targetSector = sectorId || adminSector || 'coroinhas';
    const defaults = getDefaultBotConfig(targetSector);
    const globalSaved = botConfigs.global || {};
    const sectorSaved = targetSector === 'global' || targetSector === 'chat' ? {} : (botConfigs[targetSector] || {});
    return { ...defaults, ...sectorSaved, ...globalSaved, sector: targetSector };
  };

  // --- System Requests / Incomplete Data Notifications ---
  const addSystemRequest = async ({ sector = adminSector, title, description = '', targetServerId = '' }) => {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const item = sanitizeForFirestore({
      id,
      sector: sector || 'geral',
      title: (title || '').trim(),
      description: (description || '').trim(),
      targetServerId,
      status: 'open',
      createdAt: new Date().toISOString()
    });
    setSystemRequests((prev) => [item, ...prev]);
    try {
      await setDoc(doc(db, "system_requests", id), item);
      return true;
    } catch (e) {
      console.error("Error adding system request:", e);
      return false;
    }
  };

  const resolveSystemRequest = async (id) => {
    const patch = { status: 'resolved', resolvedAt: new Date().toISOString() };
    setSystemRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await updateDoc(doc(db, "system_requests", id), patch);
    } catch (e) {
      console.error("Error resolving system request:", e);
    }
  };

  const deleteSystemRequest = async (id) => {
    setSystemRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteDoc(doc(db, "system_requests", id));
    } catch (e) {
      console.error("Error deleting system request:", e);
    }
  };

  // --- Parish Service Requests (Confession, Spiritual Direction, Baptism, Meetings, Tithing, Donations) ---
  const addParishRequest = async ({ type, requesterName, requesterPhone, preferredDate = '', details = '', source = 'web_chat' }) => {
    const id = 'par_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const item = sanitizeForFirestore({
      id,
      type,
      requesterName: (requesterName || '').trim(),
      requesterPhone: (requesterPhone || '').trim(),
      preferredDate: (preferredDate || '').trim(),
      details: (details || '').trim(),
      source,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setParishRequests((prev) => [item, ...prev]);
    try {
      await setDoc(doc(db, "parish_requests", id), item);
      return { ok: true, item };
    } catch (e) {
      console.error("Error adding parish request:", e);
      return { ok: false, error: e.message };
    }
  };

  const resolveParishRequest = async (id) => {
    const patch = { status: 'resolved', resolvedAt: new Date().toISOString() };
    setParishRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await updateDoc(doc(db, "parish_requests", id), patch);
    } catch (e) {
      console.error("Error resolving parish request:", e);
    }
  };

  const deleteParishRequest = async (id) => {
    setParishRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteDoc(doc(db, "parish_requests", id));
    } catch (e) {
      console.error("Error deleting parish request:", e);
    }
  };

  // --- Schedule Swap Request Creation (Anti-spam + WhatsApp broadcast once) ---
  const createSwapRequest = async ({ scheduleId, requesterId, reason }) => {
    const sc = schedules.find((s) => s.id === scheduleId);
    const requester = servers.find((s) => s.id === requesterId);
    if (!sc || !requester) {
      return { ok: false, error: 'Escala ou servidor não encontrado.' };
    }

    // Prevent duplicate open swap requests for the same person on the same schedule
    const existingOpen = swapRequests.find(
      (r) => r.scheduleId === scheduleId && r.requesterId === requesterId && r.status === 'open'
    );
    if (existingOpen) {
      return { ok: false, alreadyExists: true, swapRequest: existingOpen };
    }

    let roleType = 'coroinha';
    if (sc.mainCeremonialistId === requesterId) roleType = 'main_ceremonialist';
    else if ((sc.ceremonialistIds || []).includes(requesterId)) roleType = 'cerimonialist';

    const scSector = sc.sector || 'coroinhas';
    const chapel = chapels.find((c) => c.id === sc.chapelId);
    const swapCode = String(Math.floor(1000 + Math.random() * 9000));
    const swapId = 'sw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // Find eligible replacement candidates with phone, not already on this schedule
    const alreadyInSchedule = new Set([
      sc.mainCeremonialistId,
      ...(sc.ceremonialistIds || []),
      ...(sc.serverIds || [])
    ].filter(Boolean));

    const targetCategory = requester.category;
    const candidates = servers.filter((s) => {
      if (!s.active || s.id === requesterId) return false;
      if ((s.sector || 'coroinhas') !== scSector) return false;
      if (alreadyInSchedule.has(s.id)) return false;
      if ((s.phone || '').replace(/\D/g, '').length < 10) return false;
      // For cerimoniario / same category replacement
      return s.category === targetCategory;
    });

    const newSwap = sanitizeForFirestore({
      id: swapId,
      code: swapCode,
      scheduleId,
      sector: scSector,
      chapelName: chapel?.name || 'Capela',
      scheduleDate: sc.date || '',
      scheduleTime: sc.time || '',
      requesterId: requester.id,
      requesterName: requester.name,
      requesterPhone: requester.phone || '',
      requesterCategory: requester.category || '',
      roleType,
      reason: (reason || '').trim(),
      status: 'open',
      notifiedCandidateIds: candidates.map((c) => c.id),
      createdAt: new Date().toISOString()
    });

    try {
      await setDoc(doc(db, "swap_requests", swapId), newSwap);

      // Enqueue ONE WhatsApp message per eligible candidate (only if requester is cerimoniario or has candidates)
      for (const cand of candidates) {
        const msg =
          `Paz de Cristo, ${cand.name}! 🙏\n\n` +
          `${requester.name} solicitou uma troca na escala de ${chapel?.name || 'Capela'}:\n` +
          `📅 Data: ${sc.date ? sc.date.split('-').reverse().join('/') : ''}\n` +
          `⏰ Horário: ${sc.time || ''}\n` +
          `💬 Motivo: ${newSwap.reason}\n\n` +
          `Você teria disponibilidade para assumir este serviço?\n` +
          `Se puder servir, responda: ACEITAR ${swapCode}`;

        await queueBotMessage({
          sector: scSector,
          scheduleId,
          type: 'swap_offer',
          targetPhone: cand.phone,
          targetName: cand.name,
          message: msg,
          scheduleSummary: `Troca ${swapCode} • ${chapel?.name || 'Capela'}`
        });
      }

      return { ok: true, swapRequest: newSwap, notifiedCount: candidates.length };
    } catch (e) {
      console.error("Error creating swap request:", e);
      return { ok: false, error: e.message };
    }
  };

  // Atomic swap acceptance (usable from web UI too if needed)
  const acceptSwapRequest = async (swapId, acceptorId) => {
    const acceptor = servers.find((s) => s.id === acceptorId);
    if (!acceptor) return { ok: false, reason: 'not_found' };
    try {
      const result = await runTransaction(db, async (tx) => {
        const swapRef = doc(db, "swap_requests", swapId);
        const swapSnap = await tx.get(swapRef);
        if (!swapSnap.exists()) return { ok: false, reason: 'not_found' };
        const swapData = swapSnap.data();
        if (swapData.status !== 'open') {
          return { ok: false, reason: 'already_taken', swapData };
        }
        const schedRef = doc(db, "schedules", swapData.scheduleId);
        const schedSnap = await tx.get(schedRef);
        if (!schedSnap.exists()) return { ok: false, reason: 'schedule_missing' };
        const scData = schedSnap.data();

        const scPatch = {};
        if (scData.mainCeremonialistId === swapData.requesterId) {
          scPatch.mainCeremonialistId = acceptor.id;
        } else if ((scData.ceremonialistIds || []).includes(swapData.requesterId)) {
          scPatch.ceremonialistIds = scData.ceremonialistIds.map((id) =>
            id === swapData.requesterId ? acceptor.id : id
          );
        } else if ((scData.serverIds || []).includes(swapData.requesterId)) {
          scPatch.serverIds = scData.serverIds.map((id) =>
            id === swapData.requesterId ? acceptor.id : id
          );
        }
        scPatch.botSwapStatus = 'resolved';
        scPatch.botSwapReply = `Troca automática: ${swapData.requesterName} -> ${acceptor.name} (Motivo: ${swapData.reason})`;

        tx.update(schedRef, scPatch);
        tx.update(swapRef, {
          status: 'accepted',
          acceptedById: acceptor.id,
          acceptedByName: acceptor.name,
          acceptedByPhone: acceptor.phone || '',
          acceptedAt: new Date().toISOString()
        });
        return { ok: true, swapData };
      });
      return result;
    } catch (e) {
      console.error("Error accepting swap request:", e);
      return { ok: false, error: e.message };
    }
  };

  const saveBotConfig = async (sectorId, configData) => {
    const targetSector = sectorId || adminSector || 'coroinhas';
    const cleanConfig = sanitizeForFirestore({
      ...getDefaultBotConfig(targetSector),
      ...configData,
      sector: targetSector,
      updatedAt: new Date().toISOString()
    });
    setBotConfigs((prev) => ({
      ...prev,
      [targetSector]: { id: targetSector, ...cleanConfig }
    }));
    try {
      await setDoc(doc(db, "bot_configs", targetSector), cleanConfig);
      return true;
    } catch (e) {
      console.error("Error saving bot config:", e);
      return false;
    }
  };

  const queueBotMessage = async ({
    sector,
    scheduleId = '',
    type = 'manual', // 'swap_check' | 'report_code' | 'test' | 'manual'
    targetPhone,
    targetName,
    message,
    scheduleSummary = ''
  }) => {
    const outboxId = 'bot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const nowIso = new Date().toISOString();
    const targetSector = sector || adminSector || 'coroinhas';
    const cfg = getBotConfig(targetSector);

    const outboxItem = sanitizeForFirestore({
      id: outboxId,
      sector: targetSector,
      scheduleId,
      type,
      targetPhone,
      targetName,
      message,
      scheduleSummary,
      status: 'pending',
      createdAt: nowIso
    });

    // Optional external HTTP webhook dispatch in parallel if configured
    let webhookStatus = null;
    if (cfg.webhookUrl && cfg.webhookUrl.trim()) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (cfg.webhookToken && cfg.webhookToken.trim()) {
          headers['Authorization'] = `Bearer ${cfg.webhookToken.trim()}`;
        }
        const resp = await fetch(cfg.webhookUrl.trim(), {
          method: 'POST',
          headers,
          body: JSON.stringify(outboxItem)
        });
        webhookStatus = resp.ok ? 'webhook_sent' : `webhook_http_${resp.status}`;
      } catch (err) {
        console.warn('Webhook request failed:', err);
        webhookStatus = 'webhook_error';
      }
    }

    try {
      await setDoc(doc(db, "bot_outbox", outboxId), {
        ...outboxItem,
        ...(webhookStatus ? { webhookStatus } : {})
      });

      const logItem = sanitizeForFirestore({
        id: 'log_' + outboxId,
        sector: targetSector,
        scheduleId,
        type,
        direction: 'outbound',
        targetPhone,
        targetName,
        message,
        scheduleSummary,
        status: botStatus?.connected ? 'queued_for_bot' : (webhookStatus || 'waiting_bot_online'),
        createdAt: nowIso
      });
      await setDoc(doc(db, "bot_logs", logItem.id), logItem);

      if (scheduleId) {
        const patch = {};
        if (type === 'swap_check') {
          patch.botSwapCheckSentAt = nowIso;
          patch.botSwapStatus = 'waiting_reply';
        } else if (type === 'report_code') {
          patch.botCodeSentAt = nowIso;
        }
        if (Object.keys(patch).length > 0) {
          setSchedules((prev) =>
            prev.map((sc) => (sc.id === scheduleId ? { ...sc, ...patch } : sc))
          );
          await updateDoc(doc(db, "schedules", scheduleId), patch);
        }
      }
      return { ok: true, id: outboxId, webhookStatus };
    } catch (e) {
      console.error("Error queuing bot message:", e);
      return { ok: false, error: e.message };
    }
  };

  const resolveBotSwapAlert = async (scheduleId) => {
    try {
      const patch = { botSwapStatus: 'resolved' };
      setSchedules((prev) =>
        prev.map((sc) => (sc.id === scheduleId ? { ...sc, ...patch } : sc))
      );
      await updateDoc(doc(db, "schedules", scheduleId), patch);
    } catch (e) {
      console.error("Error resolving swap alert:", e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        userRole,
        adminSector,
        loginAsAdmin,
        logoutAdmin,
        chapels,
        servers,
        schedules,
        attendance,
        reports,
        botConfigs,
        botLogs,
        botStatus,
        systemRequests,
        parishRequests,
        swapRequests,
        pendingEditServerId,
        setPendingEditServerId,
        getBotConfig,
        saveBotConfig,
        queueBotMessage,
        resolveBotSwapAlert,
        addSystemRequest,
        resolveSystemRequest,
        deleteSystemRequest,
        addParishRequest,
        resolveParishRequest,
        deleteParishRequest,
        createSwapRequest,
        acceptSwapRequest,
        addServer,
        updateServer,
        deleteServer,
        addChapel,
        updateChapel,
        deleteChapel,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        updateSchedulesOrder,
        resetSchedulesOrder,
        submitAttendanceAndReport,
        getServerStats,
        clearAllData,
        loading
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
