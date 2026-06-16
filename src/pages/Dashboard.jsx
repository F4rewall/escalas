import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  Users, 
  Calendar, 
  Church, 
  TrendingUp, 
  Plus, 
  ClipboardCheck, 
  UserPlus,
  ArrowRight,
  Trash2
} from 'lucide-react';

const formatTime = (time) => {
  if (!time) return '';
  if (/^[0-9:]+$/.test(time)) return `${time}h`;
  return time;
};

export default function Dashboard({ setActiveTab }) {
  const { userRole, servers, chapels, schedules, attendance, clearAllData } = useContext(AppContext);

  // Compute stats
  const totalServers = servers.length;
  const activeServers = servers.filter(s => s.active).length;
  
  const totalChapels = chapels.length;
  
  const upcomingSchedules = schedules
    .filter(s => s.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute overall attendance rate
  const completedSchedules = schedules.filter(s => s.status === 'completed');
  const pastAttendance = attendance.filter(a => 
    completedSchedules.some(sc => sc.id === a.scheduleId)
  );
  
  const presentCount = pastAttendance.filter(a => a.status === 'present').length;
  const totalAttendanceRecords = pastAttendance.length;
  const overallAttendanceRate = totalAttendanceRecords > 0 
    ? Math.round((presentCount / totalAttendanceRecords) * 100) 
    : 0;

  // Get next 3 upcoming schedules
  const nextThree = upcomingSchedules.slice(0, 3);

  const getChapelName = (id) => {
    const chapel = chapels.find(c => c.id === id);
    return chapel ? chapel.name : 'Capela Desconhecida';
  };

  const getServerNames = (ids) => {
    if (!ids || ids.length === 0) return 'Nenhum';
    return ids.map(id => {
      const server = servers.find(s => s.id === id);
      return server ? server.name : 'Desconhecido';
    }).join(', ');
  };

  const getCeremonialistNames = (sc) => {
    const names = [];
    if (sc.mainCeremonialistId) {
      const main = servers.find(s => s.id === sc.mainCeremonialistId);
      if (main) names.push(`${main.name} (Principal)`);
    }
    if (sc.ceremonialistIds && sc.ceremonialistIds.length > 0) {
      sc.ceremonialistIds.forEach(id => {
        const other = servers.find(s => s.id === id);
        if (other) names.push(other.name);
      });
    }
    return names.length > 0 ? names.join(', ') : 'Nenhum';
  };

  const getMonthAbbr = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIndex = parseInt(parts[1], 10) - 1;
    return months[monthIndex] || '';
  };

  const getDayOnly = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts[2] || '';
  };

  return (
    <div>
      {/* Hero Welcome banner */}
      <div className="glass-panel hero-card">
        <div style={styles.heroContent}>
          <h1 className="hero-title">Ad Maiorem Dei Gloriam</h1>
          <p style={styles.heroText}>
            Portal Litúrgico da Paróquia de Santo Antônio. Organização, compromisso e zelo nas escalas dos Coroinhas e Cerimoniários para o serviço do Altar.
          </p>
          {userRole !== 'admin' && (
            <button className="btn btn-primary" onClick={() => setActiveTab('schedules')} style={{ marginTop: '1.25rem' }}>
              Ver Minhas Escalas <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Grid of stats */}
      <div style={styles.statsGrid}>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <TrendingUp size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <span style={styles.statLabel}>Presença Geral</span>
            <h2 style={styles.statVal}>{overallAttendanceRate}%</h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrapper" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <Users size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <span style={styles.statLabel}>Servidores Ativos</span>
            <h2 style={styles.statVal}>{activeServers} <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>/ {totalServers}</span></h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrapper" style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', border: '1px solid rgba(217, 119, 6, 0.2)' }}>
            <Calendar size={24} style={{ color: 'var(--primary-gold)' }} />
          </div>
          <div>
            <span style={styles.statLabel}>Próximas Escalas</span>
            <h2 style={styles.statVal}>{upcomingSchedules.length}</h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrapper" style={{ backgroundColor: 'rgba(20, 184, 166, 0.15)', border: '1px solid rgba(20, 184, 166, 0.2)' }}>
            <Church size={24} style={{ color: '#14b8a6' }} />
          </div>
          <div>
            <span style={styles.statLabel}>Capelas Ativas</span>
            <h2 style={styles.statVal}>{totalChapels}</h2>
          </div>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="dashboard-layout-grid">
        {/* Left Column: Upcoming schedules */}
        <div className="glass-panel" style={styles.panelSection}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Escalas Mais Próximas</h3>
            <button 
              onClick={() => setActiveTab('schedules')} 
              style={styles.panelLink}
            >
              Ver todas <ArrowRight size={14} />
            </button>
          </div>
          
          <div style={styles.scheduleList}>
            {nextThree.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Nenhuma escala futura agendada no momento.</p>
              </div>
            ) : (
              nextThree.map(sc => (
                <div key={sc.id} style={styles.scheduleRow}>
                  <div style={styles.scheduleDateBadge}>
                    <span style={styles.scheduleDay}>{getDayOnly(sc.date)}</span>
                    <span style={styles.scheduleMonth}>{getMonthAbbr(sc.date)}</span>
                  </div>
                  
                  <div style={styles.scheduleDetails}>
                    <h4 style={styles.scheduleChapel}>{getChapelName(sc.chapelId)}</h4>
                    <p style={styles.scheduleTime}>Horário: {formatTime(sc.time)}</p>
                    
                    <div style={styles.scheduleRoles}>
                      {sc.serverIds.length > 0 && (
                        <div style={styles.roleListItem}>
                          <span style={styles.roleDot('var(--coroinha-color)')}></span>
                          <span style={styles.roleLabelText}>Coroinhas:</span>
                          <span style={styles.roleNames}>{getServerNames(sc.serverIds)}</span>
                        </div>
                      )}
                      {(sc.mainCeremonialistId || (sc.ceremonialistIds && sc.ceremonialistIds.length > 0)) && (
                        <div style={styles.roleListItem}>
                          <span style={styles.roleDot('var(--cerimoniario-color)')}></span>
                          <span style={styles.roleLabelText}>Cerimoniários:</span>
                          <span style={styles.roleNames}>{getCeremonialistNames(sc)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Quick actions & Notices */}
        <div style={styles.sideCol}>
          {/* Quick Actions (only for admin) */}
          {userRole === 'admin' && (
            <div className="glass-panel" style={styles.panelSection}>
              <h3 style={{...styles.panelTitle, marginBottom: '1.25rem'}}>Ações de Administrador</h3>
              <div style={styles.actionGrid}>
                <button 
                  onClick={() => setActiveTab('schedules')} 
                  className="dashboard-action-btn"
                >
                  <ClipboardCheck size={20} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <span style={styles.actionBtnTitle}>Montar Escala</span>
                    <span style={styles.actionBtnDesc}>Criar nova escala de missa</span>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveTab('profiles')} 
                  className="dashboard-action-btn"
                >
                  <UserPlus size={20} style={{ color: '#8b5cf6' }} />
                  <div>
                    <span style={styles.actionBtnTitle}>Cadastrar Servidor</span>
                    <span style={styles.actionBtnDesc}>Adicionar coroinha/cerimoniário</span>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveTab('chapels')} 
                  className="dashboard-action-btn"
                >
                  <Plus size={20} style={{ color: '#14b8a6' }} />
                  <div>
                    <span style={styles.actionBtnTitle}>Nova Capela</span>
                    <span style={styles.actionBtnDesc}>Cadastrar nova capela ou missa</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    if (confirm("⚠️ ATENÇÃO: Isso irá apagar permanentemente todas as capelas, servidores, escalas e relatórios salvos. Deseja continuar?")) {
                      clearAllData();
                      alert("Sistema redefinido com sucesso! Todos os dados de teste foram apagados.");
                    }
                  }} 
                  className="dashboard-action-btn"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)'
                  }}
                >
                  <Trash2 size={20} style={{ color: 'var(--color-absent)' }} />
                  <div>
                    <span style={{...styles.actionBtnTitle, color: 'var(--color-absent)'}}>Limpar Sistema</span>
                    <span style={styles.actionBtnDesc}>Apagar todos os dados permanentemente</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Liturgical Notice Board */}
          <div className="glass-panel" style={styles.panelSection}>
            <h3 style={{...styles.panelTitle, marginBottom: '1rem'}}>Mural de Avisos</h3>
            <div style={styles.notices}>
              <div style={styles.noticeItem}>
                <span style={styles.noticeDate}>10/06/2026</span>
                <h4 style={styles.noticeTitle}>Substituições de Escala</h4>
                <p style={styles.noticeText}>
                  Lembramos que caso você não possa comparecer à sua escala, você DEVE solicitar substituição a outro colega com pelo menos 48h de antecedência.
                </p>
              </div>
              <div style={styles.noticeItem}>
                <span style={styles.noticeDate}>08/06/2026</span>
                <h4 style={styles.noticeTitle}>Vestimentas Oficiais</h4>
                <p style={styles.noticeText}>
                  Atenção para a limpeza e conservação das túnicas e sobrepelizes. Em caso de necessidade de ajuste ou troca de tamanho, fale com a coordenação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  hero: {
    padding: '2.5rem 2rem',
    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(15, 23, 42, 0.4))',
    border: '1px solid var(--border-color)',
    marginBottom: '2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    maxWidth: '800px',
    position: 'relative',
    zIndex: 1,
  },
  heroTitle: {
    fontSize: '2.2rem',
    fontWeight: '900',
    color: 'var(--primary-gold)',
    marginBottom: '1rem',
    textShadow: '0 0 10px rgba(217, 119, 6, 0.2)',
  },
  heroText: {
    color: 'var(--color-text-secondary)',
    fontSize: '1.05rem',
    lineHeight: '1.6',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  statCard: {
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    backgroundColor: 'var(--bg-secondary)',
  },
  statIconWrapper: (color) => ({
    padding: '0.75rem',
    borderRadius: '12px',
    backgroundColor: color + '15',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${color}20`,
  }),
  statLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    display: 'block',
    marginBottom: '0.25rem',
  },
  statVal: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  panelSection: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    marginBottom: '1.5rem',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  panelTitle: {
    fontSize: '1.2rem',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  panelLink: {
    background: 'none',
    border: 'none',
    color: 'var(--primary-gold)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    transition: 'all var(--transition-fast)',
  },
  scheduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  scheduleRow: {
    display: 'flex',
    gap: '1.25rem',
    padding: '1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    backgroundColor: 'rgba(0,0,0,0.15)',
    transition: 'border-color var(--transition-fast)',
  },
  scheduleDateBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '50px',
    height: '55px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--primary-gold), var(--gold-light))',
    color: '#000',
    fontWeight: 'bold',
  },
  scheduleDay: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  scheduleMonth: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleChapel: {
    fontSize: '1rem',
    margin: '0 0 0.25rem 0',
    color: 'var(--color-text-primary)',
  },
  scheduleTime: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    margin: '0 0 0.5rem 0',
  },
  scheduleRoles: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  roleListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
  },
  roleDot: (color) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
  }),
  roleLabelText: {
    color: 'var(--color-text-muted)',
    fontWeight: '600',
  },
  roleNames: {
    color: 'var(--color-text-secondary)',
  },
  sideCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  actionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.9rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: 'var(--color-text-primary)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  actionBtnTitle: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  actionBtnDesc: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.1rem',
  },
  notices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  noticeItem: {
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '1rem',
  },
  noticeDate: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    display: 'block',
    marginBottom: '0.25rem',
  },
  noticeTitle: {
    fontSize: '0.95rem',
    color: 'var(--primary-gold)',
    margin: '0 0 0.4rem 0',
  },
  noticeText: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.45',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem 1rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  }
};
