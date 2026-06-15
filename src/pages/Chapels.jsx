import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';
import { 
  Church, 
  MapPin, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  CalendarDays,
  FileText,
  X
} from 'lucide-react';

export default function Chapels() {
  const { userRole, chapels, addChapel, updateChapel, deleteChapel } = useContext(AppContext);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChapel, setEditingChapel] = useState(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMassTimes, setFormMassTimes] = useState([]);
  const [newMassTime, setNewMassTime] = useState('');

  // Open Add Chapel
  const openAddModal = () => {
    setEditingChapel(null);
    setFormName('');
    setFormAddress('');
    setFormDescription('');
    setFormMassTimes([]);
    setNewMassTime('');
    setIsModalOpen(true);
  };

  // Open Edit Chapel
  const openEditModal = (chapel) => {
    setEditingChapel(chapel);
    setFormName(chapel.name);
    setFormAddress(chapel.address);
    setFormDescription(chapel.description || '');
    setFormMassTimes(chapel.massTimes || []);
    setNewMassTime('');
    setIsModalOpen(true);
  };

  // Add mass time to list in form
  const handleAddMassTime = () => {
    if (!newMassTime.trim()) return;
    if (formMassTimes.includes(newMassTime.trim())) {
      alert('Este horário já está adicionado.');
      return;
    }
    setFormMassTimes(prev => [...prev, newMassTime.trim()]);
    setNewMassTime('');
  };

  // Remove mass time from list in form
  const handleRemoveMassTime = (time) => {
    setFormMassTimes(prev => prev.filter(t => t !== time));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      alert('Nome e endereço são obrigatórios.');
      return;
    }

    if (formMassTimes.length === 0) {
      alert('Adicione pelo menos um horário de missa para esta capela.');
      return;
    }

    const chapelData = {
      name: formName,
      address: formAddress,
      description: formDescription,
      massTimes: formMassTimes
    };

    if (editingChapel) {
      updateChapel({
        ...editingChapel,
        ...chapelData
      });
    } else {
      addChapel(chapelData);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (confirm('Atenção: Excluir esta capela também excluirá permanentemente todas as escalas vinculadas a ela. Deseja continuar?')) {
      deleteChapel(id);
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Capelas e Comunidades</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Consulte as capelas pertencentes à paróquia e seus respectivos horários de celebração.
          </p>
        </div>
        
        {userRole === 'admin' && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Nova Capela
          </button>
        )}
      </div>

      <div className="grid-cards">
        {chapels.map(chapel => (
          <div key={chapel.id} className="chapel-card">
            <div style={styles.cardHeader}>
              <div style={styles.chapelIconWrapper}>
                <Church size={22} style={{ color: 'var(--primary-gold)' }} />
              </div>
              
              {userRole === 'admin' && (
                <div style={styles.headerActions}>
                  <button 
                    style={styles.actionBtn('#3b82f6')} 
                    onClick={() => openEditModal(chapel)}
                    title="Editar Capela"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    style={styles.actionBtn('var(--color-absent)')} 
                    onClick={() => handleDelete(chapel.id)}
                    title="Excluir Capela"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            <h3 style={styles.chapelName}>{chapel.name}</h3>
            
            {chapel.description && (
              <p style={styles.chapelDescription}>{chapel.description}</p>
            )}

            <div style={styles.chapelAddress}>
              <MapPin size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span>{chapel.address}</span>
            </div>

            <hr style={styles.divider} />

            <div style={styles.massTimesSection}>
              <h4 style={styles.massSectionTitle}>Horários de Missas</h4>
              <div style={styles.massTimesList}>
                {chapel.massTimes && chapel.massTimes.length > 0 ? (
                  chapel.massTimes.map(time => (
                    <div key={time} style={styles.massTimeTag}>
                      <Clock size={12} style={{ color: 'var(--primary-gold)' }} />
                      <span>{time}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Nenhum horário cadastrado.
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {chapels.length === 0 && (
          <div className="glass-panel" style={{...styles.emptyContainer, gridColumn: '1 / -1'}}>
            <Church size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
            <h3>Nenhuma capela cadastrada</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Seja o primeiro a cadastrar uma capela para iniciar a organização das escalas.
            </p>
          </div>
        )}
      </div>

      {/* FORM MODAL: CREATE / EDIT CHAPEL */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingChapel ? 'Editar Capela' : 'Cadastrar Nova Capela'}
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label>Nome da Capela / Comunidade</label>
            <input 
              type="text" 
              placeholder="Ex: Capela de São Judas Tadeu" 
              className="form-control"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Endereço Completo</label>
            <input 
              type="text" 
              placeholder="Ex: Rua das Flores, 123 - Bairro Jardim" 
              className="form-control"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Breve Descrição / Histórico (Opcional)</label>
            <textarea 
              rows="2" 
              placeholder="Ex: Comunidade fundada nos anos 80, festejo em Outubro..." 
              className="form-control"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            ></textarea>
          </div>

          <hr style={styles.divider} />

          {/* Manage mass times list */}
          <div className="form-group">
            <label>Adicionar Horário de Missa</label>
            <div style={styles.addTimeRow}>
              <input 
                type="text" 
                placeholder="Ex: Domingo 18:00, Quinta 19:30" 
                className="form-control"
                style={{ flex: 1 }}
                value={newMassTime}
                onChange={(e) => setNewMassTime(e.target.value)}
              />
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleAddMassTime}
                style={{ padding: '0.75rem 1rem' }}
              >
                Adicionar
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Escreva o dia da semana e a hora (Ex: Sábado 19:00).
            </span>
          </div>

          <div style={styles.formMassTimesContainer}>
            <label style={styles.massTimesListLabel}>Horários Adicionados:</label>
            <div style={styles.formTimesList}>
              {formMassTimes.map(time => (
                <div key={time} style={styles.formTimeBadge}>
                  <span>{time}</span>
                  <button 
                    type="button" 
                    style={styles.removeTimeBtn} 
                    onClick={() => handleRemoveMassTime(time)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {formMassTimes.length === 0 && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Nenhum horário adicionado ainda.
                </span>
              )}
            </div>
          </div>

          <div style={styles.formActions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar Capela
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const styles = {
  chapelCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  chapelIconWrapper: {
    padding: '0.5rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
  },
  headerActions: {
    display: 'flex',
    gap: '0.35rem',
  },
  actionBtn: (color) => ({
    background: 'rgba(0,0,0,0.3)',
    border: `1px solid ${color}30`,
    color: color,
    borderRadius: '4px',
    padding: '0.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  }),
  chapelName: {
    fontSize: '1.25rem',
    color: 'var(--color-text-primary)',
    marginBottom: '0.5rem',
  },
  chapelDescription: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.45',
    marginBottom: '0.75rem',
  },
  chapelAddress: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginTop: 'auto',
  },
  divider: {
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    margin: '1rem 0',
  },
  massTimesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  massSectionTitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    fontWeight: '600',
  },
  massTimesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  massTimeTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
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
  addTimeRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  formMassTimesContainer: {
    marginTop: '0.5rem',
  },
  massTimesListLabel: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    fontWeight: '600',
    display: 'block',
    marginBottom: '0.5rem',
  },
  formTimesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    minHeight: '40px',
    padding: '0.5rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
  },
  formTimeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color-active)',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    color: 'var(--color-text-primary)',
  },
  removeTimeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-absent)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
  }
};
