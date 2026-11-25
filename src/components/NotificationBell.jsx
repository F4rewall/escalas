import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { getSectorConfig, getItemSector } from '../utils/sectorConfig';
import { formatBrDate } from '../utils/botHelpers';
import {
  Bell,
  AlertTriangle,
  PhoneOff,
  UserX,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  X,
  Edit3,
  Bot,
  MessageSquarePlus
} from 'lucide-react';

export default function NotificationBell({ setActiveTab }) {
  const {
    userRole,
    adminSector,
    servers,
    schedules,
    chapels,
    systemRequests,
    parishRequests,
    addSystemRequest,
    resolveSystemRequest,
    deleteSystemRequest,
    resolveParishRequest,
    setPendingEditServerId
  } = useContext(AppContext);

  const isAdmin = userRole === 'admin';
  const isChatUser = userRole === 'chat';
  const isStaff = isAdmin || isChatUser;
  const activeSector = adminSector || 'coroinhas';
  const sectorCfg = getSectorConfig(activeSector);

  const [isOpen, setIsOpen] = useState(false);
  const [activeBellTab, setActiveBellTab] = useState(isStaff ? 'incomplete' : 'requests'); // 'incomplete' | 'requests'
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqSector, setReqSector] = useState(isAdmin ? activeSector : 'coroinhas');
  const [sendingReq, setSendingReq] = useState(false);

  const wrapperRef = useRef(null);

  useEffect(() => {
    if (isAdmin) {
      setReqSector(activeSector);
    }
  }, [activeSector, isAdmin]);

  useEffect(() => {
    if (!isStaff) {
      setActiveBellTab('requests');
    } else {
      setActiveBellTab('incomplete');
    }
  }, [isStaff]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getChapelName = (id) => chapels.find((c) => c.id === id)?.name || 'Capela';

  // Scoped strictly to activeSector for sector admins; all sectors (read-only alert + requests) for user 'chat'
  const incompleteAlerts = [];
  if (isStaff) {
    const relevantServers = isAdmin
      ? servers.filter((sv) => getItemSector(sv) === activeSector)
      : servers;
    const relevantSchedules = isAdmin
      ? schedules.filter((sc) => getItemSector(sc) === activeSector && sc.status === 'scheduled')
      : schedules.filter((sc) => sc.status === 'scheduled');

    // 1. Members with missing required fields
    relevantServers.forEach((sv) => {
      const svSector = getItemSector(sv);
      const svSectorCfg = getSectorConfig(svSector);
      const cleanPhone = (sv.phone || '').replace(/\D/g, '');

      if (cleanPhone.length < 10) {
        incompleteAlerts.push({
          id: `phone_${sv.id}`,
          severity: 'high',
          sectorName: svSectorCfg.name,
          sectorColor: svSectorCfg.accentColor,
          title: `${sv.name} está sem celular/WhatsApp`,
          detail: `Cadastro incompleto em ${svSectorCfg.name} — o Chatbot precisa do celular para enviar mensagens e código.`,
          serverId: isAdmin ? sv.id : null,
          type: 'phone'
        });
      }

      if (!sv.category) {
        incompleteAlerts.push({
          id: `cat_${sv.id}`,
          severity: 'medium',
          sectorName: svSectorCfg.name,
          sectorColor: svSectorCfg.accentColor,
          title: `${sv.name} sem função/categoria`,
          detail: `Defina a categoria no perfil do membro (${svSectorCfg.name}).`,
          serverId: isAdmin ? sv.id : null,
          type: 'profile'
        });
      } else if (isAdmin && !sv.preferredChapelId) {
        incompleteAlerts.push({
          id: `chap_${sv.id}`,
          severity: 'low',
          sectorName: svSectorCfg.name,
          sectorColor: svSectorCfg.accentColor,
          title: `${sv.name} sem capela preferencial`,
          detail: `Cadastro sem capela preferencial definida.`,
          serverId: sv.id,
          type: 'profile'
        });
      }
    });

    // 2. Upcoming schedules missing Principal, missing Principal phone, or pending swap
    relevantSchedules.forEach((sc) => {
      const scSector = getItemSector(sc);
      const scSectorCfg = getSectorConfig(scSector);
      const chapelName = getChapelName(sc.chapelId);
      const dateLabel = `${formatBrDate(sc.date)} ${sc.time || ''}`;

      if (!sc.mainCeremonialistId) {
        incompleteAlerts.push({
          id: `no_main_${sc.id}`,
          severity: 'high',
          sectorName: scSectorCfg.name,
          sectorColor: scSectorCfg.accentColor,
          title: `Escala sem ${scSectorCfg.mainRoleTitle}`,
          detail: `${chapelName} (${dateLabel}) precisa de um responsável para receber o código do relatório.`,
          scheduleId: isAdmin ? sc.id : null,
          type: 'schedule'
        });
      } else {
        const principal = servers.find((s) => s.id === sc.mainCeremonialistId);
        if (principal && (principal.phone || '').replace(/\D/g, '').length < 10) {
          incompleteAlerts.push({
            id: `main_nophone_${sc.id}`,
            severity: 'high',
            sectorName: scSectorCfg.name,
            sectorColor: scSectorCfg.accentColor,
            title: `Responsável da escala sem WhatsApp: ${principal.name}`,
            detail: `Escala em ${chapelName} (${dateLabel}) não receberá o código pelo bot sem o celular.`,
            serverId: isAdmin ? principal.id : null,
            type: 'phone'
          });
        }
      }

      if (sc.botSwapStatus === 'swap_reported' && sc.botSwapReply) {
        incompleteAlerts.push({
          id: `swap_${sc.id}`,
          severity: 'high',
          sectorName: scSectorCfg.name,
          sectorColor: scSectorCfg.accentColor,
          title: `Troca informada pelo WhatsApp (${chapelName})`,
          detail: `${dateLabel}: "${sc.botSwapReply}"`,
          scheduleId: isAdmin ? sc.id : null,
          type: 'swap'
        });
      }
    });
  }

  // Sort severity: high first
  const severityRank = { high: 0, medium: 1, low: 2 };
  incompleteAlerts.sort((a, b) => (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2));

  // Strictly scoped to this admin's sector (or all for user 'chat' to coordinate missing phone requests)
  const visibleRequests = isAdmin
    ? systemRequests.filter((r) => (r.sector || 'coroinhas') === activeSector)
    : isChatUser
    ? systemRequests
    : [];

  const openRequests = visibleRequests.filter((r) => r.status !== 'resolved');
  const openParishRequests = isChatUser
    ? parishRequests.filter((pr) => pr.status !== 'resolved')
    : [];
  const totalBadgeCount = isStaff
    ? incompleteAlerts.length + openRequests.length + openParishRequests.length
    : 0;

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    setSendingReq(true);
    const ok = await addSystemRequest({
      sector: isAdmin ? activeSector : reqSector,
      title: reqTitle,
      description: reqDesc
    });
    setSendingReq(false);
    if (ok) {
      setReqTitle('');
      setReqDesc('');
      if (!isAdmin) {
        alert(`Solicitação enviada para a coordenação de ${getSectorConfig(reqSector).name} com sucesso!`);
        setIsOpen(false);
      }
    }
  };

  const handleFixMember = (alertItem) => {
    if (alertItem.serverId) {
      setPendingEditServerId(alertItem.serverId);
      setActiveTab('profiles');
      setIsOpen(false);
    } else if (alertItem.scheduleId) {
      setActiveTab('schedules');
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          ...styles.bellBtn,
          ...(isOpen ? styles.bellBtnActive : {})
        }}
        title={isChatUser ? 'Avisos de Cadastros & Solicitações (Todos Setores)' : isAdmin ? `Avisos e Solicitações (${sectorCfg.name})` : 'Deixar solicitação para a Coordenação'}
      >
        <Bell size={18} />
        {totalBadgeCount > 0 && (
          <span style={styles.badgeCounter}>
            {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-panel" style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} style={{ color: 'var(--primary-gold)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                {isChatUser ? 'Pendências & Solicitações (Geral)' : isAdmin ? `Avisos & Solicitações (${sectorCfg.name})` : 'Deixar Solicitação do Sistema'}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={styles.closeBtn}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {isStaff && (
            <div style={styles.tabRow}>
              <button
                type="button"
                style={{ ...styles.tabBtn, ...(activeBellTab === 'incomplete' ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveBellTab('incomplete')}
              >
                Dados Incompletos ({incompleteAlerts.length})
              </button>
              <button
                type="button"
                style={{ ...styles.tabBtn, ...(activeBellTab === 'requests' ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveBellTab('requests')}
              >
                Solicitações ({openRequests.length + openParishRequests.length})
              </button>
            </div>
          )}

          {/* TAB 1: INCOMPLETE DATA DIAGNOSTICS */}
          {isStaff && activeBellTab === 'incomplete' && (
            <div style={styles.listScroll}>
              {incompleteAlerts.length === 0 ? (
                <div style={styles.emptyBox}>
                  <CheckCircle2 size={28} style={{ color: 'var(--color-present)', marginBottom: '0.4rem' }} />
                  <p style={{ margin: 0, fontSize: '0.82rem' }}>
                    {isChatUser
                      ? 'Tudo completo em todos os setores! Nenhum dado faltando.'
                      : `Tudo completo em ${sectorCfg.name}! Nenhum membro ou escala com dados faltando.`}
                  </p>
                </div>
              ) : (
                incompleteAlerts.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      ...styles.alertCard,
                      borderLeft: `3px solid ${
                        item.severity === 'high'
                          ? 'var(--color-absent)'
                          : item.severity === 'medium'
                          ? 'var(--primary-gold)'
                          : '#38bdf8'
                      }`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.62rem',
                          padding: '0.12rem 0.45rem',
                          backgroundColor: `${item.sectorColor}20`,
                          color: item.sectorColor,
                          border: `1px solid ${item.sectorColor}40`
                        }}
                      >
                        {item.sectorName}
                      </span>
                      {item.type === 'phone' ? (
                        <PhoneOff size={13} style={{ color: 'var(--color-absent)' }} />
                      ) : item.type === 'swap' ? (
                        <Bot size={13} style={{ color: 'var(--color-absent)' }} />
                      ) : item.type === 'schedule' ? (
                        <UserX size={13} style={{ color: 'var(--primary-gold)' }} />
                      ) : (
                        <AlertTriangle size={13} style={{ color: 'var(--primary-gold)' }} />
                      )}
                    </div>

                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem', lineHeight: '1.35' }}>
                      {item.detail}
                    </div>

                    {(item.serverId || item.scheduleId) && (
                      <div style={{ marginTop: '0.45rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                          onClick={() => handleFixMember(item)}
                        >
                          <Edit3 size={11} /> {item.serverId ? 'Completar Cadastro' : 'Abrir Escalas'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: SYSTEM REQUESTS */}
          {(!isStaff || activeBellTab === 'requests') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <form onSubmit={handleCreateRequest} style={styles.reqForm}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--primary-gold)', marginBottom: '0.35rem' }}>
                  <MessageSquarePlus size={13} /> Nova Solicitação / Pendência
                </div>
                {!isAdmin && (
                  <select
                    className="form-control"
                    style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem', marginBottom: '0.4rem' }}
                    value={reqSector}
                    onChange={(e) => setReqSector(e.target.value)}
                  >
                    <option value="coroinhas">Para: Coroinhas</option>
                    <option value="musica">Para: Música</option>
                    <option value="liturgia">Para: Liturgia</option>
                    <option value="mece">Para: MESCE</option>
                  </select>
                )}
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', marginBottom: '0.4rem' }}
                  placeholder="Ex: Falta celular de João / Atualizar cadastro..."
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  required
                />
                <textarea
                  rows={2}
                  className="form-control"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.78rem', marginBottom: '0.45rem', resize: 'vertical' }}
                  placeholder="Detalhes (ex: telefone correto, qual dado está faltando)..."
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingReq}
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem' }}
                >
                  {isStaff ? <Plus size={13} /> : <Send size={13} />}
                  {sendingReq ? 'Salvando...' : `Registrar em ${isAdmin ? sectorCfg.name : getSectorConfig(reqSector).name}`}
                </button>
              </form>

              {isChatUser && openParishRequests.length > 0 && (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-gold)', marginBottom: '0.35rem' }}>
                    Atendimentos do Assistente ({openParishRequests.length})
                  </div>
                  <div style={{ ...styles.listScroll, maxHeight: '150px' }}>
                    {openParishRequests.map((pr) => (
                      <div key={pr.id} style={{ ...styles.alertCard, borderLeft: '3px solid #0ea5e9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                          <span className="badge badge-scheduled" style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>
                            {pr.type}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem' }}
                            onClick={() => resolveParishRequest(pr.id)}
                          >
                            <CheckCircle2 size={10} /> Concluir
                          </button>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {pr.requesterName} • {pr.requesterPhone || 'Sem telefone'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                          {pr.details || pr.preferredDate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isStaff && (
                <div style={styles.listScroll}>
                  {visibleRequests.length === 0 ? (
                    <div style={styles.emptyBox}>
                      <p style={{ margin: 0, fontSize: '0.8rem' }}>
                        {isChatUser
                          ? 'Nenhuma solicitação registrada no momento.'
                          : `Nenhuma solicitação registrada para ${sectorCfg.name}.`}
                      </p>
                    </div>
                  ) : (
                    visibleRequests.map((req) => {
                      const isResolved = req.status === 'resolved';
                      const reqSectorName = getSectorConfig(req.sector || 'coroinhas').name;
                      return (
                        <div
                          key={req.id}
                          style={{
                            ...styles.alertCard,
                            opacity: isResolved ? 0.55 : 1,
                            borderLeft: `3px solid ${isResolved ? 'var(--color-present)' : 'var(--primary-gold)'}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.62rem' }}>
                              {reqSectorName}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString('pt-BR') : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: isResolved ? 'line-through' : 'none' }}>
                            {req.title}
                          </div>
                          {req.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
                              {req.description}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
                            {!isResolved && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => resolveSystemRequest(req.id)}
                              >
                                <CheckCircle2 size={11} /> Resolver
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}
                              onClick={() => deleteSystemRequest(req.id)}
                              title="Excluir"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  bellBtn: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '0.45rem 0.55rem',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  },
  bellBtnActive: {
    borderColor: 'var(--primary-gold)',
    color: 'var(--primary-gold)',
    backgroundColor: 'rgba(217, 119, 6, 0.12)'
  },
  badgeCounter: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    borderRadius: '999px',
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: '360px',
    maxWidth: 'calc(100vw - 24px)',
    padding: '1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color-active)',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
    zIndex: 300
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.65rem',
    marginBottom: '0.65rem',
    borderBottom: '1px solid var(--border-color)'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '0.2rem'
  },
  tabRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.35rem',
    marginBottom: '0.65rem'
  },
  tabBtn: {
    padding: '0.45rem 0.5rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'rgba(0,0,0,0.2)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tabBtnActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderColor: 'var(--primary-gold)',
    color: 'var(--primary-gold)'
  },
  listScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxHeight: '300px',
    overflowY: 'auto',
    paddingRight: '0.15rem'
  },
  alertCard: {
    padding: '0.65rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  emptyBox: {
    padding: '1.5rem 0.75rem',
    textAlign: 'center',
    color: 'var(--color-text-muted)'
  },
  reqForm: {
    padding: '0.65rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--border-color)'
  }
};
