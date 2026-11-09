import React, { useState, useContext, useEffect } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Schedules from './pages/Schedules';
import PublicHome from './pages/PublicHome';
import Profiles from './pages/Profiles';
import Chapels from './pages/Chapels';
import Reports from './pages/Reports';
import AdminLogin from './pages/AdminLogin';
import './App.css';

function AppContent() {
  const { userRole, adminSector, loading } = useContext(AppContext);
  const isAdmin = userRole === 'admin';

  const [activeTab, setActiveTab] = useState(() => {
    return userRole === 'admin' ? 'dashboard' : 'principal';
  });

  // Keep activeTab in sync with role changes (e.g. login/logout)
  useEffect(() => {
    if (userRole === 'admin') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('principal');
    }
  }, [userRole, adminSector]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--primary-gold)'
      }}>
        <div className="animate-pulse-slow" style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
          ⛪ Carregando dados da Paróquia...
        </div>
      </div>
    );
  }

  const renderActivePage = () => {
    const publicAllowedTabs = ['principal', 'schedules-coroinhas', 'schedules-musica', 'schedules-liturgia', 'schedules-mece', 'admin-login'];
    const currentTab = (!isAdmin && !publicAllowedTabs.includes(activeTab)) ? 'principal' : activeTab;

    switch (currentTab) {
      case 'principal':
        return <PublicHome setActiveTab={setActiveTab} />;
      case 'schedules-coroinhas':
        return <Schedules sector="coroinhas" />;
      case 'schedules-musica':
        return <Schedules sector="musica" />;
      case 'schedules-liturgia':
        return <Schedules sector="liturgia" />;
      case 'schedules-mece':
        return <Schedules sector="mece" />;
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'schedules':
        return <Schedules sector={adminSector} />;
      case 'profiles':
        return <Profiles />;
      case 'chapels':
        return <Chapels />;
      case 'reports':
        return <Reports />;
      case 'admin-login':
        return <AdminLogin setActiveTab={setActiveTab} />;
      default:
        return <PublicHome setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Ambient background glow orbs */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main className="main-content">
        {renderActivePage()}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <p>© 2026 Paróquia de Santo Antônio. Todos os direitos reservados.</p>
          <p style={styles.footerNote}>Zelo pela Liturgia • Serviço do Altar</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

const styles = {
  footer: {
    padding: '2rem 1rem',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    marginTop: 'auto',
    textAlign: 'center',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.85rem',
  },
  footerNote: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--primary-gold)',
  }
};
