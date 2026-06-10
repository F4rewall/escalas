import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';
import { 
  UserPlus, 
  Search, 
  Phone, 
  Calendar, 
  Church, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Award
} from 'lucide-react';

export default function Profiles() {
  const { 
    userRole, 
    servers, 
    chapels, 
    addServer, 
    updateServer, 
    deleteServer,
    getServerStats,
    attendance,
    schedules
  } = useContext(AppContext);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'coroinha' | 'cerimoniario'
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null); // null for create, object for edit
  const [selectedServerForDetails, setSelectedServerForDetails] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('coroinha');
  const [formPhone, setFormPhone] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formPrefChapelId, setFormPrefChapelId] = useState('');

  // Helpers
  const getChapelName = (id) => {
    const chapel = chapels.find(c => c.id === id);
    return chapel ? chapel.name : 'Nenhuma selecionada';
  };

  const getScheduleDetails = (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return { date: '', time: '', chapelName: 'Missa Excluída' };
    const chapel = chapels.find(c => c.id === schedule.chapelId);
    return {
      date: schedule.date,
      time: schedule.time,
      chapelName: chapel ? chapel.name : 'Capela Excluída'
    };
  };

  // Filter Logic
  const filteredServers = servers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.phone && s.phone.includes(searchTerm));
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || 
                          (selectedStatus === 'active' && s.active) || 
                          (selectedStatus === 'inactive' && !s.active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Open Add Server Form
  const openAddModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormCategory('coroinha');
    setFormPhone('');
    setFormActive(true);
    setFormPrefChapelId(chapels[0]?.id || '');
    setIsFormModalOpen(true);
  };

  // Open Edit Server Form
  const openEditModal = (e, server) => {
    e.stopPropagation(); // Avoid triggering detail modal
    setEditingServer(server);
    setFormName(server.name);
    setFormCategory(server.category);
    setFormPhone(server.phone || '');
    setFormActive(server.active);
    setFormPrefChapelId(server.preferredChapelId || '');
    setIsFormModalOpen(true);
  };

  // Open Detail Modal
  const openDetailModal = (server) => {
    setSelectedServerForDetails(server);
    setIsDetailModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Preencha o nome do servidor.');
      return;
    }

    const serverData = {
      name: formName,
      category: formCategory,
      phone: formPhone,
      active: formActive,
      preferredChapelId: formPrefChapelId,
      color: editingServer ? editingServer.color : undefined
    };

    if (editingServer) {
      updateServer({
        ...editingServer,
        ...serverData
      });
    } else {
      addServer(serverData);
    }

    setIsFormModalOpen(false);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir permanentemente este servidor? Suas estatísticas e registros serão limpos.')) {
      deleteServer(id);
    }
  };

  // Formatting Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Perfis dos Altaristas</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Lista completa de Coroinhas e Cerimoniários da paróquia. Clique em um perfil para ver estatísticas de frequência.
          </p>
        </div>
        
        {userRole === 'admin' && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={16} /> Cadastrar Servidor
          </button>
        )}
      </div>

      {/* Filter and Search Bar Panel */}
      <div className="glass-panel" style={styles.filterPanel}>
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou celular..." 
            className="form-control" 
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filterOptions}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Categoria:</span>
            <div style={styles.pillGroup}>
              <button 
                style={{...styles.pillBtn, ...(selectedCategory === 'all' ? styles.pillBtnActive : {})}}
                onClick={() => setSelectedCategory('all')}
              >
                Todos
              </button>
              <button 
                style={{...styles.pillBtn, ...(selectedCategory === 'coroinha' ? styles.pillBtnActive : {})}}
                onClick={() => setSelectedCategory('coroinha')}
              >
                Coroinhas
              </button>
              <button 
                style={{...styles.pillBtn, ...(selectedCategory === 'cerimoniario' ? styles.pillBtnActive : {})}}
                onClick={() => setSelectedCategory('cerimoniario')}
              >
                Cerimoniários
              </button>
            </div>
          </div>

          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Status:</span>
            <select 
              className="form-control" 
              style={styles.selectFilter}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Altar boy cards list */}
      {filteredServers.length === 0 ? (
        <div className="glass-panel" style={styles.emptyContainer}>
          <Search size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
          <h3>Nenhum servidor correspondente</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            Tente mudar as opções de filtros ou verifique a ortografia do nome procurado.
          </p>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredServers.map(server => {
            const stats = getServerStats(server.id);
            const isHighAttendance = stats.rate >= 90 && stats.total >= 3;
            
            return (
              <div 
                key={server.id} 
                className="glass-panel profiles-card-container" 
                style={{
                  ...styles.profileCard,
                  ...(!server.active ? styles.profileCardInactive : {})
                }}
                onClick={() => openDetailModal(server)}
              >
                <div style={styles.cardHeader}>
                  <span className={`badge ${server.category === 'cerimoniario' ? 'badge-cerimoniario' : 'badge-coroinha'}`}>
                    {server.category === 'cerimoniario' ? 'Cerimoniário' : 'Coroinha'}
                  </span>
                  
                  {!server.active && (
                    <span className="badge badge-absent" style={{fontSize: '0.65rem'}}>Inativo</span>
                  )}
                  
                  {isHighAttendance && (
                    <Award size={18} style={{ color: 'var(--primary-gold)' }} title="Excelência: +90% Presenças" />
                  )}
                </div>

                <div style={styles.avatarRow}>
                  <div style={styles.avatar(server.color || '#3b82f6')}>
                    {server.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h3 style={styles.serverName}>{server.name}</h3>
                    <div style={styles.attendanceText}>
                      Frequência: <strong style={{ color: stats.rate >= 80 ? 'var(--color-present)' : (stats.rate >= 50 ? 'var(--gold-light)' : 'var(--color-absent)') }}>
                        {stats.rate}%
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={styles.cardInfo}>
                  {server.phone && (
                    <div style={styles.infoRow}>
                      <Phone size={12} />
                      <span>{server.phone}</span>
                    </div>
                  )}
                  <div style={styles.infoRow}>
                    <Church size={12} />
                    <span style={styles.truncateText}>Capela: {getChapelName(server.preferredChapelId)}</span>
                  </div>
                </div>

                {/* Admin edit/delete tools overlay */}
                {userRole === 'admin' && (
                  <div className="profiles-admin-tools">
                    <button 
                      style={styles.toolBtn('#3b82f6')} 
                      onClick={(e) => openEditModal(e, server)}
                      title="Editar Perfil"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      style={styles.toolBtn('var(--color-absent)')} 
                      onClick={(e) => handleDelete(e, server.id)}
                      title="Excluir Perfil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL: CREATE / EDIT SERVER */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)}
        title={editingServer ? 'Editar Cadastro do Servidor' : 'Cadastrar Novo Servidor'}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label>Nome Completo</label>
            <input 
              type="text" 
              placeholder="Ex: João da Silva Santos" 
              className="form-control"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Categoria de Altar</label>
            <div style={styles.formRadioGroup}>
              <label style={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="formCategory" 
                  value="coroinha"
                  checked={formCategory === 'coroinha'}
                  onChange={() => setFormCategory('coroinha')}
                />
                Coroinha
              </label>
              <label style={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="formCategory" 
                  value="cerimoniario"
                  checked={formCategory === 'cerimoniario'}
                  onChange={() => setFormCategory('cerimoniario')}
                />
                Cerimoniário
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input 
                type="text" 
                placeholder="Ex: (11) 99999-9999" 
                className="form-control"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Capela Preferencial (Escalar com frequência)</label>
              <select 
                className="form-control"
                value={formPrefChapelId}
                onChange={(e) => setFormPrefChapelId(e.target.value)}
              >
                <option value="">Nenhuma</option>
                {chapels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <input 
                type="checkbox" 
                checked={formActive} 
                onChange={(e) => setFormActive(e.target.checked)} 
              />
              Servidor Ativo (Disponível para escalas)
            </label>
          </div>

          <div style={styles.formActions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsFormModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar Alterações
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL MODAL: SERVER STATISTICS & HISTORY */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedServerForDetails ? `Histórico de ${selectedServerForDetails.name}` : ''}
      >
        {selectedServerForDetails && (() => {
          const stats = getServerStats(selectedServerForDetails.id);
          // Get historical attendance records
          const history = attendance
            .filter(a => a.serverId === selectedServerForDetails.id)
            .map(a => {
              const details = getScheduleDetails(a.scheduleId);
              return {
                id: a.scheduleId,
                status: a.status,
                justification: a.justification,
                date: details.date,
                time: details.time,
                chapelName: details.chapelName
              };
            })
            .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));

          return (
            <div>
              <div style={styles.detailHeader}>
                <div style={styles.detailStatsBlock}>
                  <div style={styles.bigAttendanceCircle(stats.rate)}>
                    <span>{stats.rate}%</span>
                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Presença</span>
                  </div>

                  <div style={styles.detailStatsGrid}>
                    <div style={styles.statMiniBox}>
                      <span style={{ color: 'var(--color-present)', fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.present}</span>
                      <span style={styles.statMiniLabel}>Presente</span>
                    </div>
                    <div style={styles.statMiniBox}>
                      <span style={{ color: 'var(--color-absent)', fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.absent}</span>
                      <span style={styles.statMiniLabel}>Faltou</span>
                    </div>
                    <div style={styles.statMiniBox}>
                      <span style={{ color: 'var(--color-justified)', fontSize: '1.25rem', fontWeight: 'bold' }}>{stats.justified}</span>
                      <span style={styles.statMiniLabel}>Justificado</span>
                    </div>
                  </div>
                </div>

                <div style={styles.detailMetaBlock}>
                  <p><strong>Categoria:</strong> {selectedServerForDetails.category === 'cerimoniario' ? 'Cerimoniário' : 'Coroinha'}</p>
                  {selectedServerForDetails.phone && (
                    <p><strong>WhatsApp:</strong> {selectedServerForDetails.phone}</p>
                  )}
                  <p><strong>Preferência:</strong> {getChapelName(selectedServerForDetails.preferredChapelId)}</p>
                  <p><strong>Membro desde:</strong> {formatDate(selectedServerForDetails.joinedDate)}</p>
                  <p><strong>Status:</strong> {selectedServerForDetails.active ? 'Ativo' : 'Inativo'}</p>
                </div>
              </div>

              <hr style={styles.divider} />

              <h4 style={{...styles.selectorSectionTitle, marginBottom: '0.75rem'}}>Histórico de Missas</h4>
              
              <div style={styles.historyList}>
                {history.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                    Ainda não há registros de presença salvos para este servidor.
                  </p>
                ) : (
                  history.map(item => (
                    <div key={item.id} style={styles.historyRow}>
                      <div>
                        <h5 style={styles.historyChapel}>{item.chapelName}</h5>
                        <div style={styles.historyMeta}>
                          <Calendar size={10} /> <span>{formatDate(item.date)}</span>
                          <span style={{ margin: '0 0.25rem' }}>•</span>
                          <span>{item.time}h</span>
                        </div>
                        {item.justification && (
                          <p style={styles.historyJustification}>
                            <strong>Motivo:</strong> {item.justification}
                          </p>
                        )}
                      </div>

                      <div>
                        {item.status === 'present' && <span className="badge badge-present"><Award size={12} /> Pres.</span>}
                        {item.status === 'absent' && <span className="badge badge-absent"><XCircle size={12} /> Falta</span>}
                        {item.status === 'justified' && <span className="badge badge-justified"><HelpCircle size={12} /> Justif.</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

const styles = {
  filterPanel: {
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0 0.75rem',
    flex: 1,
    minWidth: '250px',
  },
  searchIcon: {
    color: 'var(--color-text-secondary)',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    padding: '0.65rem 0.5rem',
    width: '100%',
    boxShadow: 'none',
  },
  filterOptions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    fontWeight: '600',
  },
  pillGroup: {
    display: 'flex',
    gap: '0.25rem',
    background: 'rgba(0, 0, 0, 0.2)',
    padding: '0.2rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  pillBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  pillBtnActive: {
    backgroundColor: 'var(--primary-gold)',
    color: '#000',
  },
  selectFilter: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
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
  profileCard: {
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  profileCardInactive: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  avatar: (color) => ({
    width: '45px',
    height: '45px',
    borderRadius: '50%',
    backgroundColor: color + '20',
    color: color,
    border: `2px solid ${color}40`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '1rem',
    textTransform: 'uppercase',
  }),
  serverName: {
    fontSize: '1.05rem',
    color: 'var(--color-text-primary)',
    margin: 0,
    fontWeight: '600',
  },
  attendanceText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.1rem',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginTop: 'auto',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
  },
  truncateText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  toolBtn: (color) => ({
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${color}40`,
    color: color,
    borderRadius: '4px',
    padding: '0.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  }),
  formRadioGroup: {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '0.25rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--color-text-primary)',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
  },
  divider: {
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    margin: '1rem 0',
  },
  detailHeader: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1.8fr',
    gap: '1.5rem',
    alignItems: 'center',
    padding: '0.5rem 0',
  },
  detailStatsBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  bigAttendanceCircle: (rate) => {
    const color = rate >= 90 ? 'var(--color-present)' : (rate >= 75 ? 'var(--gold-light)' : 'var(--color-absent)');
    return {
      width: '90px',
      height: '90px',
      borderRadius: '50%',
      border: `4px solid ${color}`,
      boxShadow: `0 0 15px ${color}20`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.4rem',
      fontWeight: 'bold',
      color: 'var(--color-text-primary)',
    };
  },
  detailStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
    width: '100%',
  },
  statMiniBox: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.4rem',
    textAlign: 'center',
  },
  statMiniLabel: {
    display: 'block',
    fontSize: '0.65rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.1rem',
    textTransform: 'uppercase',
  },
  detailMetaBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '220px',
    overflowY: 'auto',
    paddingRight: '0.25rem',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
  },
  historyChapel: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--color-text-primary)',
  },
  historyMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.2rem',
  },
  historyJustification: {
    fontSize: '0.75rem',
    color: 'var(--gold-light)',
    marginTop: '0.25rem',
    fontStyle: 'italic',
  }
};
