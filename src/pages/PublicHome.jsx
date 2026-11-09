import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { SECTORS, getSectorConfig, getItemSector } from '../utils/sectorConfig';
import Modal from '../components/Modal';
import {
  Calendar,
  Clock,
  MapPin,
  Church,
  Music,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CalendarDays
} from 'lucide-react';

const formatTime = (time) => {
  if (!time) return '';
  if (/^[0-9:]+$/.test(time)) return `${time}h`;
  return time;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

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

export default function PublicHome({ setActiveTab }) {
  const { schedules, chapels, servers } = useContext(AppContext);
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState(null);

  const getChapel = (id) => chapels.find(c => c.id === id) || { name: 'Capela Desconhecida', address: '' };
  const getServer = (id) => servers.find(s => s.id === id) || { name: 'Desconhecido', category: 'coroinha' };

  // All published upcoming schedules across all sectors
  const upcomingAll = schedules
    .filter(s => s.status === 'scheduled' && s.published !== false)
    .sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));

  const getSectorSchedules = (sectorId) => {
    return upcomingAll
      .filter(s => getItemSector(s) === sectorId)
      .sort((a, b) => {
        const hasOrderA = typeof a.order === 'number';
        const hasOrderB = typeof b.order === 'number';
        if (hasOrderA && hasOrderB) return a.order - b.order;
        if (hasOrderA) return -1;
        if (hasOrderB) return 1;
        return new Date(a.date || '') - new Date(b.date || '');
      });
  };

  const coroinhasSchedules = getSectorSchedules('coroinhas');
  const musicaSchedules = getSectorSchedules('musica');
  const liturgiaSchedules = getSectorSchedules('liturgia');

  const sectorCards = [
    {
      id: 'coroinhas',
      tabId: 'schedules-coroinhas',
      title: 'Escala dos Coroinhas',
      subtitle: 'Coroinhas e Cerimoniários do Altar',
      icon: Church,
      color: '#d97706',
      bgTint: 'rgba(217, 119, 6, 0.12)',
      borderTint: 'rgba(217, 119, 6, 0.35)',
      schedules: coroinhasSchedules
    },
    {
      id: 'musica',
      tabId: 'schedules-musica',
      title: 'Escala da Música',
      subtitle: 'Ministério de Música, Cantores e Instrumentistas',
      icon: Music,
      color: '#0ea5e9',
      bgTint: 'rgba(14, 165, 233, 0.12)',
      borderTint: 'rgba(14, 165, 233, 0.35)',
      schedules: musicaSchedules
    },
    {
      id: 'liturgia',
      tabId: 'schedules-liturgia',
      title: 'Escala da Liturgia',
      subtitle: 'Leitores, Salmistas, Comentaristas e Coordenadores',
      icon: BookOpen,
      color: '#10b981',
      bgTint: 'rgba(16, 185, 129, 0.12)',
      borderTint: 'rgba(16, 185, 129, 0.35)',
      schedules: liturgiaSchedules
    }
  ];

  const renderScheduleCard = (sc, accentColor) => {
    const chapel = getChapel(sc.chapelId);
    const sectorId = getItemSector(sc);
    const sectorCfg = getSectorConfig(sectorId);

    const mainMember = sc.mainCeremonialistId ? getServer(sc.mainCeremonialistId) : null;
    const auxMembers = (sc.ceremonialistIds || []).map(id => getServer(id));
    const regularMembers = (sc.serverIds || []).map(id => getServer(id));

    return (
      <div
        key={sc.id}
        className="app-schedule-card"
        style={{ borderTop: `3px solid ${accentColor}` }}
        onClick={() => setSelectedDetailSchedule(sc)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <span
            className="badge"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}40`
            }}
          >
            {sectorCfg.name}
          </span>
          <span className="badge badge-scheduled">Agendada</span>
        </div>

        <div className="schedule-card-main-highlight">
          <div className="schedule-date-badge-wrapper">
            <span className="schedule-date-day">{getDayOnly(sc.date)}</span>
            <span className="schedule-date-month">{getMonthAbbr(sc.date)}</span>
            <span className="schedule-date-weekday">
              {getDayNameInPortuguese(sc.date).substring(0, 3)}
            </span>
          </div>

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

        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '0.85rem 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
          {mainMember && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '22px',
                padding: '0 4px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: '#fde047',
                border: '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                {sectorCfg.mainRoleBadge}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                <strong>{mainMember.name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)' }}>({sectorCfg.mainRoleTitle})</span>
              </span>
            </div>
          )}

          {auxMembers.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '22px',
                padding: '0 4px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                {sectorCfg.auxRoleBadge}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{m.name}</span>
            </div>
          ))}

          {regularMembers.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '22px',
                padding: '0 4px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {sectorCfg.memberRoleBadge}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Hero Banner */}
      <div className="glass-panel hero-card" style={{ marginBottom: '2rem', padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: '820px' }}>
          <h1 className="hero-title" style={{ fontSize: '2.1rem', color: 'var(--gold-light)' }}>
            Escalas Paroquiais • Santo Antônio
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>
            Acompanhe na página principal todas as escalas lançadas pelos setores de <strong>Coroinhas</strong>, <strong>Música</strong> e <strong>Liturgia</strong>, ou acesse cada pastoral diretamente pelo menu superior.
          </p>
        </div>
      </div>

      {/* Quick Sector Navigation Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        {sectorCards.map(sec => {
          const Icon = sec.icon;
          return (
            <div
              key={sec.id}
              className="glass-panel"
              onClick={() => setActiveTab(sec.tabId)}
              style={{
                padding: '1.35rem 1.5rem',
                cursor: 'pointer',
                borderLeft: `4px solid ${sec.color}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  padding: '0.8rem',
                  borderRadius: '12px',
                  backgroundColor: sec.bgTint,
                  border: `1px solid ${sec.borderTint}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={24} style={{ color: sec.color }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--color-text-primary)' }}>{sec.title}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{sec.subtitle}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {sec.schedules.length} {sec.schedules.length === 1 ? 'escala ativa' : 'escalas ativas'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700, color: sec.color }}>
                  Abrir Setor <ArrowRight size={15} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sections for each sector on the main page */}
      {sectorCards.map(sec => {
        const Icon = sec.icon;
        return (
          <div key={sec.id} style={{ marginBottom: '3rem' }}>
            <div className="section-header" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Icon size={24} style={{ color: sec.color }} />
                <div>
                  <h2 className="section-title" style={{ fontSize: '1.45rem', paddingBottom: '0.3rem' }}>
                    {sec.title}
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {sec.subtitle}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab(sec.tabId)}
                style={{ fontSize: '0.85rem' }}
              >
                Ver página completa de {SECTORS[sec.id].name} <ArrowRight size={15} />
              </button>
            </div>

            {sec.schedules.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Calendar size={32} style={{ marginBottom: '0.5rem', opacity: 0.6 }} />
                <p style={{ fontSize: '0.9rem' }}>Nenhuma escala futura publicada para {SECTORS[sec.id].name} no momento.</p>
              </div>
            ) : (
              <div className="grid-cards">
                {sec.schedules.map(sc => renderScheduleCard(sc, sec.color))}
              </div>
            )}
          </div>
        );
      })}

      {/* Detail Modal */}
      <Modal
        isOpen={selectedDetailSchedule !== null}
        onClose={() => setSelectedDetailSchedule(null)}
        title="Detalhes da Escala"
      >
        {selectedDetailSchedule && (() => {
          const chapel = getChapel(selectedDetailSchedule.chapelId);
          const sectorCfg = getSectorConfig(getItemSector(selectedDetailSchedule));
          const mainMember = selectedDetailSchedule.mainCeremonialistId ? getServer(selectedDetailSchedule.mainCeremonialistId) : null;
          const auxMembers = (selectedDetailSchedule.ceremonialistIds || []).map(id => getServer(id));
          const regularMembers = (selectedDetailSchedule.serverIds || []).map(id => getServer(id));

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: sectorCfg.accentColor, fontWeight: 700 }}>
                    Setor: {sectorCfg.fullName}
                  </span>
                  <h3 style={{ fontSize: '1.35rem', color: 'var(--primary-gold)', margin: '0.2rem 0 0 0' }}>{chapel.name}</h3>
                </div>
                <span className="badge badge-scheduled">Agendada</span>
              </div>

              <div className="modal-detail-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', padding: '0.85rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CalendarDays size={16} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Data</span>
                    <strong style={{ fontSize: '0.92rem' }}>{formatDate(selectedDetailSchedule.date)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Clock size={16} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Horário</span>
                    <strong style={{ fontSize: '0.92rem' }}>{formatTime(selectedDetailSchedule.time)}</strong>
                  </div>
                </div>
              </div>

              {chapel.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
                  <MapPin size={14} style={{ color: 'var(--primary-gold)' }} />
                  <span>{chapel.address}</span>
                </div>
              )}

              {selectedDetailSchedule.observation && (
                <div style={{
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  borderLeft: '4px solid var(--primary-gold)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0 8px 8px 0',
                  marginBottom: '1.25rem'
                }}>
                  <strong style={{ color: 'var(--primary-gold)', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Aviso / Observação:</strong>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{selectedDetailSchedule.observation}</p>
                </div>
              )}

              <h4 style={{ fontSize: '0.88rem', color: 'var(--primary-gold)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Equipe Escalada ({sectorCfg.name})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {mainMember && (
                  <div style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <strong>{mainMember.name}</strong> <span style={{ color: 'var(--primary-gold)', fontSize: '0.8rem' }}>• {sectorCfg.mainRoleTitle}</span>
                  </div>
                )}
                {auxMembers.map((m, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <strong>{m.name}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>• {sectorCfg.auxRoleLabel}</span>
                  </div>
                ))}
                {regularMembers.map((m, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <strong>{m.name}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>• {sectorCfg.memberRoleLabel}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setSelectedDetailSchedule(null)}
              >
                Fechar
              </button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

