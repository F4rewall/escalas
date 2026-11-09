import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ShieldAlert, KeyRound, Lock, ArrowRight, Church, Music, BookOpen } from 'lucide-react';

export default function AdminLogin({ setActiveTab }) {
  const { loginAsAdmin } = useContext(AppContext);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const sector = loginAsAdmin(password);
    if (sector) {
      setActiveTab('dashboard'); // Redirect to sector dashboard after login
    } else {
      setError('Senha incorreta. Digite a senha do seu setor (Coroinhas, Música ou Liturgia).');
      setPassword('');
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.loginCard}>
        <div style={styles.iconWrapper}>
          <Lock size={32} style={{ color: 'var(--primary-gold)' }} />
        </div>

        <h2 style={styles.title}>Área do Coordenador</h2>
        <p style={styles.subtitle}>
          Digite a senha exclusiva do seu setor para gerenciar suas escalas, membros e relatórios. Cada coordenador acessa apenas o seu próprio setor.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.5rem', width: '100%' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '999px', backgroundColor: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.3)', color: 'var(--primary-gold)', fontWeight: 600 }}>
            <Church size={12} /> Coroinhas
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '999px', backgroundColor: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.3)', color: '#38bdf8', fontWeight: 600 }}>
            <Music size={12} /> Música
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: '999px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontWeight: 600 }}>
            <BookOpen size={12} /> Liturgia
          </span>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="admin-pass" style={styles.label}>Senha do Setor</label>
            <div style={styles.inputContainer}>
              <KeyRound size={18} style={styles.inputIcon} />
              <input
                id="admin-pass"
                type="password"
                placeholder="Digite a senha do seu setor..."
                className="form-control"
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={styles.submitBtn}>
            Entrar no Painel do Setor <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    minHeight: '60vh',
    animation: 'fadeIn var(--transition-normal)',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '2.5rem 2rem',
    backgroundColor: 'var(--bg-secondary)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconWrapper: {
    padding: '1rem',
    borderRadius: '50%',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    border: '1px solid var(--border-color)',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--color-text-primary)',
    marginBottom: '0.5rem',
    fontFamily: 'var(--font-display)',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.5',
    marginBottom: '1.75rem',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    textAlign: 'left',
    display: 'block',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    marginBottom: '0.35rem',
  },
  inputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--color-text-muted)',
  },
  input: {
    paddingLeft: '2.5rem',
    width: '100%',
  },
  errorContainer: {
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
  },
  submitBtn: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.95rem',
    marginTop: '0.5rem',
  }
};
