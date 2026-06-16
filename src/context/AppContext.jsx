import React, { createContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('eh_user_role') || 'public';
  });

  const [chapels, setChapels] = useState([]);
  const [servers, setServers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync userRole to localStorage
  useEffect(() => {
    localStorage.setItem('eh_user_role', userRole);
  }, [userRole]);

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
      setSchedules(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
    };
  }, []);

  // Auth Operations
  const loginAsAdmin = (password) => {
    if (password === 'admin123') {
      setUserRole('admin');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setUserRole('public');
  };

  // --- Servers Actions ---
  const addServer = async (server) => {
    const id = 's_' + Date.now();
    const newServer = {
      ...server,
      id,
      joinedDate: new Date().toISOString().split('T')[0],
      color: server.color || ['#3b82f6', '#ec4899', '#eab308', '#10b981', '#8b5cf6', '#f97316', '#14b8a6', '#6366f1'][Math.floor(Math.random() * 8)]
    };
    try {
      await setDoc(doc(db, "servers", id), newServer);
    } catch (e) {
      console.error("Error adding server:", e);
    }
  };

  const updateServer = async (updatedServer) => {
    try {
      await setDoc(doc(db, "servers", updatedServer.id), updatedServer);
    } catch (e) {
      console.error("Error updating server:", e);
    }
  };

  const deleteServer = async (id) => {
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
    const newChapel = {
      ...chapel,
      id,
      massTimes: chapel.massTimes || []
    };
    try {
      await setDoc(doc(db, "chapels", id), newChapel);
    } catch (e) {
      console.error("Error adding chapel:", e);
    }
  };

  const updateChapel = async (updatedChapel) => {
    try {
      await setDoc(doc(db, "chapels", updatedChapel.id), updatedChapel);
    } catch (e) {
      console.error("Error updating chapel:", e);
    }
  };

  const deleteChapel = async (id) => {
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
    const newSchedule = {
      ...schedule,
      id,
      status: 'scheduled',
      published: false,
      reportSubmitted: false,
      code: String(Math.floor(1000 + Math.random() * 9000))
    };
    try {
      await setDoc(doc(db, "schedules", id), newSchedule);
    } catch (e) {
      console.error("Error adding schedule:", e);
    }
  };

  const updateSchedule = async (updatedSchedule) => {
    try {
      await setDoc(doc(db, "schedules", updatedSchedule.id), updatedSchedule);
    } catch (e) {
      console.error("Error updating schedule:", e);
    }
  };

  const deleteSchedule = async (id) => {
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

  // --- Attendance and Report Submission ---
  const submitAttendanceAndReport = async (scheduleId, attendanceRecords, reportData) => {
    try {
      const batch = writeBatch(db);

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
          ...record
        });
      });

      // 2. Add coordinator report
      const scheduleObj = schedules.find((sc) => sc.id === scheduleId);
      const date = scheduleObj ? scheduleObj.date : new Date().toISOString().split('T')[0];
      
      const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
      const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
      const justifiedCount = attendanceRecords.filter((r) => r.status === 'justified').length;
      const attendanceSummary = `${presentCount} presente(s), ${absentCount} falta(s), ${justifiedCount} justificada(s)`;

      const repId = 'rep_' + scheduleId;
      const newReport = {
        id: repId,
        scheduleId,
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

  const clearAllData = async () => {
    try {
      const batch = writeBatch(db);
      chapels.forEach((c) => batch.delete(doc(db, "chapels", c.id)));
      servers.forEach((s) => batch.delete(doc(db, "servers", s.id)));
      schedules.forEach((sc) => batch.delete(doc(db, "schedules", sc.id)));
      attendance.forEach((att) => batch.delete(doc(db, "attendance", att.id)));
      reports.forEach((rep) => batch.delete(doc(db, "reports", rep.id)));
      await batch.commit();
    } catch (e) {
      console.error("Error clearing all data:", e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        userRole,
        loginAsAdmin,
        logoutAdmin,
        chapels,
        servers,
        schedules,
        attendance,
        reports,
        addServer,
        updateServer,
        deleteServer,
        addChapel,
        updateChapel,
        deleteChapel,
        addSchedule,
        updateSchedule,
        deleteSchedule,
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
