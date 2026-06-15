import React, { useState, useContext, useEffect } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Schedules from './pages/Schedules';
import Profiles from './pages/Profiles';
import Chapels from './pages/Chapels';
import Reports from './pages/Reports';
import AdminLogin from './pages/AdminLogin';
import './App.css';

function AppContent() {
  const { userRole } = useContext(AppContext);
  const isAdmin = userRole === 'admin';

  const [activeTab, setActiveTab] = useState(() => {
    return userRole === 'admin' ? 'dashboard' : 'schedules';
  });

  // Keep activeTab in sync with role changes (e.g. login/logout)
  useEffect(() => {
    if (userRole === 'admin') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('schedules');
    }
  }, [userRole]);

  const renderActivePage = () => {
    // Route guard: if the user is not admin and is trying to access restricted tabs, fallback to schedules
    const currentTab = (!isAdmin && activeTab !== 'admin-login') ? 'schedules' : activeTab;

    switch (currentTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'schedules':
        return <Schedules />;
      case 'profiles':
        return <Profiles />;
      case 'chapels':
        return <Chapels />;
      case 'reports':
        return <Reports />;
      case 'admin-login':
        return <AdminLogin setActiveTab={setActiveTab} />;
      default:
        return <Schedules />;
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
