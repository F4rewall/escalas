import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';
import { 
  Plus, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  CalendarDays,
  FileCheck,
  Share2,
  Trash2,
  AlertTriangle,
  KeyRound,
  Edit3
} from 'lucide-react';

// Helper to get next N Saturdays (dayOfWeek = 6) or Sundays (dayOfWeek = 0)
const getUpcomingWeekendDates = (dayOfWeek, count = 6) => {
  const dates = [];
  const today = new Date();
  
  // Find the first occurrence of the dayOfWeek starting from today
  let current = new Date(today);
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }
  
  // Generate 'count' dates
  for (let i = 0; i < count; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return dates.map(d => d.toISOString().split('T')[0]);
};

// Helper to clean up weekday and leading terms from mass time string
const cleanTimeStr = (mt) => {
  return mt
    .replace(/Domingo|Segunda-feira|Segunda|Terça-feira|Terça|Terca|Quarta-feira|Quarta|Quinta-feira|Quinta|Sexta-feira|Sexta|Sábado|Sabado/gi, '')
    .replace(/^\s*[-–—:]\s*/g, '')
    .replace(/^\s*(as|às|de|o)\s+/gi, '')
    .trim();
};

const formatTime = (time) => {
  if (!time) return '';
  if (/^[0-9:]+$/.test(time)) return `${time}h`;
  return time;
};

// Helper to filter chapel mass times by selected date's day of week
const getMassTimesForDate = (chapel, dateStr) => {
  if (!chapel || !chapel.massTimes) return [];
  
  if (!dateStr) {
    return chapel.massTimes.map(cleanTimeStr);
  }
  
  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayIndex = dateObj.getDay();
  
  const dayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];
  const targetDayName = dayNames[dayIndex];
  
  const matchingTimes = chapel.massTimes
    .filter(mt => {
      const mtLower = mt.toLowerCase();
      const dayLower = targetDayName.toLowerCase();
      return mtLower.includes(dayLower) || 
             (dayLower === 'sábado' && mtLower.includes('sabado')) ||
             (dayLower === 'terça-feira' && mtLower.includes('terca'));
    })
    .map(cleanTimeStr);
    
  if (matchingTimes.length > 0) {
    return matchingTimes;
  }
  
  return chapel.massTimes.map(cleanTimeStr);
};

// Helper to translate weekday to Portuguese
const getDayNameInPortuguese = (dateStr) => {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayIndex = dateObj.getDay();
  const dayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];
  return dayNames[dayIndex] || '';
};

const getDayOnly = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts[2] || '';
};

const getMonthAbbr = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '';
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthIndex = parseInt(parts[1], 10) - 1;
  return months[monthIndex] || '';
};

// Helper to check if a date is in the future
const isDateInFuture = (dateStr) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateObj = new Date(dateStr + 'T00:00:00');
  return dateObj > today;
};

// Interactive Calendar Picker Component
const CalendarPicker = ({ selectedDate, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(() => {
    return selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  });
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const days = [];
  
  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({
      day: prevMonthTotalDays - i,
      month: month === 0 ? 11 : month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false
    });
  }
  
  // Current month
  for (let i = 1; i <= totalDays; i++) {
    days.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true
    });
  }
  
  // Next month padding
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      day: i,
      month: month === 11 ? 0 : month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false
    });
  }
  
  const formatDateString = (y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button type="button" onClick={handlePrevMonth} className="calendar-nav-btn">&lt;</button>
        <span className="calendar-month-title">{monthNames[month]} de {year}</span>
        <button type="button" onClick={handleNextMonth} className="calendar-nav-btn">&gt;</button>
      </div>
      
      <div className="calendar-weekdays-grid">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, i) => (
          <span key={i} className="calendar-weekday">{wd}</span>
        ))}
      </div>
      
      <div className="calendar-days-grid">
        {days.map((item, index) => {
          const dateStr = formatDateString(item.year, item.month, item.day);
          const itemDate = new Date(item.year, item.month, item.day);
          const isPast = itemDate < today;
          const isSelected = selectedDate === dateStr;
          const isWeekend = itemDate.getDay() === 0 || itemDate.getDay() === 6;
          
          let btnClass = 'calendar-day-btn';
          if (!item.isCurrentMonth) btnClass += ' other-month';
          if (isWeekend) btnClass += ' weekend';
          if (isSelected) btnClass += ' selected';
          
          return (
            <button
              key={index}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(dateStr)}
              className={btnClass}
            >
              {item.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function Schedules() {
  const { 
    userRole, 
    schedules, 
    chapels, 
    servers, 
    addSchedule, 
    updateSchedule,
    deleteSchedule, 
    submitAttendanceAndReport,
    attendance,
    reports
  } = useContext(AppContext);

  // States
  const [activeSubTab, setActiveSubTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState(null);
  
  // Create Schedule Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChapelId, setSelectedChapelId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedServerIds, setSelectedServerIds] = useState([]);
  const [selectedCeremonialistId, setSelectedCeremonialistId] = useState('');
  const [selectedAuxCeremonialistIds, setSelectedAuxCeremonialistIds] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleObservation, setScheduleObservation] = useState('');

  // Helper to auto-select the first available mass time
  const autoSelectTime = (chapelId, dateStr) => {
    if (!chapelId || !dateStr) {
      setScheduleTime('');
      return;
    }
    const chapelObj = chapels.find(c => c.id === chapelId);
    const times = getMassTimesForDate(chapelObj, dateStr);
    if (times.length > 0) {
      setScheduleTime(times[0]);
    } else {
      setScheduleTime('');
    }
  };

  // Auto-prefill the first upcoming weekend date when modal opens
  useEffect(() => {
    if (isCreateModalOpen && !editingSchedule) {
      const nextSat = getUpcomingWeekendDates(6, 1)[0];
      setScheduleDate(nextSat);
      const defaultChapelId = selectedChapelId || (chapels.length > 0 ? chapels[0].id : '');
      if (defaultChapelId) {
        autoSelectTime(defaultChapelId, nextSat);
      } else {
        setScheduleTime('');
      }
    }
  }, [isCreateModalOpen, selectedChapelId, chapels, editingSchedule]);

  // Share Modal States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedShareIds, setSelectedShareIds] = useState([]);

  // Code Verification Modal States
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');

  const handleVerifyCodeSubmit = (e) => {
    e.preventDefault();
    setVerificationError('');
    
    const matchingSchedule = schedules.find(
      sc => sc.code === verificationCode.trim() && sc.status === 'scheduled'
    );

    if (matchingSchedule) {
      if (isDateInFuture(matchingSchedule.date)) {
        setVerificationError('Esta celebração está agendada para o futuro e ainda não ocorreu. O relatório só poderá ser preenchido no dia.');
        return;
      }
      setIsCodeModalOpen(false);
      setVerificationCode('');
      openAttendanceModal(matchingSchedule);
    } else {
      const completedSchedule = schedules.find(
        sc => sc.code === verificationCode.trim() && sc.status === 'completed'
      );
      if (completedSchedule) {
        setVerificationError('Este relatório já foi enviado para esta celebração.');
      } else {
        setVerificationError('Código inválido ou celebração não encontrada.');
      }
    }
  };

  // Attendance Register Modal States
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState([]); // Array of { serverId, name, category, status: 'present'|'absent'|'justified', justification: '' }
  
  // Google Form Report States
  const [reportDataHorario, setReportDataHorario] = useState('');
  const [reportCerimoniario, setReportCerimoniario] = useState('');
  const [reportAusentes, setReportAusentes] = useState('');
  const [reportIntercorrencias, setReportIntercorrencias] = useState('');
  const [reportSituacaoObjetos, setReportSituacaoObjetos] = useState('');
  const [reportConferiuGuarda, setReportConferiuGuarda] = useState('Sim');
  const [reportAlgoMais, setReportAlgoMais] = useState('');
  const [reportVerificarOutras, setReportVerificarOutras] = useState('');
  const [reportConfirmacao, setReportConfirmacao] = useState('');

  // 1. Group/Filter schedules with safe sorting
  const upcomingSchedules = schedules
    .filter(s => s.status === 'scheduled' && (userRole === 'admin' || s.published !== false))
    .sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));

  const pastSchedules = schedules
    .filter(s => s.status === 'completed' && (userRole === 'admin' || s.published !== false))
    .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));

  const activeSchedules = activeSubTab === 'upcoming' ? upcomingSchedules : pastSchedules;

  // Helpers
  const getChapel = (id) => chapels.find(c => c.id === id) || { name: 'Capela Desconhecida', massTimes: [] };
  
  const getServer = (id) => servers.find(s => s.id === id) || { name: 'Desconhecido', category: 'coroinha' };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  // Handle open Create Schedule Modal
  const openCreateModal = () => {
    if (chapels.length === 0) {
      alert('Cadastre pelo menos uma capela antes de montar uma escala.');
      return;
    }
    setEditingSchedule(null);
    setSelectedChapelId(chapels[0].id);
    setScheduleDate('');
    setScheduleTime('');
    setSelectedServerIds([]);
    setSelectedCeremonialistId('');
    setSelectedAuxCeremonialistIds([]);
    setScheduleObservation('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setSelectedChapelId(schedule.chapelId);
    setScheduleDate(schedule.date);
    setScheduleTime(schedule.time);
    setSelectedServerIds(schedule.serverIds || []);
    setSelectedCeremonialistId(schedule.mainCeremonialistId || '');
    setSelectedAuxCeremonialistIds(schedule.ceremonialistIds || []);
    setScheduleObservation(schedule.observation || '');
    setIsCreateModalOpen(true);
  };

  // Add/Remove servers from selection
  const toggleServerSelect = (id, category) => {
    if (category === 'coroinha') {
      setSelectedServerIds(prev => 
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    } else if (category === 'cerimoniario') {
      setSelectedAuxCeremonialistIds(prev =>
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    }
  };

  const handleCreateScheduleSubmit = (e) => {
    e.preventDefault();
    if (!scheduleDate || !scheduleTime) {
      alert('Preencha a data e o horário.');
      return;
    }

    if (selectedServerIds.length === 0 && !selectedCeremonialistId && selectedAuxCeremonialistIds.length === 0) {
      alert('Selecione pelo menos um coroinha ou um cerimoniário.');
      return;
    }

    const scheduleData = {
      chapelId: selectedChapelId,
      date: scheduleDate,
      time: scheduleTime,
      serverIds: selectedServerIds,
      mainCeremonialistId: selectedCeremonialistId,
      ceremonialistIds: selectedAuxCeremonialistIds,
      observation: scheduleObservation
    };

    if (editingSchedule) {
      updateSchedule({
        ...editingSchedule,
        ...scheduleData
      });
    } else {
      addSchedule(scheduleData);
    }

    setIsCreateModalOpen(false);
  };

  // Helper to dynamically calculate absent string for Question 3
  const updateAusentesField = (updatedForm) => {
    const absentItems = updatedForm.filter(item => item.status !== 'present');
    if (absentItems.length === 0) {
      setReportAusentes('Ninguém faltou.');
    } else {
      const absentString = absentItems.map(item => {
        const statusLabel = item.status === 'absent' ? 'Falta' : 'Justificado';
        const justString = item.justification ? ` (${item.justification})` : '';
        return `${item.name} - ${statusLabel}${justString}`;
      }).join('\n');
      setReportAusentes(absentString);
    }
  };

  // Handle open Attendance Modal
  const openAttendanceModal = (schedule) => {
    setActiveScheduleId(schedule.id);
    
    // Build initial attendance list
    const combinedIds = [
      ...(schedule.mainCeremonialistId ? [schedule.mainCeremonialistId] : []),
      ...(schedule.ceremonialistIds || []),
      ...(schedule.serverIds || [])
    ];
    const initialList = combinedIds.map(id => {
      const s = getServer(id);
      return {
        serverId: id,
        name: s.name,
        category: s.category,
        status: 'present', // default
        justification: ''
      };
    });
    setAttendanceForm(initialList);
    
    // Pre-populate Google Form Questions
    const chapelObj = getChapel(schedule.chapelId);
    const dateFormatted = formatDate(schedule.date);
    
    // Q1: Data e horário
    setReportDataHorario(`${chapelObj.name} - ${dateFormatted} - ${formatTime(schedule.time)}`);
    
    // Q2: Cerimoniário principal
    const ceremonialistNames = [
      ...(schedule.mainCeremonialistId ? [getServer(schedule.mainCeremonialistId).name + ' (Principal)'] : []),
      ...(schedule.ceremonialistIds ? schedule.ceremonialistIds.map(id => getServer(id).name) : [])
    ].join(', ');
    setReportCerimoniario(ceremonialistNames || 'Nenhum');
    
    // Q3: Ausentes (Default: Ninguém faltou)
    setReportAusentes('Ninguém faltou.');
    
    // Q4, Q5, Q7, Q8
    setReportIntercorrencias('');
    setReportSituacaoObjetos('');
    setReportConferiuGuarda('Sim'); // Q6 Default
    setReportAlgoMais('');
    setReportVerificarOutras('');
    
    // Q9: Por ser verdade tudo acima escrito, confirmo em meu nome e data ( ex: Dalila, 14 de Abril de 2024)
    // Prefill name to help
    setReportConfirmacao('');
    
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceStatusChange = (index, status) => {
    setAttendanceForm(prev => {
      const copy = [...prev];
      copy[index].status = status;
      // Clear justification if present
      if (status === 'present') {
        copy[index].justification = '';
      }
      updateAusentesField(copy);
      return copy;
    });
  };

  const handleJustificationChange = (index, text) => {
    setAttendanceForm(prev => {
      const copy = [...prev];
      copy[index].justification = text;
      updateAusentesField(copy);
      return copy;
    });
  };

  const handleAttendanceSubmit = (e) => {
    e.preventDefault();
    if (!reportConfirmacao.trim()) {
      alert('Por favor, assine a confirmação no campo 9.');
      return;
    }

    // Prepare attendance records
    const attendanceRecords = attendanceForm.map(item => ({
      scheduleId: activeScheduleId,
      serverId: item.serverId,
      status: item.status,
      justification: item.status !== 'present' ? item.justification : ''
    }));

    const reportData = {
      dataHorario: reportDataHorario,
      cerimoniarioPrincipal: reportCerimoniario,
      ausentes: reportAusentes,
      intercorrencias: reportIntercorrencias,
      situacaoObjetos: reportSituacaoObjetos,
      conferiuGuarda: reportConferiuGuarda,
      algoMais: reportAlgoMais,
      verificarOutrasPastorais: reportVerificarOutras,
      confirmacao: reportConfirmacao
    };

    submitAttendanceAndReport(
      activeScheduleId,
      attendanceRecords,
      reportData
    );

    setIsAttendanceModalOpen(false);
    setActiveSubTab('past'); // redirect to completed view
  };

  // Get attendance status for past schedules
  const getPastServerAttendance = (scheduleId, serverId) => {
    const record = attendance.find(a => a.scheduleId === scheduleId && a.serverId === serverId);
    if (!record) return { label: 'Pendente', class: 'badge-scheduled', icon: null };
    
    switch (record.status) {
      case 'present': return { label: 'Presente', class: 'badge-present', icon: <CheckCircle size={12} /> };
      case 'absent': return { label: 'Faltou', class: 'badge-absent', icon: <XCircle size={12} /> };
      case 'justified': return { label: 'Justificado', class: 'badge-justified', icon: <AlertCircle size={12} /> };
      default: return { label: 'Pendente', class: 'badge-scheduled', icon: null };
    }
  };

  // Toggle share checkbox
  const handleToggleShareSelect = (id) => {
    setSelectedShareIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  // Toggle select all share schedules
  const handleToggleSelectAllShare = () => {
    if (selectedShareIds.length === upcomingSchedules.length) {
      setSelectedShareIds([]);
    } else {
      setSelectedShareIds(upcomingSchedules.map(sc => sc.id));
    }
  };

  // Print PDF Generator
  const handlePrintSchedules = () => {
    if (selectedShareIds.length === 0) {
      alert('Selecione pelo menos uma escala para compartilhar.');
      return;
    }

    const selectedSchedules = schedules.filter(sc => selectedShareIds.includes(sc.id));
    selectedSchedules.sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para gerar a visualização das escalas.');
      return;
    }

    const formattedPrintDate = (d) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const getDayName = (d) => {
      const dayIndex = new Date(d + 'T00:00:00').getDay();
      return ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dayIndex];
    };

    const getChapelName = (id) => {
      const c = chapels.find(ch => ch.id === id);
      return c ? c.name : 'Capela Desconhecida';
    };

    const getServerName = (id) => {
      const s = servers.find(sv => sv.id === id);
      return s ? s.name : 'Desconhecido';
    };

    let content = `
      <html>
        <head>
          <title>Escala de Altar - Paróquia de Santo Antônio</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
            
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              color: #0f172a;
              background-color: #f1f5f9;
              margin: 0;
              padding: 0;
            }
            
            .schedules-list {
              display: flex;
              flex-direction: column;
              gap: 40px;
              align-items: center;
              padding: 40px 20px;
            }
            
            .print-page {
              background-color: #ffffff;
              width: 100%;
              max-width: 800px;
              padding: 0.8cm;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
              box-sizing: border-box;
              border-radius: 16px;
              page-break-after: always;
              page-break-inside: avoid;
            }

            .print-page-content {
              border: 3px double #d97706;
              padding: 1.2cm 1.5cm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              min-height: 600px;
            }
            
            .header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 2px solid rgba(217, 119, 6, 0.15);
              padding-bottom: 15px;
            }
            
            .logo {
              margin: 0 0 10px 0;
            }
            
            .logo img {
              display: block;
              margin: 0 auto;
              height: 60px;
              width: auto;
            }
            
            .title {
              font-family: 'Cinzel', serif;
              font-size: 1.6rem;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 5px 0;
              letter-spacing: 0.05em;
              text-transform: uppercase;
            }
            
            .subtitle {
              font-size: 0.85rem;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              color: #d97706;
              margin: 0;
            }
            
            .schedule-item {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 20px;
              background-color: #f8fafc;
              page-break-inside: avoid;
            }
            
            .chapel-name {
              font-family: 'Cinzel', serif;
              font-size: 1.2rem;
              color: #b45309;
              margin: 0 0 10px 0;
              border-bottom: 1px solid rgba(217, 119, 6, 0.1);
              padding-bottom: 5px;
            }
            
            .meta-info {
              display: flex;
              gap: 25px;
              font-size: 0.9rem;
              font-weight: 700;
              color: #475569;
              margin-bottom: 15px;
            }
            
            .meta-info span {
              display: flex;
              align-items: center;
              gap: 5px;
            }
            
            .team-section {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            
            .team-row {
              display: flex;
              flex-direction: column;
              gap: 4px;
              line-height: 1.4;
              margin-bottom: 15px;
            }
            
            .role-label {
              font-weight: 800;
              color: #b45309;
              font-size: 1.1rem;
              border-bottom: 2px solid rgba(217, 119, 6, 0.15);
              padding-bottom: 3px;
              margin-bottom: 6px;
            }
            
            .role-values {
              color: #0f172a;
              font-weight: 600;
              padding-left: 5px;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 4px 20px;
            }

            .name-item {
              margin: 3px 0;
              font-size: 1.15rem;
              font-weight: 700;
              color: #0f172a;
            }

            .observation-box {
              background-color: #fffbeb;
              border-left: 5px solid #d97706;
              padding: 12px 15px;
              margin-bottom: 20px;
              border-radius: 0 4px 4px 0;
              font-size: 1.1rem;
              color: #78350f;
            }

            .observation-box strong {
              display: block;
              font-size: 0.95rem;
              margin-bottom: 5px;
              color: #b45309;
            }

            .observation-box p {
              margin: 0;
              font-weight: 600;
              line-height: 1.4;
            }
            
            .footer {
              text-align: center;
              margin-top: 50px;
              font-size: 0.75rem;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
              margin-top: auto;
            }
            
            @media print {
              @page {
                margin: 0;
                size: A4 portrait;
              }
              body {
                background-color: #fff;
                padding: 0;
                margin: 0;
              }
              .schedules-list {
                display: block !important;
                padding: 0;
                gap: 0;
                margin: 0;
              }
              .print-page {
                border: none !important;
                box-shadow: none;
                border-radius: 0;
                padding: 0.8cm;
                margin: 0;
                width: 100%;
                min-height: 100vh;
                page-break-after: always;
                page-break-inside: avoid;
                break-after: page;
                break-inside: avoid;
                box-sizing: border-box;
                display: block;
                background-color: #ffffff;
              }
              .print-page-content {
                border: 3px double #d97706 !important;
                min-height: calc(100vh - 1.6cm);
                padding: 1.2cm 1.5cm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-sizing: border-box;
              }
              .schedule-item {
                background-color: #fff !important;
                border: 1px solid #cbd5e1 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="schedules-list">
            ${selectedSchedules.map(sc => {
              const chapelName = getChapelName(sc.chapelId);
              const dateVal = formattedPrintDate(sc.date);
              const dayName = getDayName(sc.date);
              
              const ceremonialists = [];
              if (sc.mainCeremonialistId) {
                ceremonialists.push(getServerName(sc.mainCeremonialistId) + ' (Principal)');
              }
              if (sc.ceremonialistIds && sc.ceremonialistIds.length > 0) {
                sc.ceremonialistIds.forEach(id => {
                  ceremonialists.push(getServerName(id));
                });
              }
              
              const altarServers = sc.serverIds.map(id => getServerName(id));
              
              return `
                <div class="print-page">
                  <div class="print-page-content">
                    <div class="header">
                      <div class="logo">
                        <img src="/saint_anthony_icon.png" alt="Santo Antônio" />
                      </div>
                      <h1 class="title">Paróquia de Santo Antônio</h1>
                      <p class="subtitle">Escala dos Servidores do Altar</p>
                    </div>

                    <div class="schedule-item">
                      <h3 class="chapel-name">${chapelName}</h3>
                      <div class="meta-info">
                        <span>📅 ${dateVal} (${dayName})</span>
                        <span>⏰ ${formatTime(sc.time)}</span>
                      </div>
                      
                      ${sc.observation ? `
                        <div class="observation-box">
                          <strong>⚠️ AVISO PARA ESTA CELEBRAÇÃO:</strong>
                          <p>${sc.observation}</p>
                        </div>
                      ` : ''}

                      <div class="team-section">
                        ${ceremonialists.length > 0 ? `
                          <div class="team-row">
                            <div class="role-label">Cerimoniários:</div>
                            <div class="role-values">
                              ${ceremonialists.map(name => `<div class="name-item">• ${name}</div>`).join('')}
                            </div>
                          </div>
                        ` : ''}
                        ${altarServers.length > 0 ? `
                          <div class="team-row">
                            <div class="role-label">Coroinhas:</div>
                            <div class="role-values">
                              ${altarServers.map(name => `<div class="name-item">• ${name}</div>`).join('')}
                            </div>
                          </div>
                        ` : ''}
                        ${ceremonialists.length === 0 && altarServers.length === 0 ? `
                          <div class="team-row">
                            <div class="role-values" style="font-style: italic; color: #94a3b8; font-size: 1.1rem;">Nenhum servidor escalado.</div>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <div class="footer">
                      Zelo pela Liturgia • Serviço do Altar
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Escalas de Altar</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Acompanhe ou organize a distribuição dos servidores nas missas.
          </p>
        </div>
        
        {userRole === 'admin' ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setIsShareModalOpen(true)}>
              <Share2 size={16} /> Compartilhar Escalas
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Montar Escala
            </button>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={() => setIsCodeModalOpen(true)}>
            <FileCheck size={16} /> Enviar Relatório (Código)
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.subTabs}>
        <button 
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'upcoming' ? styles.subTabBtnActive : {})
          }}
          onClick={() => setActiveSubTab('upcoming')}
        >
          Próximas Escalas ({upcomingSchedules.length})
        </button>
        <button 
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'past' ? styles.subTabBtnActive : {})
          }}
          onClick={() => setActiveSubTab('past')}
        >
          Escalas Realizadas ({pastSchedules.length})
        </button>
      </div>

      {/* Main Schedule Display Grid */}
      {activeSchedules.length === 0 ? (
        <div className="glass-panel" style={styles.emptyContainer}>
          <CalendarDays size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3>Nenhuma escala encontrada</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            {activeSubTab === 'upcoming' 
              ? 'Não existem missas futuras escaladas.' 
              : 'Não há registros de missas concluídas.'}
          </p>
        </div>
      ) : (
        <div className="grid-cards">
          {activeSchedules.map(sc => {
            const chapel = getChapel(sc.chapelId);
            return (
              <div 
                key={sc.id} 
                className="app-schedule-card" 
                onClick={() => setSelectedDetailSchedule(sc)}
              >
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span className={`badge ${sc.status === 'completed' ? 'badge-present' : 'badge-scheduled'}`}>
                      {sc.status === 'completed' ? 'Concluída' : 'Agendada'}
                    </span>
                    {userRole === 'admin' && sc.published === false && (
                      <span className="badge badge-justified">Rascunho</span>
                    )}
                  </div>
                  
                  {userRole === 'admin' && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {sc.published === false && (
                        <button 
                          style={styles.editBtn} 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(sc);
                          }}
                          title="Editar Escala"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      <button 
                        style={styles.deleteBtn} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Tem certeza que deseja excluir esta escala? Isso apagará também os relatórios associados.')) {
                            deleteSchedule(sc.id);
                          }
                        }}
                        title="Excluir Escala"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="schedule-card-main-highlight">
                  {/* Highlighted Date Badge */}
                  <div className="schedule-date-badge-wrapper">
                    <span className="schedule-date-day">{getDayOnly(sc.date)}</span>
                    <span className="schedule-date-month">{getMonthAbbr(sc.date)}</span>
                    <span className="schedule-date-weekday">
                      {getDayNameInPortuguese(sc.date).substring(0, 3)}
                    </span>
                  </div>

                  {/* Main Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="schedule-card-chapel-title">{chapel.name}</h3>
                    <div className="schedule-card-time-highlight">
                      <Clock size={14} />
                      <span>{formatTime(sc.time)} • {getDayNameInPortuguese(sc.date)}</span>
                    </div>
                    {sc.observation && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        borderLeft: '3px solid var(--primary-gold)',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: 'var(--gold-light)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.35rem',
                        lineHeight: '1.3'
                      }}>
                        <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <span><strong>Aviso:</strong> {sc.observation}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={styles.cardInfo}>
                  <div style={styles.infoRow}>
                    <MapPin size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{chapel.address}</span>
                  </div>
                  {userRole === 'admin' && sc.status === 'scheduled' && (
                    <div style={styles.infoRow}>
                      <KeyRound size={14} style={{ color: 'var(--primary-gold)' }} />
                      <span style={{ color: 'var(--color-text-primary)' }}>Código Relatório: <strong style={{ color: 'var(--primary-gold)' }}>{sc.code}</strong></span>
                    </div>
                  )}
                </div>

                <hr style={styles.divider} />

                {/* Servers Assigned */}
                <div style={styles.serversSection}>
                  <h4 style={styles.serversSectionTitle}>Equipe Escalada</h4>
                  
                  {/* Ceremonialist Principal */}
                  {sc.mainCeremonialistId && (() => {
                    const server = getServer(sc.mainCeremonialistId);
                    const attendanceStatus = sc.status === 'completed' ? getPastServerAttendance(sc.id, sc.mainCeremonialistId) : null;
                    return (
                      <div key={sc.mainCeremonialistId} style={styles.serverRow}>
                        <div style={styles.serverDetails}>
                          <span style={styles.serverCategoryBadge('cerimoniario')}>CP</span>
                          <span style={styles.serverName}><strong>{server.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)' }}>(Principal)</span></span>
                        </div>
                        {attendanceStatus && (
                          <span className={`badge ${attendanceStatus.class}`} style={styles.statusBadgeInline}>
                            {attendanceStatus.icon} {attendanceStatus.label}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Ceremonialists (Cerimoniários) */}
                  {sc.ceremonialistIds && sc.ceremonialistIds.map(id => {
                    const server = getServer(id);
                    const attendanceStatus = sc.status === 'completed' ? getPastServerAttendance(sc.id, id) : null;
                    return (
                      <div key={id} style={styles.serverRow}>
                        <div style={styles.serverDetails}>
                          <span style={styles.serverCategoryBadge(server.category)}>C</span>
                          <span style={styles.serverName}>{server.name}</span>
                        </div>
                        {attendanceStatus && (
                          <span className={`badge ${attendanceStatus.class}`} style={styles.statusBadgeInline}>
                            {attendanceStatus.icon} {attendanceStatus.label}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Altar Servers (Coroinhas) */}
                  {sc.serverIds.map(id => {
                    const server = getServer(id);
                    const attendanceStatus = sc.status === 'completed' ? getPastServerAttendance(sc.id, id) : null;
                    return (
                      <div key={id} style={styles.serverRow}>
                        <div style={styles.serverDetails}>
                          <span style={styles.serverCategoryBadge(server.category)}>Co</span>
                          <span style={styles.serverName}>{server.name}</span>
                        </div>
                        {attendanceStatus && (
                          <span className={`badge ${attendanceStatus.class}`} style={styles.statusBadgeInline}>
                            {attendanceStatus.icon} {attendanceStatus.label}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {!sc.mainCeremonialistId && sc.serverIds.length === 0 && sc.ceremonialistIds.length === 0 && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      Nenhum servidor escalado.
                    </div>
                  )}
                </div>

                {/* Coordinator summary for completed scales */}
                {sc.status === 'completed' && sc.coordinatorName && (
                  <div style={styles.pastReportInfo}>
                    <span style={styles.reportCoordinator}>Por: {sc.coordinatorName}</span>
                  </div>
                )}

                {/* Admin Quick Actions */}
                {userRole === 'admin' && sc.status === 'scheduled' && (
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {sc.published === false && (
                      <button 
                        className="btn btn-primary animate-pulse-slow" 
                        style={{
                          flex: '1 1 140px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          backgroundColor: 'var(--primary-gold)',
                          color: '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                        onClick={() => {
                          if (confirm('Deseja publicar esta escala para que fique visível ao público?')) {
                            updateSchedule({ ...sc, published: true });
                          }
                        }}
                      >
                        <CheckCircle size={14} /> Confirmar e Publicar
                      </button>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      style={{
                        flex: '1 1 140px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        border: '1px solid var(--border-color)',
                        ...(isDateInFuture(sc.date) ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                      }}
                      disabled={isDateInFuture(sc.date)}
                      onClick={() => openAttendanceModal(sc)}
                      title={isDateInFuture(sc.date) ? "O relatório só pode ser preenchido no dia da celebração" : "Fazer Chamada / Relatório"}
                    >
                      <FileCheck size={14} /> Chamada / Relatório
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE SCHEDULE */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title={editingSchedule ? "Editar Escala" : "Montar Nova Escala"}
      >
        <form onSubmit={handleCreateScheduleSubmit}>
          <div className="form-group">
            <label>Capela / Comunidade</label>
            <select 
              className="form-control"
              value={selectedChapelId}
              onChange={(e) => {
                const chapelId = e.target.value;
                setSelectedChapelId(chapelId);
                autoSelectTime(chapelId, scheduleDate);
              }}
            >
              {chapels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Calendar Picker component */}
          <div className="form-group">
            <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: '600' }}>Selecione o Dia no Calendário</label>
            <CalendarPicker
              selectedDate={scheduleDate}
              onSelectDate={(dateStr) => {
                setScheduleDate(dateStr);
                autoSelectTime(selectedChapelId, dateStr);
              }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data Selecionada</label>
              <input
                type="text"
                className="form-control"
                value={scheduleDate ? `${formatDate(scheduleDate)} (${getDayNameInPortuguese(scheduleDate)})` : 'Nenhuma data selecionada'}
                disabled
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--color-text-secondary)' }}
              />
            </div>
            <div className="form-group">
              <label>Horário</label>
              <select
                className="form-control"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {getMassTimesForDate(getChapel(selectedChapelId), scheduleDate).map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
                <option value="Manual">Outro horário...</option>
              </select>
            </div>
          </div>

          {/* If manual schedule time input */}
          {scheduleTime === 'Manual' && (
            <div className="form-group">
              <label>Digite o Horário Personalizado (ex: Quarta 19:30)</label>
              <input 
                type="text" 
                placeholder="Ex: Quarta-feira 19:00" 
                className="form-control"
                onChange={(e) => setScheduleTime(e.target.value)}
                required
              />
            </div>
          )}

          {/* Select Ceremonialist Dropdown */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Cerimoniário Principal (Coordenador do Altar)</label>
            <select
              className="form-control"
              value={selectedCeremonialistId}
              onChange={(e) => setSelectedCeremonialistId(e.target.value)}
            >
              <option value="">Selecione o Cerimoniário Principal...</option>
              {servers
                .filter(s => s.active && s.category === 'cerimoniario')
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
            {servers.filter(s => s.active && s.category === 'cerimoniario').length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Nenhum cerimoniário ativo cadastrado.
              </span>
            )}
          </div>

          {/* Select Auxiliary Ceremonialists Chips */}
          <div style={styles.modalSelectorSection}>
            <h4 style={styles.selectorSectionTitle}>Selecionar Outros Cerimoniários (Auxiliares)</h4>
            <div style={styles.selectChipsContainer}>
              {servers
                .filter(s => s.active && s.category === 'cerimoniario' && s.id !== selectedCeremonialistId)
                .map(s => {
                  const isSelected = selectedAuxCeremonialistIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleServerSelect(s.id, 'cerimoniario')}
                      style={{
                        ...styles.selectChip,
                        ...(isSelected ? styles.selectChipCerimonialistActive : {})
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              {servers.filter(s => s.active && s.category === 'cerimoniario' && s.id !== selectedCeremonialistId).length === 0 && (
                <p style={styles.noServersMsg}>Nenhum outro cerimoniário ativo cadastrado.</p>
              )}
            </div>
          </div>

          {/* Select Coroinhas Chips */}
          <div style={styles.modalSelectorSection}>
            <h4 style={styles.selectorSectionTitle}>Selecionar Coroinhas</h4>
            <div style={styles.selectChipsContainer}>
              {servers
                .filter(s => s.active && s.category === 'coroinha')
                .map(s => {
                  const isSelected = selectedServerIds.includes(s.id);
                  
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleServerSelect(s.id, 'coroinha')}
                      style={{
                        ...styles.selectChip,
                        ...(isSelected ? styles.selectChipCoroinhaActive : {})
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              {servers.filter(s => s.active && s.category === 'coroinha').length === 0 && (
                <p style={styles.noServersMsg}>Nenhum coroinha ativo cadastrado.</p>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Aviso / Observação para esta Celebração (Opcional)</label>
            <textarea
              className="form-control"
              placeholder="Ex: Missa com Crisma, Trazer túnica festiva, etc."
              value={scheduleObservation}
              onChange={(e) => setScheduleObservation(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={styles.formActions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editingSchedule ? "Salvar Alterações" : "Salvar Escala"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTER ATTENDANCE */}
      <Modal 
        isOpen={isAttendanceModalOpen} 
        onClose={() => setIsAttendanceModalOpen(false)} 
        title="Chamada e Relatório de Missa"
      >
        <form onSubmit={handleAttendanceSubmit}>
          <div style={styles.attendanceWarning}>
            <AlertTriangle size={16} />
            <span>Registre quem participou da celebração. Faltas sem justificativa impactam o relatório de desempenho dos servidores.</span>
          </div>

          <div style={styles.attendanceListContainer}>
            <h4 style={{...styles.selectorSectionTitle, marginBottom: '0.75rem'}}>Lista de Presença</h4>
            {attendanceForm.map((item, index) => (
              <div key={item.serverId} className="attendance-form-row">
                <div className="attendance-form-name-col">
                  <span style={styles.serverCategoryBadge(item.category)}>
                    {item.category === 'cerimoniario' ? 'C' : 'Co'}
                  </span>
                  <span style={{ fontWeight: '500' }}>{item.name}</span>
                </div>

                <div className="attendance-buttons">
                  <button
                    type="button"
                    style={{
                      ...styles.attStatusBtn,
                      ...(item.status === 'present' ? styles.attStatusBtnPresent : {})
                    }}
                    onClick={() => handleAttendanceStatusChange(index, 'present')}
                  >
                    Pres.
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.attStatusBtn,
                      ...(item.status === 'absent' ? styles.attStatusBtnAbsent : {})
                    }}
                    onClick={() => handleAttendanceStatusChange(index, 'absent')}
                  >
                    Faltou
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.attStatusBtn,
                      ...(item.status === 'justified' ? styles.attStatusBtnJustified : {})
                    }}
                    onClick={() => handleAttendanceStatusChange(index, 'justified')}
                  >
                    Justif.
                  </button>
                </div>

                {/* Justification Text field if not Present */}
                {item.status !== 'present' && (
                  <div style={styles.justificationInputWrapper}>
                    <input
                      type="text"
                      placeholder="Motivo / Justificativa..."
                      className="form-control"
                      style={styles.justificationInput}
                      value={item.justification}
                      onChange={(e) => handleJustificationChange(index, e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          <h4 style={{...styles.selectorSectionTitle, marginBottom: '1.25rem', color: 'var(--primary-gold)'}}>
            Perguntas do Relatório Oficial
          </h4>

          {/* Q1: Data e Horário */}
          <div className="form-group">
            <label>1. Data e horário da celebração</label>
            <input 
              type="text" 
              className="form-control"
              value={reportDataHorario}
              onChange={(e) => setReportDataHorario(e.target.value)}
              required
            />
          </div>

          {/* Q2: Cerimoniário Principal */}
          <div className="form-group">
            <label>2. Cerimoniário principal</label>
            <input 
              type="text" 
              className="form-control"
              value={reportCerimoniario}
              onChange={(e) => setReportCerimoniario(e.target.value)}
              required
            />
          </div>

          {/* Q3: Ausentes */}
          <div className="form-group">
            <label>3. Ausentes (Gerado automaticamente da chamada acima)</label>
            <textarea 
              rows="3" 
              className="form-control"
              value={reportAusentes}
              onChange={(e) => setReportAusentes(e.target.value)}
              placeholder="Ex: Pedro Silva - Falta (Motivo)..."
            ></textarea>
          </div>

          {/* Q4: Intercorrências */}
          <div className="form-group">
            <label>4. Intercorrências (Ocorrências ou incidentes durante a celebração)</label>
            <textarea 
              rows="2" 
              className="form-control"
              value={reportIntercorrencias}
              onChange={(e) => setReportIntercorrencias(e.target.value)}
              placeholder="Descreva se ocorreu algum imprevisto litúrgico..."
            ></textarea>
          </div>

          {/* Q5: Objetos Litúrgicos */}
          <div className="form-group">
            <label>5. Situação dos objetos litúrgicos (velas, carvão, incenso, turíbulo)</label>
            <textarea 
              rows="2" 
              className="form-control"
              value={reportSituacaoObjetos}
              onChange={(e) => setReportSituacaoObjetos(e.target.value)}
              placeholder="Descreva o estado, limpeza ou necessidade de reposição de itens..."
            ></textarea>
          </div>

          {/* Q6: Conferiu Guarda */}
          <div className="form-group">
            <label>6. Conferiu a guarda de todos os objetos litúrgicos?</label>
            <select
              className="form-control"
              value={reportConferiuGuarda}
              onChange={(e) => setReportConferiuGuarda(e.target.value)}
              required
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
              <option value="Talvez">Talvez</option>
            </select>
          </div>

          {/* Q7: Algo mais a relatar */}
          <div className="form-group">
            <label>7. Algo mais a relatar?</label>
            <textarea 
              rows="2" 
              className="form-control"
              value={reportAlgoMais}
              onChange={(e) => setReportAlgoMais(e.target.value)}
              placeholder="Insira observações gerais sobre o andamento..."
            ></textarea>
          </div>

          {/* Q8: Outras Pastorais */}
          <div className="form-group">
            <label>8. Algo que precisamos verificar com outras pastorais ou pessoas?</label>
            <textarea 
              rows="2" 
              className="form-control"
              value={reportVerificarOutras}
              onChange={(e) => setReportVerificarOutras(e.target.value)}
              placeholder="Ex: Falar com os músicos sobre o som, zeladoria sobre limpeza..."
            ></textarea>
          </div>

          {/* Q9: Assinatura Confirmação */}
          <div className="form-group">
            <label>9. Por ser verdade tudo acima escrito, confirmo em meu nome e data (ex: Dalila, 14 de Abril de 2024)</label>
            <input 
              type="text" 
              placeholder="Digite seu nome completo e a data de hoje para assinar" 
              className="form-control"
              value={reportConfirmacao}
              onChange={(e) => setReportConfirmacao(e.target.value)}
              required
            />
          </div>

          <div style={styles.formActions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsAttendanceModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Concluir e Salvar Relatório
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DETAIL SCHEDULE */}
      <Modal
        isOpen={selectedDetailSchedule !== null}
        onClose={() => setSelectedDetailSchedule(null)}
        title="Detalhes da Escala"
      >
        {selectedDetailSchedule && (() => {
          const chapel = getChapel(selectedDetailSchedule.chapelId);
          const report = reports.find(r => r.scheduleId === selectedDetailSchedule.id);
          
          return (
            <div>
              <div style={styles.modalDetailHeader}>
                <h3 style={styles.modalDetailChapel}>{chapel.name}</h3>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  {selectedDetailSchedule.published === false && (
                    <span className="badge badge-justified">Rascunho</span>
                  )}
                  <span className={`badge ${selectedDetailSchedule.status === 'completed' ? 'badge-present' : 'badge-scheduled'}`}>
                    {selectedDetailSchedule.status === 'completed' ? 'Concluída' : 'Agendada'}
                  </span>
                </div>
              </div>
              
              <div className="modal-detail-meta-grid">
                <div style={styles.modalDetailMetaItem}>
                  <CalendarDays size={16} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <span style={styles.modalDetailMetaLabel}>Data</span>
                    <span style={styles.modalDetailMetaVal}>{formatDate(selectedDetailSchedule.date)}</span>
                  </div>
                </div>
                <div style={styles.modalDetailMetaItem}>
                  <Clock size={16} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <span style={styles.modalDetailMetaLabel}>Horário</span>
                    <span style={styles.modalDetailMetaVal}>{formatTime(selectedDetailSchedule.time)}</span>
                  </div>
                </div>
              </div>

              {selectedDetailSchedule.observation && (
                <div style={{
                  ...styles.modalDetailSection,
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  borderLeft: '4px solid var(--primary-gold)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0 8px 8px 0',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{ ...styles.modalDetailSectionTitle, color: 'var(--primary-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <AlertTriangle size={16} /> Aviso / Observação da Celebração
                  </h4>
                  <p style={{ ...styles.modalDetailText, marginTop: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.95rem', fontWeight: '500' }}>
                    {selectedDetailSchedule.observation}
                  </p>
                </div>
              )}

              <div style={styles.modalDetailSection}>
                <h4 style={styles.modalDetailSectionTitle}>Local</h4>
                <p style={styles.modalDetailText}><strong>Endereço:</strong> {chapel.address}</p>
                {chapel.description && <p style={{...styles.modalDetailText, marginTop: '0.25rem'}}><strong>Sobre:</strong> {chapel.description}</p>}
              </div>

              {userRole === 'admin' && selectedDetailSchedule.status === 'scheduled' && (
                <div style={{
                  marginBottom: '1.5rem',
                  backgroundColor: 'rgba(217, 119, 6, 0.05)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{...styles.modalDetailText, margin: 0, color: 'var(--color-text-primary)'}}>
                    🔑 <strong>Código do Relatório (Passar ao Principal):</strong> <strong style={{ color: 'var(--primary-gold)', fontSize: '1.2rem', letterSpacing: '0.05em' }}>{selectedDetailSchedule.code}</strong>
                  </p>
                </div>
              )}

              <div style={styles.modalDetailSection}>
                <h4 style={styles.modalDetailSectionTitle}>Equipe Escalada</h4>
                <div style={styles.detailServersList}>
                  {/* Ceremonialist Principal */}
                  {selectedDetailSchedule.mainCeremonialistId && (() => {
                    const server = getServer(selectedDetailSchedule.mainCeremonialistId);
                    const attRecord = selectedDetailSchedule.status === 'completed' ? attendance.find(a => a.scheduleId === selectedDetailSchedule.id && a.serverId === selectedDetailSchedule.mainCeremonialistId) : null;
                    return (
                      <div key={selectedDetailSchedule.mainCeremonialistId} style={styles.detailServerCard}>
                        <div style={styles.detailServerInfo}>
                          <span style={styles.serverCategoryBadge('cerimoniario')}>CP</span>
                          <div>
                            <span style={styles.detailServerName}><strong>{server.name}</strong></span>
                            <span style={styles.detailServerSub}>Cerimoniário Principal • {server.phone || 'Sem telefone'}</span>
                          </div>
                        </div>
                        {attRecord && (
                          <span className={`badge ${attRecord.status === 'present' ? 'badge-present' : attRecord.status === 'absent' ? 'badge-absent' : 'badge-justified'}`}>
                            {attRecord.status === 'present' ? 'Presente' : attRecord.status === 'absent' ? 'Faltou' : 'Justificado'}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Ceremonialists */}
                  {selectedDetailSchedule.ceremonialistIds && selectedDetailSchedule.ceremonialistIds.map(id => {
                    const server = getServer(id);
                    const attRecord = selectedDetailSchedule.status === 'completed' ? attendance.find(a => a.scheduleId === selectedDetailSchedule.id && a.serverId === id) : null;
                    return (
                      <div key={id} style={styles.detailServerCard}>
                        <div style={styles.detailServerInfo}>
                          <span style={styles.serverCategoryBadge(server.category)}>C</span>
                          <div>
                            <span style={styles.detailServerName}>{server.name}</span>
                            <span style={styles.detailServerSub}>Cerimoniário • {server.phone || 'Sem telefone'}</span>
                          </div>
                        </div>
                        {attRecord && (
                          <span className={`badge ${attRecord.status === 'present' ? 'badge-present' : attRecord.status === 'absent' ? 'badge-absent' : 'badge-justified'}`}>
                            {attRecord.status === 'present' ? 'Presente' : attRecord.status === 'absent' ? 'Faltou' : 'Justificado'}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Altar Servers */}
                  {selectedDetailSchedule.serverIds.map(id => {
                    const server = getServer(id);
                    const attRecord = selectedDetailSchedule.status === 'completed' ? attendance.find(a => a.scheduleId === selectedDetailSchedule.id && a.serverId === id) : null;
                    return (
                      <div key={id} style={styles.detailServerCard}>
                        <div style={styles.detailServerInfo}>
                          <span style={styles.serverCategoryBadge(server.category)}>Co</span>
                          <div>
                            <span style={styles.detailServerName}>{server.name}</span>
                            <span style={styles.detailServerSub}>Coroinha • {server.phone || 'Sem telefone'}</span>
                          </div>
                        </div>
                        {attRecord && (
                          <span className={`badge ${attRecord.status === 'present' ? 'badge-present' : attRecord.status === 'absent' ? 'badge-absent' : 'badge-justified'}`}>
                            {attRecord.status === 'present' ? 'Presente' : attRecord.status === 'absent' ? 'Faltou' : 'Justificado'}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {!selectedDetailSchedule.mainCeremonialistId && selectedDetailSchedule.serverIds.length === 0 && selectedDetailSchedule.ceremonialistIds.length === 0 && (
                    <p style={styles.noServersMsg}>Nenhum servidor escalado.</p>
                  )}
                </div>
              </div>

              {/* Justifications if any */}
              {selectedDetailSchedule.status === 'completed' && (() => {
                const combinedIds = [...selectedDetailSchedule.serverIds, ...selectedDetailSchedule.ceremonialistIds];
                const justifiedRecords = attendance.filter(a => a.scheduleId === selectedDetailSchedule.id && combinedIds.includes(a.serverId) && a.status === 'justified' && a.justification);
                if (justifiedRecords.length > 0) {
                  return (
                    <div style={styles.modalDetailSection}>
                      <h4 style={styles.modalDetailSectionTitle}>Justificativas de Ausência</h4>
                      <div style={styles.justificationsList}>
                        {justifiedRecords.map(rec => {
                          const s = getServer(rec.serverId);
                          return (
                            <div key={rec.serverId} style={styles.justificationCard}>
                              <strong>{s.name}:</strong> "{rec.justification}"
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Celebration Report (Coordinators) */}
              {selectedDetailSchedule.status === 'completed' && (
                <div style={styles.modalDetailSection}>
                  <h4 style={styles.modalDetailSectionTitle}>Relatório da Celebração</h4>
                  {report ? (
                    userRole === 'admin' ? (
                      /* Admin: Show full 9 questions */
                      <div style={styles.fullReportGrid}>
                        <div style={styles.fullReportItem}>
                          <strong>1. Data e Horário:</strong>
                          <p>{report.dataHorario || '-'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>2. Cerimoniário Principal:</strong>
                          <p>{report.cerimoniarioPrincipal || '-'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>3. Ausentes:</strong>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{report.ausentes || '-'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>4. Intercorrências:</strong>
                          <p>{report.intercorrencias || 'Nenhuma'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>5. Situação dos Objetos:</strong>
                          <p>{report.situacaoObjetos || '-'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>6. Conferiu a Guarda:</strong>
                          <p>{report.conferiuGuarda || '-'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>7. Algo mais a relatar?</strong>
                          <p>{report.algoMais || 'Nada'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>8. Outras Pastorais:</strong>
                          <p>{report.verificarOutrasPastorais || 'Nada'}</p>
                        </div>
                        <div style={styles.fullReportItem}>
                          <strong>9. Confirmação (Assinatura):</strong>
                          <p>✍️ {report.confirmacao || report.coordinatorName}</p>
                        </div>
                      </div>
                    ) : (
                      /* Public: Show beautiful summary */
                      <div style={styles.publicReportSummary}>
                        <p style={styles.modalDetailText}><strong>Responsável:</strong> {report.confirmacao || report.coordinatorName || '-'}</p>
                        <p style={styles.modalDetailText}><strong>Frequência:</strong> {report.attendanceSummary || '-'}</p>
                        {report.intercorrencias && <p style={styles.modalDetailText}><strong>Observações Gerais:</strong> {report.intercorrencias}</p>}
                      </div>
                    )
                  ) : (
                    <p style={{...styles.modalDetailText, fontStyle: 'italic'}}>Nenhum relatório oficial registrado para esta escala.</p>
                  )}
                </div>
              )}

              {userRole === 'admin' && selectedDetailSchedule.published === false && selectedDetailSchedule.status === 'scheduled' && (
                <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                  <button 
                    type="button"
                    className="btn btn-primary animate-pulse-slow"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    onClick={() => {
                      if (confirm('Deseja publicar esta escala para que fique visível ao público?')) {
                        updateSchedule({ ...selectedDetailSchedule, published: true });
                        setSelectedDetailSchedule(prev => ({ ...prev, published: true }));
                      }
                    }}
                  >
                    <CheckCircle size={16} /> Confirmar e Publicar Escala
                  </button>
                </div>
              )}

              <div style={styles.modalDetailActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedDetailSchedule(null)} style={{width: '100%'}}>
                  Fechar Detalhes
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL: SHARE SCHEDULES */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setSelectedShareIds([]);
        }}
        title="Compartilhar Escalas (PDF / Imprimir)"
      >
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Selecione as escalas que deseja incluir no documento de compartilhamento. O sistema gerará um arquivo formatado pronto para imprimir ou salvar como PDF.
          </p>

          {upcomingSchedules.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1rem 0' }}>
              Não há escalas futuras agendadas para compartilhar.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                  {selectedShareIds.length} de {upcomingSchedules.length} selecionadas
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={handleToggleSelectAllShare}
                >
                  {selectedShareIds.length === upcomingSchedules.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', paddingRight: '0.25rem' }}>
                {upcomingSchedules.map(sc => {
                  const chapel = getChapel(sc.chapelId);
                  const isChecked = selectedShareIds.includes(sc.id);
                  return (
                    <label 
                      key={sc.id} 
                      className={`share-select-row ${isChecked ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'rgba(217, 119, 6, 0.05)' : 'rgba(0,0,0,0.15)',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => handleToggleShareSelect(sc.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--primary-gold)',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                          {chapel.name}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                          📅 {formatDate(sc.date)} • ⏰ {formatTime(sc.time)} {sc.published === false ? '• (Rascunho)' : ''}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div style={styles.formActions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setIsShareModalOpen(false);
                setSelectedShareIds([]);
              }}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              disabled={selectedShareIds.length === 0}
              onClick={handlePrintSchedules}
              style={selectedShareIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <Share2 size={16} /> Gerar PDF / Imprimir
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: ENTER REPORT CODE */}
      <Modal
        isOpen={isCodeModalOpen}
        onClose={() => {
          setIsCodeModalOpen(false);
          setVerificationCode('');
          setVerificationError('');
        }}
        title="Enviar Relatório (Por Código)"
      >
        <form onSubmit={handleVerifyCodeSubmit}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Digite o código de 4 dígitos da celebração para abrir a chamada e preencher o relatório da missa. Esse código é fornecido pela coordenação.
          </p>
          
          <div className="form-group">
            <label>Código da Missa</label>
            <input
              type="text"
              placeholder="Ex: 4582"
              className="form-control"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              autoFocus
            />
          </div>

          {verificationError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-absent)',
              backgroundColor: 'var(--color-absent-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              textAlign: 'left',
              marginBottom: '1rem'
            }}>
              <span>⚠️ {verificationError}</span>
            </div>
          )}

          <div style={styles.formActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCodeModalOpen(false);
                setVerificationCode('');
                setVerificationError('');
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Acessar Relatório
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const styles = {
  subTabs: {
    display: 'flex',
    gap: '1rem',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '2rem',
    paddingBottom: '0.25rem',
  },
  subTabBtn: {
    background: 'none',
    border: 'none',
    padding: '0.75rem 1rem',
    color: 'var(--color-text-secondary)',
    fontWeight: '600',
    fontSize: '0.95rem',
    cursor: 'pointer',
    position: 'relative',
    transition: 'color var(--transition-fast)',
  },
  subTabBtnActive: {
    color: 'var(--primary-gold)',
    borderBottom: '3px solid var(--primary-gold)',
    marginBottom: '-3px',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
  },
  scheduleCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    color: 'var(--color-text-primary)',
    marginBottom: '0.75rem',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  divider: {
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    margin: '1rem 0',
  },
  serversSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  serversSectionTitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  },
  serverRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    padding: '0.25rem 0',
  },
  serverDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  serverCategoryBadge: (cat) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '700',
    backgroundColor: cat === 'cerimoniario' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(139, 92, 246, 0.15)',
    color: cat === 'cerimoniario' ? '#fde047' : '#a78bfa',
    border: cat === 'cerimoniario' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
  }),
  serverName: {
    color: 'var(--color-text-primary)',
  },
  statusBadgeInline: {
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  pastReportInfo: {
    marginTop: '1rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(0,0,0,0.1)',
    textAlign: 'right',
  },
  reportCoordinator: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
  },
  cardActionBtn: {
    marginTop: '1.25rem',
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.85rem',
  },
  cardActionBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
  },
  modalSelectorSection: {
    marginTop: '1.25rem',
  },
  selectorSectionTitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.5rem',
    fontWeight: '600',
  },
  selectChipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  selectChip: {
    padding: '0.4rem 0.75rem',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    background: 'rgba(0,0,0,0.2)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  selectChipCoroinhaActive: {
    background: 'var(--coroinha-color)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)',
  },
  noServersMsg: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
  },
  attendanceWarning: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    border: '1px solid rgba(217, 119, 6, 0.2)',
    color: 'var(--gold-light)',
    fontSize: '0.8rem',
    lineHeight: '1.4',
    marginBottom: '1.5rem',
  },
  attendanceListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  attendanceFormRow: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1.5fr',
    gap: '1rem',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  attendanceFormNameCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  attendanceButtons: {
    display: 'flex',
    gap: '0.25rem',
    justifyContent: 'flex-end',
  },
  attStatusBtn: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.2)',
    color: 'var(--color-text-secondary)',
    padding: '0.35rem 0.65rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all var(--transition-fast)',
  },
  attStatusBtnPresent: {
    backgroundColor: 'var(--color-present-bg)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    color: 'var(--color-present)',
  },
  attStatusBtnAbsent: {
    backgroundColor: 'var(--color-absent-bg)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    color: 'var(--color-absent)',
  },
  attStatusBtnJustified: {
    backgroundColor: 'var(--color-justified-bg)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    color: 'var(--color-justified)',
  },
  justificationInputWrapper: {
    gridColumn: '1 / span 2',
    marginTop: '0.25rem',
  },
  justificationInput: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.85rem',
  },
  modalDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.75rem',
  },
  modalDetailChapel: {
    fontSize: '1.4rem',
    color: 'var(--primary-gold)',
    margin: 0,
  },
  modalDetailMetaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '1.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
  },
  modalDetailMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  modalDetailMetaLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalDetailMetaVal: {
    display: 'block',
    fontSize: '0.95rem',
    color: 'var(--color-text-primary)',
    fontWeight: '600',
  },
  modalDetailSection: {
    marginBottom: '1.5rem',
  },
  modalDetailSectionTitle: {
    fontSize: '0.9rem',
    color: 'var(--primary-gold)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '0.25rem',
  },
  modalDetailText: {
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.5',
  },
  detailServersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  detailServerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
  },
  detailServerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  detailServerName: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
  },
  detailServerSub: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.1rem',
  },
  justificationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  justificationCard: {
    padding: '0.75rem',
    borderRadius: '6px',
    backgroundColor: 'var(--color-justified-bg)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.4',
  },
  fullReportGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    fontSize: '0.85rem',
  },
  fullReportItem: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '0.5rem',
  },
  publicReportSummary: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  modalDetailActions: {
    marginTop: '2rem',
  },
  selectChipCerimonialistActive: {
    background: 'var(--cerimoniario-color)',
    color: '#000',
    borderColor: 'transparent',
    boxShadow: '0 0 10px rgba(234, 179, 8, 0.4)',
  }
};
