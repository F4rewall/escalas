import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
      <div 
        className="glass-panel modal-container" 
        style={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={styles.body}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 10, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'overlayIn var(--transition-fast) forwards',
    padding: '1rem',
  },
  modalContent: {
    width: '100%',
    maxWidth: '550px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    overflow: 'hidden',
    animation: 'modalIn var(--transition-normal) cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-display)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-fast)',
  },
  body: {
    padding: '1.5rem',
    overflowY: 'auto',
    flex: 1,
  }
};
