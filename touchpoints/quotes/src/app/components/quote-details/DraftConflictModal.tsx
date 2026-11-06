import { useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, RotateCcw, FileText, Pencil, X, ArrowRight } from 'lucide-react';

interface DraftConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingDraftVersion: number;
  revertFromVersion: number;
  onOverwrite: () => void;
  onCreateNew: () => void;
}

export function DraftConflictModal({
  isOpen,
  onClose,
  existingDraftVersion,
  revertFromVersion,
  onOverwrite,
  onCreateNew,
}: DraftConflictModalProps) {
  const [hoveredOption, setHoveredOption] = useState<'overwrite' | 'create' | null>(null);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl ring-1 ring-black/5 overflow-hidden w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center">
              <AlertTriangle className="w-[18px] h-[18px] text-warning" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground leading-tight m-0">
                Draft Already Exists
              </h3>
              <span className="text-[12px] text-muted-foreground">
                V{existingDraftVersion} is currently a draft
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info callout */}
        <div className="px-6 py-4">
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-warning/10 border border-warning/30 mb-4">
            <RotateCcw className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-foreground leading-snug">
              You're reverting from <strong>V{revertFromVersion}</strong> but there's already an active draft (<strong>V{existingDraftVersion}</strong>). Choose how to proceed:
            </div>
          </div>

          {/* Option cards */}
          <div className="flex flex-col gap-2">
            {/* Overwrite */}
            <button
              onClick={onOverwrite}
              onMouseEnter={() => setHoveredOption('overwrite')}
              onMouseLeave={() => setHoveredOption(null)}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border-[1.5px] text-left transition-all w-full ${
                hoveredOption === 'overwrite'
                  ? 'border-primary bg-accent'
                  : 'border-border bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  hoveredOption === 'overwrite' ? 'bg-primary/15' : 'bg-muted'
                }`}
              >
                <Pencil
                  className={`w-4 h-4 transition-colors ${
                    hoveredOption === 'overwrite' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground leading-none mb-1 flex items-center gap-1.5">
                  Update Draft V{existingDraftVersion}
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                    Recommended
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  Replace V{existingDraftVersion}'s data with V{revertFromVersion}'s content. Same version number, updated content.
                </div>
              </div>
              <ArrowRight
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  hoveredOption === 'overwrite' ? 'text-primary' : 'text-border'
                }`}
              />
            </button>

            {/* Create new */}
            <button
              onClick={onCreateNew}
              onMouseEnter={() => setHoveredOption('create')}
              onMouseLeave={() => setHoveredOption(null)}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border-[1.5px] text-left transition-all w-full ${
                hoveredOption === 'create'
                  ? 'border-primary bg-accent'
                  : 'border-border bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  hoveredOption === 'create' ? 'bg-primary/15' : 'bg-muted'
                }`}
              >
                <FileText
                  className={`w-4 h-4 transition-colors ${
                    hoveredOption === 'create' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground leading-none mb-1">
                  Create New Draft V{existingDraftVersion + 1}
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  Discard V{existingDraftVersion} draft and create a new version from V{revertFromVersion}.
                </div>
              </div>
              <ArrowRight
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  hoveredOption === 'create' ? 'text-primary' : 'text-border'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/40 flex justify-end">
          <button
            onClick={onClose}
            className="h-8 px-3.5 rounded-md border border-border bg-white text-muted-foreground hover:bg-muted text-[13px] font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
