import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, Check } from 'lucide-react';

interface AutoVersionOverlayProps {
  show: boolean;
  newVersion: number;
  fromStatus: string;
  onComplete: () => void;
}

export function AutoVersionOverlay({ show, newVersion, fromStatus, onComplete }: AutoVersionOverlayProps) {
  const [phase, setPhase] = useState<'creating' | 'done'>('creating');

  useEffect(() => {
    if (!show) {
      setPhase('creating');
      return;
    }
    setPhase('creating');
    const t1 = setTimeout(() => setPhase('done'), 3500);
    return () => { clearTimeout(t1); };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '40px 48px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)',
              textAlign: 'center',
              maxWidth: '420px',
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated background gradient */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: phase === 'done'
                  ? 'linear-gradient(90deg, #059669, #10B981, #34D399)'
                  : 'linear-gradient(90deg, #1B6EF3, #3B82F6, #60A5FA, #3B82F6, #1B6EF3)',
                backgroundSize: phase === 'done' ? '100% 100%' : '200% 100%',
                transition: 'background 400ms ease',
              }}
            >
              {phase === 'creating' && (
                <motion.div
                  animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(90deg, #1B6EF3, #3B82F6, #60A5FA, #93C5FD, #60A5FA, #3B82F6, #1B6EF3)',
                    backgroundSize: '200% 100%',
                  }}
                />
              )}
            </motion.div>

            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <AnimatePresence mode="wait">
                {phase === 'creating' ? (
                  <motion.div
                    key="creating"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      backgroundColor: '#EFF6FF', border: '2px solid #BFDBFE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <GitBranch style={{ width: '24px', height: '24px', color: '#1D4ED8' }} />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      backgroundColor: '#D1FAE5', border: '2px solid #6EE7B7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Check style={{ width: '24px', height: '24px', color: '#059669' }} strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Title */}
            <AnimatePresence mode="wait">
              {phase === 'creating' ? (
                <motion.div
                  key="creating-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    fontSize: '18px', fontWeight: 700, color: '#1E40AF',
                    lineHeight: 1.3, marginBottom: '8px',
                  }}>
                    Creating V{newVersion} Draft...
                  </div>
                  <div style={{
                    fontSize: '13px', color: '#6B7280', lineHeight: 1.5,
                  }}>
                    A material change was detected. Auto-creating a new draft version from{' '}
                    <span style={{ fontWeight: 600, color: '#374151' }}>{fromStatus}</span>.
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="done-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{
                    fontSize: '18px', fontWeight: 700, color: '#065F46',
                    lineHeight: 1.3, marginBottom: '8px',
                  }}>
                    V{newVersion} Draft Created
                  </div>
                  <div style={{
                    fontSize: '13px', color: '#6B7280', lineHeight: 1.5,
                  }}>
                    You're now editing Version {newVersion} as a new Draft.
                    <br />
                    Further material changes will accumulate in this version.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Click to dismiss hint */}
            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                style={{ marginTop: '24px' }}
              >
                <button
                  onClick={() => onComplete()}
                  style={{
                    height: '36px', padding: '0 28px',
                    fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
                    border: 'none', borderRadius: '8px',
                    backgroundColor: '#059669', cursor: 'pointer',
                    transition: 'all 150ms ease',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#047857'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(5,150,105,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(5,150,105,0.3)'; }}
                >
                  Continue
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}