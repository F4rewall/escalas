import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

// Seed data (emptied for a clean system)
const initialChapels = [];
const initialServers = [];
const initialSchedules = [];
const initialAttendance = [];
const initialReports = [];

export const AppProvider = ({ children }) => {
  // Wipe legacy seed data if present in localStorage to keep system completely clean
  useState(() => {
    const savedChapels = localStorage.getItem('eh_chapels');
    const savedServers = localStorage.getItem('eh_servers');
    let shouldClear = false;

    if (savedChapels) {
      try {
        const chapelsList = JSON.parse(savedChapels);
        const hasLegacy = chapelsList.some(c => c.id === 'c1' || c.id === 'c2' || c.id === 'c3' || c.id === 'c4');
        if (hasLegacy) shouldClear = true;
      } catch (e) {
        shouldClear = true;
      }
    }

    if (savedServers) {
      try {
        const serversList = JSON.parse(savedServers);
        const hasLegacy = serversList.some(s => s.id === 's1' || s.id === 's2' || s.id === 's3' || s.id === 's4' || s.id === 's5' || s.id === 's6' || s.id === 's7' || s.id === 's8');
        if (hasLegacy) shouldClear = true;
      } catch (e) {
        shouldClear = true;
      }
    }

    if (shouldClear) {
      localStorage.removeItem('eh_chapels');
      localStorage.removeItem('eh_servers');
      localStorage.removeItem('eh_schedules');
      localStorage.removeItem('eh_attendance');
      localStorage.removeItem('eh_reports');
    }
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('eh_user_role') || 'public'; // Defaults to public view for security
  });

  const [chapels, setChapels] = useState(() => {
    try {
      const saved = localStorage.getItem('eh_chapels');
      return saved ? JSON.parse(saved) : initialChapels;
    } catch (e) {
      return initialChapels;
    }
  });

  const [servers, setServers] = useState(() => {
    try {
      const saved = localStorage.getItem('eh_servers');
      return saved ? JSON.parse(saved) : initialServers;
    } catch (e) {
      return initialServers;
    }
  });

  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem('eh_schedules');
      const rawSchedules = saved ? JSON.parse(saved) : initialSchedules;
      
      // Migration: convert older schedules without mainCeremonialistId and code
      let migrated = false;
      const updated = rawSchedules.map(sc => {
        let changed = false;
        let main = sc.mainCeremonialistId;
        let remaining = sc.ceremonialistIds;
        let code = sc.code;

        if (sc.mainCeremonialistId === undefined) {
          changed = true;
          main = sc.ceremonialistIds && sc.ceremonialistIds.length > 0 ? sc.ceremonialistIds[0] : '';
          remaining = sc.ceremonialistIds && sc.ceremonialistIds.length > 1 ? sc.ceremonialistIds.slice(1) : [];
        }

        if (!sc.code) {
          changed = true;
          code = String(Math.floor(1000 + Math.random() * 9000));
        }

        if (changed) {
          migrated = true;
          return {
            ...sc,
            mainCeremonialistId: main,
            ceremonialistIds: remaining,
            code: code
          };
        }
        return sc;
      });
      
      if (migrated && saved) {
        localStorage.setItem('eh_schedules', JSON.stringify(updated));
      }
      return updated;
    } catch (e) {
      return initialSchedules;
    }
  });

  const [attendance, setAttendance] = useState(() => {
    try {
      const saved = localStorage.getItem('eh_attendance');
      return saved ? JSON.parse(saved) : initialAttendance;
    } catch (e) {
      return initialAttendance;
    }
  });

  const [reports, setReports] = useState(() => {
    try {
      const saved = localStorage.getItem('eh_reports');
      return saved ? JSON.parse(saved) : initialReports;
    } catch (e) {
      return initialReports;
    }
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('eh_user_role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('eh_chapels', JSON.stringify(chapels));
  }, [chapels]);

  useEffect(() => {
    localStorage.setItem('eh_servers', JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    localStorage.setItem('eh_schedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('eh_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('eh_reports', JSON.stringify(reports));
  }, [reports]);

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
  const addServer = (server) => {
    const newServer = {
      ...server,
      id: 's_' + Date.now(),
      joinedDate: new Date().toISOString().split('T')[0],
      color: server.color || ['#3b82f6', '#ec4899', '#eab308', '#10b981', '#8b5cf6', '#f97316', '#14b8a6', '#6366f1'][Math.floor(Math.random() * 8)]
    };
    setServers((prev) => [...prev, newServer]);
  };

  const updateServer = (updatedServer) => {
    setServers((prev) => prev.map((s) => (s.id === updatedServer.id ? updatedServer : s)));
  };

  const deleteServer = (id) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
    // Also cleanup in schedules
    setSchedules((prev) =>
      prev.map((sc) => ({
        ...sc,
        serverIds: sc.serverIds.filter((sid) => sid !== id),
        ceremonialistIds: sc.ceremonialistIds.filter((sid) => sid !== id),
        mainCeremonialistId: sc.mainCeremonialistId === id ? '' : sc.mainCeremonialistId
      }))
    );
  };

  // --- Chapels Actions ---
  const addChapel = (chapel) => {
    const newChapel = {
      ...chapel,
      id: 'c_' + Date.now(),
      massTimes: chapel.massTimes || []
    };
    setChapels((prev) => [...prev, newChapel]);
  };

  const updateChapel = (updatedChapel) => {
    setChapels((prev) => prev.map((c) => (c.id === updatedChapel.id ? updatedChapel : c)));
  };

  const deleteChapel = (id) => {
    setChapels((prev) => prev.filter((c) => c.id !== id));
    // Remove schedules for this chapel
    setSchedules((prev) => prev.filter((sc) => sc.chapelId !== id));
  };

  // --- Schedules Actions ---
  const addSchedule = (schedule) => {
    const newSchedule = {
      ...schedule,
      id: 'sc_' + Date.now(),
      status: 'scheduled',
      reportSubmitted: false,
      code: String(Math.floor(1000 + Math.random() * 9000))
    };
    setSchedules((prev) => [newSchedule, ...prev]);
  };

  const updateSchedule = (updatedSchedule) => {
    setSchedules((prev) => prev.map((sc) => (sc.id === updatedSchedule.id ? updatedSchedule : sc)));
  };

  const deleteSchedule = (id) => {
    setSchedules((prev) => prev.filter((sc) => sc.id !== id));
    setAttendance((prev) => prev.filter((att) => att.scheduleId !== id));
    setReports((prev) => prev.filter((rep) => rep.scheduleId !== id));
  };

  // --- Attendance and Report Submission ---
  const submitAttendanceAndReport = (scheduleId, attendanceRecords, reportData) => {
    // 1. Save attendance records
    setAttendance((prev) => {
      const filtered = prev.filter((att) => att.scheduleId !== scheduleId);
      return [...filtered, ...attendanceRecords];
    });

    // 2. Add coordinator report
    const scheduleObj = schedules.find((sc) => sc.id === scheduleId);
    const date = scheduleObj ? scheduleObj.date : new Date().toISOString().split('T')[0];
    
    const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
    const justifiedCount = attendanceRecords.filter((r) => r.status === 'justified').length;
    const attendanceSummary = `${presentCount} presente(s), ${absentCount} falta(s), ${justifiedCount} justificada(s)`;

    const newReport = {
      scheduleId,
      date,
      attendanceSummary,
      coordinatorName: reportData.confirmacao || 'Coordenador',
      ...reportData
    };

    setReports((prev) => {
      const filtered = prev.filter((rep) => rep.scheduleId !== scheduleId);
      return [newReport, ...filtered];
    });

    // 3. Mark schedule as completed
    setSchedules((prev) =>
      prev.map((sc) =>
        sc.id === scheduleId
          ? { ...sc, status: 'completed', coordinatorName: reportData.confirmacao || 'Coordenador', reportSubmitted: true }
          : sc
      )
    );
  };

  // Helper stats for servers
  const getServerStats = (serverId) => {
    const serverAttendance = attendance.filter((a) => a.serverId === serverId);
    const present = serverAttendance.filter((a) => a.status === 'present').length;
    const absent = serverAttendance.filter((a) => a.status === 'absent').length;
    const justified = serverAttendance.filter((a) => a.status === 'justified').length;
    const total = present + absent + justified;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    return { present, absent, justified, total, rate };
  };

  const clearAllData = () => {
    setChapels([]);
    setServers([]);
    setSchedules([]);
    setAttendance([]);
    setReports([]);
    localStorage.removeItem('eh_chapels');
    localStorage.removeItem('eh_servers');
    localStorage.removeItem('eh_schedules');
    localStorage.removeItem('eh_attendance');
    localStorage.removeItem('eh_reports');
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
        clearAllData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
