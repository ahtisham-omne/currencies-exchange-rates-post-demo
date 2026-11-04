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
    if (!show) { setPhase('creating'); return; }
    setPhase('creating');
    const t1 = setTimeout(() => setPhase('done'), 3500);
    return () => clearTimeout(t1);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="bg-card"
            style={{ borderRadius: '16px', padding: '40px 48px', boxShadow: 'var(--elevation-3)', textAlign: 'center', maxWidth: '420px', width: '100%', position: 'relative', overflow: 'hidden' }}
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: phase === 'done' ? 'linear-gradient(90deg, #059669, #10B981, #34D399)' : 'linear-gradient(90deg, var(--primary), #3B82F6, #60A5FA, #3B82F6, var(--primary))', backgroundSize: phase === 'done' ? '100% 100%' : '200% 100%' }}
            >
              {phase === 'creating' && <motion.div animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, var(--primary), #3B82F6, #60A5FA, #93C5FD, #60A5FA, #3B82F6, var(--primary))', backgroundSize: '200% 100%' }} />}
            </motion.div>

            <div className="flex justify-center mb-5">
              <AnimatePresence mode="wait">
                {phase === 'creating' ? (
                  <motion.div key="creating" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                    className="w-14 h-14 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
                  >
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
                      <GitBranch className="w-6 h-6 text-primary" />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div key="done" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5', border: '2px solid #6EE7B7' }}
                  >
                    <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                      <Check className="w-6 h-6" style={{ color: '#059669' }} strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {phase === 'creating' ? (
                <motion.div key="creating-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="text-primary" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Creating V{newVersion} Draft...</div>
                  <div className="text-foreground/40" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                    A material change was detected. Auto-creating a new draft version from <span className="text-foreground" style={{ fontWeight: 600 }}>{fromStatus}</span>.
                  </div>
                </motion.div>
              ) : (
                <motion.div key="done-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#065F46', marginBottom: '8px' }}>V{newVersion} Draft Created</div>
                  <div className="text-foreground/40" style={{ fontSize: '13px', lineHeight: 1.5 }}>You're now editing Version {newVersion} as a new Draft.</div>
                </motion.div>
              )}
            </AnimatePresence>

            {phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ marginTop: '24px' }}>
                <button onClick={onComplete} className="text-white rounded-lg transition-colors" style={{ height: '36px', padding: '0 28px', fontSize: '13px', fontWeight: 600, border: 'none', backgroundColor: '#059669', cursor: 'pointer' }}>
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
