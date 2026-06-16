import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  Church, 
  Calendar, 
  Users, 
  LayoutDashboard, 
  FileText, 
  ShieldCheck, 
  Menu, 
  X,
  Lock,
  LogOut
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { userRole, logoutAdmin } = useContext(AppContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = userRole === 'admin';

  // Define nav items based on roles
  const navItems = [];
  if (isAdmin) {
    navItems.push(
      { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
      { id: 'schedules', label: 'Escalas', icon: Calendar },
      { id: 'profiles', label: 'Perfis', icon: Users },
      { id: 'chapels', label: 'Capelas', icon: Church },
      { id: 'reports', label: 'Relatórios', icon: FileText }
    );
  } else {
    // Public sees ONLY scales
    navItems.push(
      { id: 'schedules', label: 'Escalas', icon: Calendar }
    );
  }

  const handleLogout = () => {
    logoutAdmin();
    setActiveTab('schedules'); // Redirect public users to scales
  };

  return (
    <nav className="glass-panel" style={styles.nav}>
      <div style={styles.navContainer}>
        {/* Brand/Logo */}
        <div 
          style={styles.brand} 
          onClick={() => setActiveTab(isAdmin ? 'dashboard' : 'schedules')}
        >
          <img 
            src="/saint_anthony_icon.png" 
            alt="Santo Antônio" 
            style={styles.logoImage} 
          />
          <div>
            <span className="brand-font" style={styles.brandTitle}>SANTO ANTÔNIO</span>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <button 
          className="mobile-nav-toggle"
          style={styles.mobileToggle} 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation Links */}
        <div className={`nav-links-wrapper ${mobileMenuOpen ? 'open' : ''}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.linkButton,
                  ...(isActive ? styles.linkActive : {})
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Mobile-only auth details inside the menu drawer */}
          <div className="mobile-only-auth">
            {isAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <div style={{ ...styles.adminBadge, justifyContent: 'center' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--primary-gold)' }} />
                  <span style={styles.adminText}>Administrador</span>
                </div>
                <button 
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  style={{ ...styles.logoutBtn, justifyContent: 'center', padding: '0.6rem' }}
                >
                  <LogOut size={16} />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setActiveTab('admin-login');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.loginBtn,
                  justifyContent: 'center',
                  padding: '0.6rem',
                  width: '100%',
                  ...(activeTab === 'admin-login' ? styles.loginBtnActive : {})
                }}
              >
                <Lock size={14} />
                <span>Login Adm</span>
              </button>
            )}
          </div>
        </div>

        {/* Authenticated Admin Badge or Login Button (Desktop Only) */}
        <div className="desktop-only-auth" style={styles.authWrapper}>
          {isAdmin ? (
            <div style={styles.adminGroup}>
              <div style={styles.adminBadge}>
                <ShieldCheck size={14} style={{ color: 'var(--primary-gold)' }} />
                <span style={styles.adminText}>Administrador</span>
              </div>
              <button 
                onClick={handleLogout} 
                style={styles.logoutBtn}
                title="Sair do Modo Admin"
              >
                <LogOut size={16} />
                <span style={styles.logoutText}>Sair</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('admin-login')} 
              style={{
                ...styles.loginBtn,
                ...(activeTab === 'admin-login' ? styles.loginBtnActive : {})
              }}
            >
              <Lock size={14} />
              <span>Login Adm</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    borderRadius: '0px 0px 16px 16px',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'var(--bg-secondary)',
  },
  navContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
  },
  logoImage: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '50%',
    border: '1.5px solid var(--primary-gold)',
    boxShadow: '0 0 8px var(--gold-glow)',
    objectFit: 'cover',
  },
  brandTitle: {
    display: 'block',
    fontSize: '1.2rem',
    color: 'var(--color-text-primary)',
    fontWeight: 'bold',
  },
  brandSubtitle: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
  },
  linkButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  linkActive: {
    background: 'rgba(217, 119, 6, 0.1)',
    color: 'var(--primary-gold)',
    boxShadow: 'inset 0 0 10px rgba(217, 119, 6, 0.05)',
  },
  authWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  loginBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'none',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.5rem 0.9rem',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    fontSize: '0.85rem',
    fontWeight: '600',
    transition: 'all var(--transition-fast)',
  },
  loginBtnActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderColor: 'var(--primary-gold)',
    color: 'var(--primary-gold)',
  },
  adminGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  adminBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    border: '1px solid rgba(217, 119, 6, 0.3)',
    borderRadius: '20px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--primary-gold)',
  },
  adminText: {
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'none',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    padding: '0.45rem 0.75rem',
    cursor: 'pointer',
    color: 'var(--color-absent)',
    fontSize: '0.8rem',
    fontWeight: '600',
    transition: 'all var(--transition-fast)',
    backgroundColor: 'var(--color-absent-bg)',
  },
  logoutText: {
    display: 'inline',
  },
  mobileToggle: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    display: 'none',
  }
};
