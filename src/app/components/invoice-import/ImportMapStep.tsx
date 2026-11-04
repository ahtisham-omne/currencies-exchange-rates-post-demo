/* ── Step 3 · Map columns (spec S4, simplified 9/15/26 PM) ────────────
 * One slim row per Omne field: field name first (what we need), then
 * the source column it reads from. Unmapped required fields float to
 * the top with an orange accent. Unmatched source columns wait in a
 * band at the top of the field card as draggable chips: drag one onto
 * a field row, or click it and then click the field (two-tap mapping for
 * trackpad users). Chips and dropdown options carry a sample value
 * from the uploaded file so a cryptic header is never a guess. Field
 * hints live in hover tooltips instead of sub-lines.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, GripVertical, MousePointerClick, Save, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/app/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/app/components/ui/select';
import { objectSpec, type ImportObjectKey, type ImportRunConfig } from './importModel';
import type { UploadsState } from './ImportUploadStep';
import { activeObjects, mappingGateNotes } from './ImportUploadStep';

const PROFILE_STORAGE_KEY = 'omnesoft:invoice-import:mapping-profiles';

interface MappingProfile {
  name: string;
  /** object → field → source header NAME (names survive column reorder). */
  byObject: Partial<Record<ImportObjectKey, Record<string, string>>>;
}

function loadProfiles(): MappingProfile[] {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MappingProfile[];
  } catch { /* ignore */ }
  return [];
}

function saveProfilesToStorage(profiles: MappingProfile[]) {
  try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

const NOT_MAPPED = '__not_mapped__';

export function ImportMapStep({
  config,
  uploads,
  onMappingChange,
}: {
  config: ImportRunConfig;
  uploads: UploadsState;
  onMappingChange: (key: ImportObjectKey, mapping: Record<string, number>) => void;
}) {
  const keys = activeObjects(config).filter((k) => uploads[k]);
  const [activeKey, setActiveKey] = useState<ImportObjectKey>(keys[0] ?? 'invoices');
  const [profiles, setProfiles] = useState<MappingProfile[]>(loadProfiles);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const dragChipRef = useRef<number | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const [draggingChip, setDraggingChip] = useState(false);
  // Click-to-place: a clicked chip stays "armed" until a field takes it.
  const [armedChip, setArmedChip] = useState<number | null>(null);

  const upload = uploads[activeKey];
  const spec = objectSpec(activeKey);

  const { orderedFields, notImported } = useMemo(() => {
    if (!upload) return { orderedFields: [], notImported: [] as { name: string; index: number }[] };
    const unmappedRequired = spec.fields.filter((f) => f.required && upload.mapping[f.key] === -1);
    const rest = spec.fields.filter((f) => !(f.required && upload.mapping[f.key] === -1));
    const used = new Set(Object.values(upload.mapping).filter((i) => i >= 0));
    const notImported = upload.parsed.headers
      .map((name, index) => ({ name, index }))
      .filter((h) => !used.has(h.index));
    return { orderedFields: [...unmappedRequired, ...rest], notImported };
  }, [upload, spec]);

  /** First non-empty cell per source column, the "what does this header
   *  actually hold" answer, shown on chips and dropdown options. */
  const samples = useMemo(() => {
    if (!upload) return [] as string[];
    return upload.parsed.headers.map((_, col) => {
      for (const row of upload.parsed.rows.slice(0, 20)) {
        const v = (row[col] ?? '').trim();
        if (v) return v.length > 24 ? `${v.slice(0, 24)}…` : v;
      }
      return '';
    });
  }, [upload]);

  // Escape disarms a clicked chip; switching objects drops it too.
  useEffect(() => {
    if (armedChip === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmedChip(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armedChip]);
  useEffect(() => { setArmedChip(null); }, [activeKey]);

  if (keys.length === 0 || !upload) return null;

  const targeting = draggingChip || armedChip !== null;
  const armedName = armedChip !== null ? upload.parsed.headers[armedChip] : null;

  const setField = (fieldKey: string, headerIdx: number) => {
    const next = { ...upload.mapping };
    // A source column feeds one field at a time: steal it if taken.
    if (headerIdx >= 0) {
      for (const [f, idx] of Object.entries(next)) {
        if (idx === headerIdx && f !== fieldKey) next[f] = -1;
      }
    }
    next[fieldKey] = headerIdx;
    onMappingChange(activeKey, next);
  };

  const saveProfile = (name: string) => {
    if (!name.trim()) return;
    const byObject: MappingProfile['byObject'] = {};
    for (const k of keys) {
      const u = uploads[k];
      if (!u) continue;
      const fieldToHeader: Record<string, string> = {};
      for (const [f, idx] of Object.entries(u.mapping)) {
        if (idx >= 0) fieldToHeader[f] = u.parsed.headers[idx];
      }
      byObject[k] = fieldToHeader;
    }
    const next = [...profiles.filter((p) => p.name !== name.trim()), { name: name.trim(), byObject }];
    setProfiles(next);
    saveProfilesToStorage(next);
    toast.success('Mapping profile saved', { description: 'A migration is never one file. The third upload should not be a remap.' });
    setProfileOpen(false);
    setProfileName('');
  };

  const applyProfile = (name: string) => {
    const profile = profiles.find((p) => p.name === name);
    if (!profile) return;
    let applied = 0;
    for (const k of keys) {
      const u = uploads[k];
      const fieldToHeader = profile.byObject[k];
      if (!u || !fieldToHeader) continue;
      const next: Record<string, number> = { ...u.mapping };
      for (const f of objectSpec(k).fields) {
        const headerName = fieldToHeader[f.key];
        const idx = headerName ? u.parsed.headers.indexOf(headerName) : -1;
        if (idx >= 0) { next[f.key] = idx; applied += 1; }
      }
      onMappingChange(k, next);
    }
    toast.success(`Applied "${name}"`, { description: `${applied} fields matched from the saved profile.` });
  };

  const profileControls = (
    <div className="flex items-center gap-1.5 shrink-0">
      {profiles.length > 0 && (
        <Select onValueChange={applyProfile}>
          <SelectTrigger className="h-8 text-[12px] bg-white w-[170px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
              Saved Profiles
            </span>
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            Save Profile
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={4} className="w-[260px] p-3 rounded-xl border-border shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
          <p className="text-[12px] text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
            Profile Name<span className="text-red-500 ml-0.5">*</span>
          </p>
          <Input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveProfile(profileName); }}
            placeholder="e.g. QuickBooks export"
            className="h-8 text-[12px] bg-white"
            autoFocus
          />
          <button
            type="button"
            disabled={!profileName.trim()}
            onClick={() => saveProfile(profileName)}
            className="mt-2.5 w-full h-8 rounded-lg text-[12px] text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer border-0"
            style={{ fontWeight: 600 }}
          >
            Save This Mapping
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Object tabs, only when the run actually carries more than one
          file; a lone pill is furniture, not navigation. */}
      {keys.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {keys.map((k) => {
            const kSpec = objectSpec(k);
            const u = uploads[k]!;
            const missing = kSpec.fields.filter((f) => f.required && u.mapping[f.key] === -1).length + mappingGateNotes(k, u).length;
            const selected = activeKey === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveKey(k)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] transition-colors cursor-pointer ${
                  selected ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={{ fontWeight: 500 }}
              >
                {kSpec.title}
                {missing > 0 ? (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-orange-100 text-orange-700 text-[10px] " style={{ fontWeight: 600 }}>
                    {missing}
                  </span>
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Conditional gates the required flags cannot express: an invoice
          file needs an amount column, a payment file needs a join column. */}
      {mappingGateNotes(activeKey, upload).map((note) => (
        <div key={note} className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/70 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <p className="text-[12px] text-orange-800" style={{ fontWeight: 500 }}>
            Still Needed · {note}
          </p>
        </div>
      ))}

      {/* One slim row per field, flowing into two columns so the card
          fills the modal instead of leaving a dead right half. The card
          opens with the source-column band: what is left to place, the
          chips themselves, and the profile controls, one surface instead
          of three stacked boxes. */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div
          className={`flex items-start justify-between gap-3 px-4 py-1.5 border-b border-border transition-colors ${
            draggingChip || armedChip !== null ? 'bg-accent/40' : 'bg-white'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="h-8 flex items-center">
              {armedName ? (
                <p className="inline-flex items-center gap-1.5 text-[11px] text-primary truncate" style={{ fontWeight: 500 }}>
                  <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Now click the field that should read <span style={{ fontWeight: 600 }}>{armedName}</span>, or press Esc
                  </span>
                </p>
              ) : notImported.length > 0 ? (
                <p className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 400 }}>
                  <span className="text-slate-600" style={{ fontWeight: 600 }}>{notImported.length} not imported</span>
                  <span className="hidden sm:inline">{' '}· drag a column onto a field, or click it, then click the field</span>
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 truncate" style={{ fontWeight: 500 }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  Every source column is mapped, nothing from your file is left behind
                </p>
              )}
            </div>
            {notImported.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 pb-1.5">
                {notImported.map((h) => {
                  const armed = armedChip === h.index;
                  return (
                    <button
                      key={h.index}
                      type="button"
                      draggable
                      title={samples[h.index] ? `Sample: ${samples[h.index]}` : undefined}
                      onDragStart={(e) => {
                        dragChipRef.current = h.index;
                        setDraggingChip(true);
                        setArmedChip(null);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', h.name);
                      }}
                      onDragEnd={() => { dragChipRef.current = null; setDraggingChip(false); setDragOverField(null); }}
                      onClick={() => setArmedChip((v) => (v === h.index ? null : h.index))}
                      className={`inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 border rounded-md text-[11px] cursor-grab active:cursor-grabbing transition-all select-none ${
                        armed
                          ? 'border-primary bg-accent text-primary ring-2 ring-primary/15'
                          : 'bg-white border-slate-200 text-slate-500 shadow-sm hover:border-primary/40 hover:text-slate-700'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      <GripVertical className={`w-3 h-3 ${armed ? 'text-primary/50' : 'text-slate-300'}`} />
                      {h.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {profileControls}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-x-3 lg:gap-x-6 px-4 py-2 bg-slate-50 border-b border-border">
          <p className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Omne Field</p>
          <p className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Reads From</p>
          <p className="hidden lg:block text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Omne Field</p>
          <p className="hidden lg:block text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Reads From</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-0 lg:[&>*:nth-child(odd)]:border-r lg:[&>*:nth-child(odd)]:border-slate-100">
          {orderedFields.map((f) => {
            const idx = upload.mapping[f.key];
            const needsAttention = f.required && idx === -1;
            const isDropTarget = dragOverField === f.key;
            return (
              <div
                key={f.key}
                className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 px-4 py-1.5 border-b border-slate-100 transition-all ${
                  isDropTarget
                    ? 'bg-accent ring-1 ring-inset ring-primary/40'
                    : needsAttention
                      ? 'bg-orange-50/50'
                      : 'bg-white'
                } ${targeting ? 'cursor-copy hover:bg-accent/60' : ''}`}
                onDragOver={(e) => {
                  if (dragChipRef.current !== null) {
                    e.preventDefault();
                    setDragOverField(f.key);
                  }
                }}
                onDragLeave={() => setDragOverField((v) => (v === f.key ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragChipRef.current !== null) setField(f.key, dragChipRef.current);
                  dragChipRef.current = null;
                  setDragOverField(null);
                }}
                // Armed chip lands on whichever part of the row is clicked;
                // capture the pointer before the Select can open its menu.
                onPointerDownCapture={(e) => {
                  if (armedChip === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setField(f.key, armedChip);
                  setArmedChip(null);
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0" title={f.hint}>
                  {needsAttention && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                  {f.required && idx >= 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 500 }}>
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                </div>
                <Select
                  value={idx >= 0 ? String(idx) : NOT_MAPPED}
                  onValueChange={(v) => setField(f.key, v === NOT_MAPPED ? -1 : Number(v))}
                >
                  <SelectTrigger
                    className={`h-8 text-[12px] w-full transition-colors ${
                      idx >= 0
                        ? 'bg-white'
                        : targeting
                          ? 'bg-white border-dashed border-primary/40 text-slate-400'
                          : needsAttention
                            ? 'bg-white border-orange-200 text-orange-600'
                            : 'bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    {idx >= 0 ? (
                      <span className="truncate text-foreground" title={samples[idx] ? `Sample: ${samples[idx]}` : undefined}>
                        {upload.parsed.headers[idx]}
                      </span>
                    ) : (
                      <span>Not Mapped</span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    <SelectItem value={NOT_MAPPED}>
                      <span className="text-slate-400">Not Mapped</span>
                    </SelectItem>
                    {upload.parsed.headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)} textValue={h}>
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="truncate">{h}</span>
                          {samples[i] && (
                            <span className="text-[10.5px] text-slate-400 truncate" style={{ fontWeight: 400 }}>
                              e.g. {samples[i]}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
