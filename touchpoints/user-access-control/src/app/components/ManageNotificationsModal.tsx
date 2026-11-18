import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, ChevronDown, Check, Minus, Mail, Layout, Smartphone,
  ArrowUpRight, Lock, Unlock, User, Shield, Info, BellOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import * as Switch from '@radix-ui/react-switch';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import { toast } from 'sonner';
import { NotificationPreviews, NotificationType } from './NotificationPreviews';
import { HighlightMatch } from './alerts-settings/HighlightMatch';
import { getRoleAlertDefaults } from '../data/predefined-roles';
import { ALERT_ID_TO_MODULE_ID, ALERT_MODULES } from '../data/alerts-data';

/* ── Types ── */
export interface UserAlertItem {
  id: string;
  module: string;
  title: string;
  channels: string[];
  description: string;
  enabled: boolean;
  isMandatory?: boolean;
  whoReceivesDescription?: string;
  assignedThroughRoles: string[];
  preview: {
    emailSubject: string;
    emailBody: string;
    pushText: string;
    inAppTitle: string;
    inAppText: string;
  };
}

/* ── Alert records ──
 * Sourced from the alerts catalog (`data/alerts-data.ts`), which mirrors the
 * alerts module. `module` carries the catalog module's display name so the
 * unscoped (header) view can still group and filter by module. */
const USER_ALERTS: UserAlertItem[] = ALERT_MODULES.flatMap((m) =>
  m.alerts.map((a) => ({ ...a, module: m.name })),
);

const ALL_MODULES = [...new Set(USER_ALERTS.map(a => a.module))];

/**
 * Map an alert to the alerts-module id it belongs to. The catalog owns this
 * relationship, so a module card and its modal always agree on which alerts
 * belong to it.
 */
export function alertGridModuleId(alert: UserAlertItem): string {
  return ALERT_ID_TO_MODULE_ID[alert.id] ?? '';
}

/** All alerts belonging to a given grid module id. Module-scoped views use this
 *  instead of a fixed set so each module card opens its own alerts. */
export function getGridModuleAlerts(moduleId: string): UserAlertItem[] {
  return USER_ALERTS.filter(a => alertGridModuleId(a) === moduleId).map(a => ({ ...a, isMandatory: false }));
}

/* ── Locked (admin-enforced) toggle ── */
/* A forced-on, disabled switch that reveals a tooltip on hover. The switch itself is
   pointer-events-none so the wrapping span receives the hover (disabled controls
   otherwise swallow mouse events and the tooltip never fires). */
function LockedToggle({ variant }: { variant: 'card' | 'detail' }) {
  const isDetail = variant === 'detail';
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="inline-flex cursor-not-allowed">
            <Switch.Root
              checked
              disabled
              className={clsx(
                "bg-green-500 rounded-full relative outline-none opacity-60 flex items-center p-[2px] pointer-events-none",
                isDetail ? "w-11 h-6" : "w-9 h-5"
              )}
            >
              <Switch.Thumb
                className={clsx(
                  "block bg-white rounded-full shadow-sm",
                  isDetail ? "w-5 h-5 translate-x-[20px]" : "w-4 h-4 translate-x-[16px]"
                )}
              />
            </Switch.Root>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            className="bg-white text-gray-600 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-lg z-[160] max-w-[220px]"
          >
            Locked by your admin, can't be toggled off
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/* ── Can Opt-Out? card (reused by single detail + bulk edit) ── */
function OptOutCard({
  value,
  onValueChange,
  disabled,
}: {
  value: 'allowed' | 'locked';
  onValueChange: (v: 'allowed' | 'locked') => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-8 w-1/2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Can Opt-Out?</h3>
          <Tooltip.Provider delayDuration={150}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors outline-none">
                  <Info size={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  align="start"
                  sideOffset={6}
                  className="z-[160] w-[300px] rounded-xl bg-white border border-gray-200 shadow-lg p-3"
                >
                  <p className="text-xs text-gray-600 leading-relaxed mb-2.5">
                    Controls whether users or roles can remove themselves from this alert.
                  </p>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Unlock size={12} className="text-green-600" />
                        <span className="text-xs font-semibold text-gray-900">Allowed</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Roles or users can remove themselves from this alert if they no longer need to receive it.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock size={12} className="text-slate-500" />
                        <span className="text-xs font-semibold text-gray-900">Locked</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Roles or users must continue receiving this alert and cannot remove themselves.
                      </p>
                    </div>
                  </div>
                  <Tooltip.Arrow className="fill-white" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>

        <RadioGroup.Root
          value={value}
          onValueChange={(v) => onValueChange(v as 'allowed' | 'locked')}
          disabled={disabled}
          className="grid grid-cols-2 gap-2.5"
        >
          {/* Allowed */}
          <RadioGroup.Item
            value="allowed"
            className={clsx(
              "px-3 py-2 border rounded-lg flex items-center gap-2 transition-all duration-200 outline-none",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
              value === 'allowed' ? "border-[#16A34A]/50 bg-[#F0FDF4]" : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <span className={clsx(
              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
              value === 'allowed' ? "border-[#16A34A]" : "border-gray-300"
            )}>
              {value === 'allowed' && <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />}
            </span>
            <Unlock size={14} className={value === 'allowed' ? "text-[#16A34A]" : "text-gray-400"} />
            <span className={clsx("text-[13px] font-semibold", value === 'allowed' ? "text-[#15803D]" : "text-gray-700")}>
              Allowed
            </span>
          </RadioGroup.Item>

          {/* Locked */}
          <RadioGroup.Item
            value="locked"
            className={clsx(
              "px-3 py-2 border rounded-lg flex items-center gap-2 transition-all duration-200 outline-none",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
              value === 'locked' ? "border-slate-400/60 bg-white" : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <span className={clsx(
              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
              value === 'locked' ? "border-slate-500" : "border-gray-300"
            )}>
              {value === 'locked' && <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />}
            </span>
            <Lock size={14} className={value === 'locked' ? "text-slate-600" : "text-gray-400"} />
            <span className={clsx("text-[13px] font-semibold", value === 'locked' ? "text-slate-700" : "text-gray-700")}>
              Locked
            </span>
          </RadioGroup.Item>
        </RadioGroup.Root>
      </div>
    </div>
  );
}

/* ── Component ── */
interface ManageNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Admin "viewing alerts for someone else" context (e.g. a user's or role's Alerts tab).
   * When provided, all recipient-facing copy switches from 2nd person ("you") to this name.
   */
  subjectName?: string;
  /**
   * When set, the modal is scoped to a single module: the header reads "Alerts for {moduleName}"
   * and the alert list is that module's own alerts (see getGridModuleAlerts).
   */
  moduleName?: string;
  /** Grid PERMISSION_MODULE id for the scoped module (drives which alerts show). */
  moduleId?: string;
  /**
   * Role scope: when this is a predefined role's alerts, each alert's enabled
   * state reflects that role's default alert set (Pioneer v2.0), and the
   * "receives this alert through Assigned roles" container is hidden.
   */
  roleName?: string;
}

export const ManageNotificationsModal: React.FC<ManageNotificationsModalProps> = ({ isOpen, onClose, subjectName, moduleName, moduleId, roleName }) => {
  const isScoped = !!moduleName;        // module-card context (user/role detail)
  const isThirdPerson = !!subjectName;  // showing alerts for someone else
  const roleAlertDefaults = roleName ? getRoleAlertDefaults(roleName) : undefined;
  const isRoleScope = !!roleAlertDefaults;  // role alerts (vs a user's)

  /* The scoped alert set is the clicked module's own alerts. For a role
   * (predefined or custom), each alert's enabled state is driven by the role's
   * default alert set: alerts the role holds are on (off if the role marks them
   * off-by-default), everything else in the module is off. Toggles stay
   * editable, this only seeds their initial state. */
  const baseAlerts = useMemo(() => {
    if (!isScoped) return USER_ALERTS;
    const moduleAlerts = getGridModuleAlerts(moduleId ?? '');
    if (!roleAlertDefaults) return moduleAlerts;
    const roleAlertMap = new Map(roleAlertDefaults.map(a => [a.name, a.offByDefault]));
    return moduleAlerts.map(a =>
      roleAlertMap.has(a.title)
        ? { ...a, enabled: !roleAlertMap.get(a.title) }
        : { ...a, enabled: false },
    );
  }, [isScoped, moduleId, roleAlertDefaults]);

  /* ── Recipient-aware copy ── */
  const possessive = subjectName ? `${subjectName}'s` : 'your';
  const headerTitle = isScoped ? `Alerts for ${moduleName}` : 'Manage Your Notifications';
  const howReceiveTitle = isThirdPerson ? `How ${subjectName} receives this alert` : 'How you receive this alert';
  const receiveThroughTitle = isThirdPerson ? `${subjectName} Receives This Alert Through` : 'You Receive This Alert Through';
  const whoReceivesFallback = isThirdPerson
    ? `${subjectName} receives this alert based on their assigned roles.`
    : 'You receive this alert based on your assigned roles.';
  const channelDescriptions: Record<'email' | 'in-app' | 'push', string> = {
    email: isThirdPerson
      ? `Notifications are sent directly to ${possessive} email inbox.`
      : 'Notifications are sent directly to your email inbox.',
    'in-app': isThirdPerson
      ? `Notifications appear inside Omne while ${subjectName} is working.`
      : "Notifications appear inside Omne while you're working.",
    push: isThirdPerson
      ? `Notifications are sent to ${possessive} registered devices instantly.`
      : 'Notifications are sent to your registered devices instantly.',
  };

  // Working draft (what the UI edits). Committed snapshots are what actually "saves",
  // edits only persist when the user clicks Save; Cancel/close reverts to the snapshot.
  const [alerts, setAlerts] = useState(baseAlerts);
  const [committedAlerts, setCommittedAlerts] = useState(baseAlerts);
  const [selectedAlertId, setSelectedAlertId] = useState(baseAlerts[0]?.id ?? '');
  /** Per-alert opt-out policy (admin/module view only). Defaults to 'allowed'. */
  const [optOutByAlert, setOptOutByAlert] = useState<Record<string, 'allowed' | 'locked'>>({});
  const [committedOptOut, setCommittedOptOut] = useState<Record<string, 'allowed' | 'locked'>>({});
  /** Bulk-selected alert ids (admin/module view only). */
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('All Modules');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Enabled' | 'Disabled'>('All');
  const [channelFilter, setChannelFilter] = useState<'All' | 'Email' | 'In-App' | 'Push'>('All');
  const [isModuleFilterOpen, setIsModuleFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isChannelFilterOpen, setIsChannelFilterOpen] = useState(false);
  const [isAlertsListScrolled, setIsAlertsListScrolled] = useState(false);
  const [previewType, setPreviewType] = useState<NotificationType>(null);

  // Keep the working alert list in sync with the active scope. `baseAlerts` only
  // changes identity when the modal switches between scoped (Cycle Count) and full.
  useEffect(() => {
    setAlerts(baseAlerts);
    setCommittedAlerts(baseAlerts);
    setSelectedAlertId(baseAlerts[0]?.id ?? '');
    setSelectedBulkIds([]);
    setOptOutByAlert({});
    setCommittedOptOut({});
  }, [baseAlerts]);

  // Clear bulk selection whenever the modal closes.
  useEffect(() => {
    if (!isOpen) setSelectedBulkIds([]);
  }, [isOpen]);

  const closeAllFilters = () => {
    setIsModuleFilterOpen(false);
    setIsStatusFilterOpen(false);
    setIsChannelFilterOpen(false);
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = moduleFilter === 'All Modules' || alert.module === moduleFilter;
      const matchesStatus = statusFilter === 'All' ? true : statusFilter === 'Enabled' ? alert.enabled : !alert.enabled;
      const matchesChannel = channelFilter === 'All' ? true : alert.channels.includes(channelFilter.toLowerCase().replace('-', '-'));
      return matchesSearch && matchesModule && matchesStatus && matchesChannel;
    });
  }, [alerts, searchQuery, moduleFilter, statusFilter, channelFilter]);

  // Group by module for "All Modules" view
  const groupedAlerts = useMemo(() => {
    if (moduleFilter !== 'All Modules') return null;
    const groups: { module: string; alerts: UserAlertItem[] }[] = [];
    const moduleOrder: string[] = [];
    filteredAlerts.forEach(a => {
      if (!moduleOrder.includes(a.module)) moduleOrder.push(a.module);
    });
    moduleOrder.forEach(mod => {
      groups.push({ module: mod, alerts: filteredAlerts.filter(a => a.module === mod) });
    });
    return groups;
  }, [filteredAlerts, moduleFilter]);

  // Module filter options come from the active alert set (Cycle Count only when scoped).
  const moduleOptions = useMemo(() => [...new Set(alerts.map(a => a.module))], [alerts]);

  const selectedAlert = alerts.find(a => a.id === selectedAlertId) || filteredAlerts[0] || alerts[0];

  // Opt-out policy for the selected alert. Mandatory alerts are always locked.
  const optOutValue: 'allowed' | 'locked' = selectedAlert?.isMandatory
    ? 'locked'
    : (optOutByAlert[selectedAlert?.id] ?? 'allowed');

  const setOptOut = (value: 'allowed' | 'locked') => {
    if (!selectedAlert || selectedAlert.isMandatory) return;
    setOptOutByAlert(prev => ({ ...prev, [selectedAlert.id]: value }));
  };

  /* ── Bulk edit (admin/module view) ── */
  const isBulkMode = isScoped && selectedBulkIds.length > 0;
  const bulkSelected = useMemo(
    () => alerts.filter(a => selectedBulkIds.includes(a.id)),
    [alerts, selectedBulkIds]
  );
  const allFilteredSelected = filteredAlerts.length > 0 && filteredAlerts.every(a => selectedBulkIds.includes(a.id));
  const someFilteredSelected = filteredAlerts.some(a => selectedBulkIds.includes(a.id));

  const toggleBulkSelect = (id: string) =>
    setSelectedBulkIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedBulkIds(allFilteredSelected ? [] : filteredAlerts.map(a => a.id));

  // Staged status selection for the bulk Enable All / Disable All buttons.
  const bulkEnableActive = bulkSelected.length > 0 && bulkSelected.every(a => a.enabled);
  const bulkDisableActive = bulkSelected.length > 0 && bulkSelected.every(a => !a.enabled);

  const bulkSetEnabled = (enabled: boolean) => {
    setAlerts(prev => prev.map(a => (selectedBulkIds.includes(a.id) ? { ...a, enabled } : a)));
  };

  /** 'all' | 'some' | 'none': how many selected alerts have the channel. */
  const bulkChannelState = (channel: string): 'all' | 'some' | 'none' => {
    if (bulkSelected.length === 0) return 'none';
    const count = bulkSelected.filter(a => a.channels.includes(channel)).length;
    return count === bulkSelected.length ? 'all' : count > 0 ? 'some' : 'none';
  };

  const bulkToggleChannel = (channel: string) => {
    const enable = bulkChannelState(channel) !== 'all'; // enable for all unless all already have it
    setAlerts(prev => prev.map(a => {
      if (!selectedBulkIds.includes(a.id)) return a;
      const has = a.channels.includes(channel);
      if (enable && !has) return { ...a, channels: [...a.channels, channel] };
      if (!enable && has) return { ...a, channels: a.channels.filter(c => c !== channel) };
      return a;
    }));
  };

  const bulkOptOut: 'allowed' | 'locked' =
    bulkSelected.length > 0 && bulkSelected.every(a => (optOutByAlert[a.id] ?? 'allowed') === 'locked')
      ? 'locked'
      : 'allowed';

  const setBulkOptOut = (value: 'allowed' | 'locked') => {
    setOptOutByAlert(prev => {
      const next = { ...prev };
      selectedBulkIds.forEach(id => { next[id] = value; });
      return next;
    });
  };

  const disableAllAlerts = () => {
    setAlerts(prev => prev.map(a => ({ ...a, enabled: false })));
  };

  const toggleEnabled = (checked: boolean, alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert?.isMandatory) return;
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, enabled: checked } : a));
  };

  const toggleChannel = (channel: string) => {
    if (selectedAlert.isMandatory) return;
    setAlerts(prev => prev.map(alert => {
      if (alert.id === selectedAlert.id) {
        const newChannels = alert.channels.includes(channel)
          ? alert.channels.filter(c => c !== channel)
          : [...alert.channels, channel];
        return { ...alert, channels: newChannels };
      }
      return alert;
    }));
  };

  // Toggle a channel for a specific alert (used by the clickable icons in the list cards).
  const toggleChannelForAlert = (alertId: string, channel: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id !== alertId || a.isMandatory) return a;
      const channels = a.channels.includes(channel)
        ? a.channels.filter(c => c !== channel)
        : [...a.channels, channel];
      return { ...a, channels };
    }));
  };

  // Commit the working draft (Save) or discard it (Cancel / close).
  const handleSave = () => {
    setCommittedAlerts(alerts);
    setCommittedOptOut(optOutByAlert);
    setSelectedBulkIds([]);
    toast.success('Changes saved', { duration: 2000 });
    onClose();
  };

  const handleCancel = () => {
    setAlerts(committedAlerts);
    setOptOutByAlert(committedOptOut);
    setSelectedBulkIds([]);
    onClose();
  };

  const renderAlertCard = (alert: UserAlertItem) => {
    const isActive = selectedAlertId === alert.id;
    const isChecked = selectedBulkIds.includes(alert.id);
    return (
      <div
        key={alert.id}
        className={clsx(
          "relative rounded-lg cursor-pointer transition-all duration-200 border group",
          isActive
            ? "bg-[#F0F7FF] border-[#0E69E2]/40 shadow-sm"
            : isChecked
              ? "bg-[#F0F7FF]/60 border-[#0E69E2]/30 shadow-sm"
              : alert.enabled ? "bg-white hover:bg-gray-50 border-gray-200 shadow-sm" : "bg-[#FCFDFD] border-gray-300 border-dashed shadow-sm"
        )}
        onClick={() => setSelectedAlertId(alert.id)}
      >
        {isActive && (
          <div className="absolute top-1/2 -right-[7px] -translate-y-1/2 w-3.5 h-3.5 border-t border-r border-[#0E69E2]/40 rotate-45 z-10" style={{ backgroundColor: '#f0f7ff' }} />
        )}
        <div className="p-3.5 flex gap-3 items-start">
          {isScoped && (
            <div onClick={(e) => e.stopPropagation()} className="pt-0.5 shrink-0">
              <Checkbox.Root
                checked={isChecked}
                onCheckedChange={() => toggleBulkSelect(alert.id)}
                className={clsx(
                  "w-[18px] h-[18px] border rounded flex items-center justify-center transition-colors",
                  isChecked ? "bg-[#0E69E2] border-[#0E69E2]" : "bg-white border-gray-300"
                )}
              >
                <Checkbox.Indicator className="text-white">
                  <Check size={12} strokeWidth={3} />
                </Checkbox.Indicator>
              </Checkbox.Root>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2.5">
              <h3 className={clsx("text-[13px] font-semibold leading-tight", alert.enabled ? "text-gray-900" : "text-gray-500")}>
                <HighlightMatch text={alert.title} query={searchQuery} />
              </h3>
            </div>
            <div className="flex items-center justify-between h-6">
              <Tooltip.Provider delayDuration={200}>
                <div className="flex items-center gap-2">
                  {(['email', 'in-app', 'push'] as const).map(channel => {
                    const Icon = channel === 'email' ? Mail : channel === 'in-app' ? Layout : Smartphone;
                    const has = alert.channels.includes(channel);
                    const locked = alert.isMandatory;
                    const channelLabel = channel === 'email' ? 'Email Notification' : channel === 'in-app' ? 'In-App Notification' : 'Push Notification';
                    const tooltipText = locked
                      ? 'Locked by your admin'
                      : `${has ? 'Disable' : 'Enable'} ${channelLabel}`;
                    return (
                      <Tooltip.Root key={channel}>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (!locked) toggleChannelForAlert(alert.id, channel); }}
                            className={clsx(
                              "w-6 h-6 flex items-center justify-center rounded border transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none",
                              locked ? "cursor-not-allowed" : "cursor-pointer",
                              has
                                ? (alert.enabled ? "bg-[#0E69E2]/10 border-[#0E69E2]/30 text-[#0E69E2]" : "bg-gray-50 border-gray-200 text-gray-400")
                                : "bg-white border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400"
                            )}
                          >
                            <Icon size={14} strokeWidth={2} />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            sideOffset={5}
                            className="bg-white text-gray-600 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-lg z-[160]"
                          >
                            {tooltipText}
                            <Tooltip.Arrow className="fill-white" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    );
                  })}
                </div>
              </Tooltip.Provider>
              <div onClick={(e) => e.stopPropagation()}>
                {alert.isMandatory ? (
                    <LockedToggle variant="card" />
                ) : (
                  <Switch.Root
                    checked={alert.enabled}
                    onCheckedChange={(c) => toggleEnabled(c, alert.id)}
                    className="w-9 h-5 bg-gray-200 rounded-full relative data-[state=checked]:bg-green-500 outline-none cursor-pointer transition-colors flex items-center p-[2px]"
                  >
                    <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0 will-change-transform data-[state=checked]:translate-x-[16px]" />
                  </Switch.Root>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFilterDropdown = (
    label: string,
    value: string,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    options: string[],
    onSelect: (v: string) => void,
    defaultLabel: string,
    width: string = 'w-36'
  ) => (
    <div className="relative">
      <button
        onClick={() => { closeAllFilters(); setIsOpen(!isOpen); }}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
          value !== defaultLabel ? "bg-[#0E69E2]/10 border-[#0E69E2]/30 text-[#0E69E2]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
        )}
      >
        {value === defaultLabel ? label : value} <ChevronDown size={12} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full mt-1 left-0 ${width} bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col max-h-[280px] overflow-y-auto`}>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onSelect(opt); setIsOpen(false); }}
                className={clsx(
                  "text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap",
                  value === opt ? "font-medium text-[#0E69E2] bg-[#0E69E2]/10" : "text-gray-700"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Build a preview-compatible alert object for NotificationPreviews
  const previewAlert = selectedAlert ? {
    id: 0,
    title: selectedAlert.title,
    channels: selectedAlert.channels,
    description: selectedAlert.description,
    enabled: selectedAlert.enabled,
    preview: selectedAlert.preview,
  } : null;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                onClick={handleCancel}
              />
              <div className="fixed inset-0 z-[101] flex items-center justify-center p-6 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                  className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden pointer-events-auto"
                  style={{ width: 1320, maxWidth: "100%", height: 900, maxHeight: "100%" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="h-[60px] flex items-center justify-between px-6 border-b border-gray-200 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
                    </div>
                    <div className="flex items-center gap-1">
                      {isScoped && (
                        <button
                          onClick={disableAllAlerts}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 text-sm font-medium text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <BellOff size={16} /> Disable All Alerts
                        </button>
                      )}
                      <button
                        onClick={handleCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="flex flex-1 min-h-0 bg-[#F5F6F8]">
                    {/* Left Column */}
                    <div className="w-[352px] bg-[#F5F6F8] flex flex-col relative z-20">
                      <div className={clsx(
                        "p-4 pb-2 space-y-3 sticky top-0 bg-[#F5F6F8] transition-shadow duration-300 z-10",
                        isAlertsListScrolled && "shadow-sm border-b border-gray-100"
                      )}>
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Search alerts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E69E2] focus:ring-2 focus:ring-[#0E69E2]/20 transition-all"
                          />
                        </div>

                        {/* Filters: Module is hidden in module-scoped (admin) view */}
                        <div className="flex items-center gap-1.5">
                          {!isScoped && renderFilterDropdown('Module', moduleFilter, isModuleFilterOpen, setIsModuleFilterOpen, ['All Modules', ...moduleOptions], (v) => setModuleFilter(v), 'All Modules', 'w-44')}
                          {renderFilterDropdown('Status', statusFilter, isStatusFilterOpen, setIsStatusFilterOpen, ['All', 'Enabled', 'Disabled'], (v) => setStatusFilter(v as any), 'All', 'w-32')}
                          {renderFilterDropdown('Channels', channelFilter, isChannelFilterOpen, setIsChannelFilterOpen, ['All', 'Email', 'In-App', 'Push'], (v) => setChannelFilter(v as any), 'All', 'w-32')}
                        </div>


                      </div>

                      {/* Alert List */}
                      <div
                        onScroll={(e) => setIsAlertsListScrolled(e.currentTarget.scrollTop > 10)}
                        className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-none"
                      >
                        {filteredAlerts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="w-8 h-8 text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500 font-medium">No Alerts Found</p>
                            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                          </div>
                        ) : isScoped ? (
                          <>
                            {/* Select-all row (replaces the module group title) */}
                            <div className="flex items-center gap-2.5 px-1 pt-1 pb-2">
                              <Checkbox.Root
                                checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                                onCheckedChange={toggleSelectAll}
                                className={clsx(
                                  "w-[18px] h-[18px] border rounded flex items-center justify-center transition-colors shrink-0",
                                  allFilteredSelected || someFilteredSelected ? "bg-[#0E69E2] border-[#0E69E2]" : "bg-white border-gray-300"
                                )}
                              >
                                <Checkbox.Indicator className="text-white">
                                  {allFilteredSelected ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                                </Checkbox.Indicator>
                              </Checkbox.Root>
                              <span className="text-sm font-medium text-gray-700">
                                {selectedBulkIds.length > 0
                                  ? `Selected ${selectedBulkIds.length} ${selectedBulkIds.length === 1 ? 'Alert' : 'Alerts'}`
                                  : `Showing ${filteredAlerts.length} alerts`}
                              </span>
                            </div>
                            {filteredAlerts.map(renderAlertCard)}
                          </>
                        ) : groupedAlerts ? (
                          groupedAlerts.map(group => (
                            <div key={group.module}>
                              <div className="px-1 pt-3 pb-1.5 first:pt-0">
                                <span className="text-sm font-medium text-gray-600">
                                  {group.module}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {group.alerts.map(renderAlertCard)}
                              </div>
                            </div>
                          ))
                        ) : (
                          filteredAlerts.map(renderAlertCard)
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex-1 bg-white flex flex-col overflow-hidden border-l border-gray-200">
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-visible">
                          {isBulkMode ? (
                            <div className="animate-in fade-in duration-300">
                              {/* Bulk header */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <h2 className="text-xl font-semibold text-gray-900">Bulk Edit Mode</h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  {selectedBulkIds.length} {selectedBulkIds.length === 1 ? 'Alert' : 'Alerts'} Selected
                                </span>
                              </div>
                              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                Changes made here will replace existing settings for the selected alerts, including status, delivery channels, and opt-out preference.
                              </p>

                              {/* Selected chips */}
                              <div className="flex flex-wrap gap-2 mb-5">
                                {bulkSelected.map(a => (
                                  <span key={a.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md text-xs font-medium bg-[#EDF4FF] text-[#0A77FF] border border-[#0A77FF]/10">
                                    {a.title}
                                    <button
                                      onClick={() => toggleBulkSelect(a.id)}
                                      className="hover:bg-[#0A77FF]/10 rounded p-0.5 transition-colors"
                                      aria-label={`Remove ${a.title}`}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>

                              <div className="border-t border-gray-100 mb-6" />

                              {/* Alert Status */}
                              <div className="border border-gray-200 rounded-xl bg-gray-50/40 p-4 flex items-center justify-between mb-8">
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">Alert Status</h3>
                                  <p className="text-xs text-gray-500 mt-0.5">Set status for all selected alerts</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => bulkSetEnabled(true)}
                                    className={clsx(
                                      "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border rounded-lg transition-colors",
                                      bulkEnableActive
                                        ? "bg-[#F0FDF4] border-[#16A34A]/50 text-[#15803D]"
                                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                    )}
                                  >
                                    <Check size={14} /> Enable All
                                  </button>
                                  <button
                                    onClick={() => bulkSetEnabled(false)}
                                    className={clsx(
                                      "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border rounded-lg transition-colors",
                                      bulkDisableActive
                                        ? "bg-slate-100 border-slate-400/60 text-slate-700"
                                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                    )}
                                  >
                                    <X size={14} /> Disable All
                                  </button>
                                </div>
                              </div>

                              {/* Bulk Delivery Channels */}
                              <div className="mb-8">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">Bulk Delivery Channels</h3>
                                <div className="grid grid-cols-3 gap-4">
                                  {(['email', 'in-app', 'push'] as const).map(channel => {
                                    const Icon = channel === 'email' ? Mail : channel === 'in-app' ? Layout : Smartphone;
                                    const label = channel === 'email' ? 'Email' : channel === 'in-app' ? 'In-App' : 'Push';
                                    const state = bulkChannelState(channel);
                                    const subtitle = state === 'all' ? 'Enabled for all selected' : state === 'some' ? 'Enabled for some selected' : 'Disabled for all selected';
                                    const tinted = state === 'all' || state === 'some';
                                    return (
                                      <div
                                        key={channel}
                                        onClick={() => bulkToggleChannel(channel)}
                                        className={clsx(
                                          "p-4 border rounded-xl relative cursor-pointer transition-all duration-200 flex flex-col shadow-sm hover:shadow-md",
                                          tinted ? "border-[#0E69E2]/30 bg-[#0E69E2]/5" : "border-gray-200 bg-white hover:border-gray-300"
                                        )}
                                      >
                                        <div className="absolute top-4 right-4 pointer-events-none">
                                          <span className={clsx(
                                            "w-5 h-5 border rounded flex items-center justify-center transition-colors",
                                            tinted ? "bg-[#0E69E2] border-[#0E69E2] text-white" : "bg-white border-gray-300"
                                          )}>
                                            {state === 'all' && <Check size={14} strokeWidth={3} />}
                                            {state === 'some' && <Minus size={14} strokeWidth={3} />}
                                          </span>
                                        </div>
                                        <div className={clsx("flex items-center gap-2 mb-1", tinted ? "text-[#0E69E2]" : "text-gray-900")}>
                                          <Icon size={18} />
                                          <span className="font-semibold text-sm">{label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">{subtitle}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Can Opt-Out? (replaces Assign Roles & Users) */}
                              <OptOutCard value={bulkOptOut} onValueChange={setBulkOptOut} />
                            </div>
                          ) : selectedAlert && (
                            <div className="animate-in fade-in duration-300">
                              {/* Alert Header */}
                              <div className="flex justify-between items-start mb-5">
                                <div className="min-w-0 flex-1 mr-10">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-xl font-semibold text-gray-900">{selectedAlert.title}</h2>
                                    {selectedAlert.isMandatory && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                        <Lock size={10} /> Required
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-500 text-sm leading-relaxed">{selectedAlert.description}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {selectedAlert.isMandatory ? (
                                    <LockedToggle variant="detail" />
                                  ) : (
                                    <Switch.Root
                                      checked={selectedAlert.enabled}
                                      onCheckedChange={(c) => toggleEnabled(c, selectedAlert.id)}
                                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-green-500 outline-none cursor-pointer transition-colors"
                                    >
                                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                                    </Switch.Root>
                                  )}
                                </div>
                              </div>

                              {/* Locked-by-admin banner (above "Who Receives This Alert") */}
                              {selectedAlert.isMandatory && (
                                <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                                  <Lock size={14} className="text-amber-500 shrink-0" />
                                  <p className="text-sm text-amber-700 leading-relaxed">
                                    This alert is required by your admin and can't be turned off.
                                  </p>
                                </div>
                              )}

                              {/* Who receives */}
                              <div className={clsx("mb-8", !selectedAlert.enabled && "opacity-50 grayscale pointer-events-none")}>
                                <div className="flex items-center justify-between p-4 bg-[#F1F5FF] rounded-xl border border-[#C6D2FF] gap-5">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 text-[#4339CA] shadow-sm border border-[#C6D2FF]/30">
                                      <User size={18} />
                                    </div>
                                    <div className="flex-1">
                                      <h3 className="text-sm font-semibold text-[#4339CA]">Who Receives This Alert</h3>
                                      <p className="text-xs text-[#4339CA] mt-0.5 leading-relaxed opacity-90">
                                        {selectedAlert.whoReceivesDescription || whoReceivesFallback}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Delivery Channels */}
                              <div className={clsx("mb-8", !selectedAlert.enabled && "opacity-50 grayscale pointer-events-none")}>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">{howReceiveTitle}</h3>
                                <div className="grid grid-cols-3 gap-4">
                                  {(['email', 'in-app', 'push'] as const).map(channel => {
                                    const Icon = channel === 'email' ? Mail : channel === 'in-app' ? Layout : Smartphone;
                                    const label = channel === 'email' ? 'Email' : channel === 'in-app' ? 'In-app' : 'Push';
                                    const desc = channelDescriptions[channel];
                                    const has = selectedAlert.channels.includes(channel);
                                    const isLocked = selectedAlert.isMandatory;

                                    return (
                                      <div
                                        key={channel}
                                        onClick={() => !isLocked && toggleChannel(channel)}
                                        className={clsx(
                                          "p-4 border rounded-xl relative transition-all duration-200 flex flex-col shadow-sm",
                                          isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:shadow-md",
                                          has
                                            ? "border-[#0E69E2]/30 bg-[#0E69E2]/5 hover:border-[#0E69E2]/50 hover:bg-[#0E69E2]/8"
                                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80"
                                        )}
                                      >
                                        <div className="absolute top-4 right-4 pointer-events-none flex items-center gap-1.5">
                                          <Checkbox.Root
                                            checked={has}
                                            disabled={isLocked}
                                            className={clsx(
                                              "w-5 h-5 border rounded flex items-center justify-center transition-colors",
                                              has ? "bg-[#0E69E2] border-[#0E69E2]" : "bg-white border-gray-300"
                                            )}
                                          >
                                            <Checkbox.Indicator className="text-white">
                                              <Check size={14} strokeWidth={3} />
                                            </Checkbox.Indicator>
                                          </Checkbox.Root>
                                        </div>
                                        <div className={clsx("flex items-center gap-2 mb-2", has ? "text-[#0E69E2]" : "text-gray-900")}>
                                          <Icon size={18} />
                                          <span className="font-semibold text-sm">{label}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3 leading-relaxed flex-1">{desc}</p>
                                        <button
                                          className="text-[#0E69E2] hover:text-[#0E69E2]/80 text-xs font-medium flex items-center gap-1 hover:underline mt-auto"
                                          onClick={(e) => { e.stopPropagation(); setPreviewType(channel === 'email' ? 'email' : channel === 'in-app' ? 'in-app' : 'push'); }}
                                        >
                                          Preview {label.toLowerCase()} <ArrowUpRight size={10} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* You receive this through (roles), hidden in role
                                  scope, where the alert already belongs to this role. */}
                              {!isRoleScope && (
                                <div className={clsx(!selectedAlert.enabled && "opacity-50 grayscale pointer-events-none")}>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-4">{receiveThroughTitle}</h3>
                                  <div className="border border-gray-200 rounded-xl bg-gray-50/50 px-5 py-4">
                                    <div className="flex items-start gap-3">
                                      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0 text-gray-500 shadow-sm border border-gray-200">
                                        <Shield size={16} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900 mb-1.5">Assigned Roles</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {selectedAlert.assignedThroughRoles.map(role => (
                                            <span key={role} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#EDF4FF] text-[#0A77FF] border border-[#0A77FF]/10">
                                              {role}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Can Opt-Out? (admin / module-scoped view only) */}
                              {isScoped && (
                                <OptOutCard
                                  value={optOutValue}
                                  onValueChange={setOptOut}
                                  disabled={selectedAlert.isMandatory}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="h-[64px] px-6 border-t border-gray-200 bg-white flex items-center justify-end shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCancel}
                        className="w-[100px] px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="w-[100px] px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-[#0E69E2] hover:bg-[#0E69E2]/90"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {previewType && previewAlert && (
                <NotificationPreviews
                  onClose={() => setPreviewType(null)}
                  type={previewType}
                  alert={previewAlert as any}
                />
              )}
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
