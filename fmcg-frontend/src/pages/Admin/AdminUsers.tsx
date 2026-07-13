// PATH: src/pages/Admin/AdminUsers.tsx
// UPDATED: PIN Reminder as a button that opens a modal with a list, added Back to Dashboard button

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  RefreshCw, UserCheck, UserX, KeyRound, Search, UserPlus, X, Eye, EyeOff, 
  StickyNote, Edit3, Plus, Trash2, Save, ArrowLeft
} from 'lucide-react';
import { usersApi, authApi } from '../../api/services';
import type { UserDto } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState, ConfirmModal } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAuthStore } from '../../store/authStore';

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const D = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#243447',
  border:   '#334155',
  accent:   '#ea580c',
  accentH:  '#c2410c',
  accentGlow: 'rgba(234,88,12,0.25)',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  sub:      '#64748b',
  green:    '#22c55e',
  red:      '#ef4444',
  amber:    '#f59e0b',
  card:     '#1e293b',
};

const ROLE_BADGE: Record<string, 'primary' | 'blue' | 'green' | 'muted' | 'amber'> = {
  SuperAdmin: 'primary',
  Admin:      'primary',
  Salesman:   'green',
  Accounts:   'blue',
  Warehouse:  'blue',
};

type RoleFilter = 'All' | 'Salesman' | 'Admin' | 'Accounts' | 'Warehouse';
const ROLE_FILTERS: RoleFilter[] = ['All', 'Salesman', 'Admin', 'Accounts', 'Warehouse'];

// ─── Create Salesman Modal ──────────────────────────────────────────────
function CreateSalesmanModal({ isOpen, onClose, onSuccess }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({ userName: '', fullName: '', pin: '' });
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [pinAvailability, setPinAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [pinConflictName, setPinConflictName] = useState('');

    useEffect(() => {
        if (!isOpen || !/^\d{6}$/.test(form.pin)) {
            setPinAvailability('idle');
            return;
        }
        setPinAvailability('checking');
        const handle = setTimeout(async () => {
            try {
                const res = await authApi.checkPinAvailability(form.pin);
                if (res.isAvailable) {
                    setPinAvailability('available');
                    setPinConflictName('');
                } else {
                    setPinAvailability('taken');
                    setPinConflictName(res.conflictingUserName ?? 'another user');
                }
            } catch {
                setPinAvailability('idle');
            }
        }, 450);
        return () => clearTimeout(handle);
    }, [form.pin, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.userName || !form.pin) {
            setError('Username and PIN are required.');
            return;
        }
        if (form.pin.length !== 6 || !/^\d+$/.test(form.pin)) {
            setError('PIN must be exactly 6 digits.');
            return;
        }
        if (pinAvailability === 'taken') {
            setError(`This PIN is already used by ${pinConflictName}. Choose a different one.`);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await usersApi.createSalesman({
                userName: form.userName,
                fullName: form.fullName || form.userName,
                pin: form.pin,
                email: undefined,
            });
            onSuccess();
            onClose();
            setForm({ userName: '', fullName: '', pin: '' });
            setPinAvailability('idle');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create salesman.');
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    function handleClose() {
        setForm({ userName: '', fullName: '', pin: '' });
        setPinAvailability('idle');
        setError('');
        setShowPin(false);
        onClose();
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-40" onClick={handleClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e293b] rounded-2xl p-6 w-full max-w-md z-50 shadow-xl border border-[#334155]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <UserPlus size={20} className="text-[#ea580c]" />
                        <h2 className="text-xl font-bold text-[#f1f5f9]">Create Salesman</h2>
                    </div>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-[#334155] text-[#94a3b8]">
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[#94a3b8] mb-1">
                            Username *
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#0f172a] text-[#f1f5f9]"
                            placeholder="e.g., rajesh_k"
                            value={form.userName}
                            onChange={(e) => setForm({ ...form, userName: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                            autoFocus
                        />
                        <p className="text-xs text-[#64748b] mt-1">Unique identifier for login</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#94a3b8] mb-1">
                            Full Name <span className="text-[#64748b] font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#0f172a] text-[#f1f5f9]"
                            placeholder="e.g., Rajesh Kumar"
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        />
                        <p className="text-xs text-[#64748b] mt-1">If empty, username will be used as name</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#94a3b8] mb-1">
                            PIN (6 digits) *
                        </label>
                        <div className="relative">
                            <input
                                type={showPin ? 'text' : 'password'}
                                inputMode="numeric"
                                maxLength={6}
                                className="w-full px-4 py-2 pr-10 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#0f172a] text-[#f1f5f9]"
                                placeholder="e.g., 123456"
                                value={form.pin}
                                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPin(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#94a3b8]"
                                title={showPin ? 'Hide PIN' : 'Show PIN'}
                            >
                                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <div className="min-h-[18px] mt-1 flex items-center gap-1.5 text-xs">
                            {pinAvailability === 'checking' ? (
                                <span className="text-[#64748b] flex items-center gap-1.5"><Spinner size={11} /> Checking…</span>
                            ) : pinAvailability === 'available' ? (
                                <span className="text-[#22c55e] font-semibold">✓ Available</span>
                            ) : pinAvailability === 'taken' ? (
                                <span className="text-[#ef4444] font-semibold">✗ Already used by {pinConflictName} — choose a different PIN</span>
                            ) : (
                                <span className="text-[#64748b]">Salesman will use this to login</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-[#334155]">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-[#94a3b8] bg-[#0f172a] border border-[#334155] rounded-lg hover:bg-[#243447] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !form.userName || form.pin.length !== 6 || pinAvailability === 'taken' || pinAvailability === 'checking'}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#ea580c] rounded-lg hover:bg-[#c2410c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Spinner size={16} /> : 'Create Salesman'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

// ─── PIN Reminder Modal ──────────────────────────────────────────────────────
function PinReminderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<{ id: string; name: string; pin: string; role: string }[]>(() => {
    try {
      const saved = localStorage.getItem('pin_reminder_entries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState('Salesman');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState('');

  const saveEntries = (data: typeof entries) => {
    setEntries(data);
    localStorage.setItem('pin_reminder_entries', JSON.stringify(data));
  };

  const addEntry = () => {
    if (!newName.trim() || !newPin.trim()) return;
    const newEntry = {
      id: Date.now().toString(),
      name: newName.trim(),
      pin: newPin.trim(),
      role: newRole,
    };
    saveEntries([...entries, newEntry]);
    setNewName('');
    setNewPin('');
    setNewRole('Salesman');
  };

  const startEdit = (entry: typeof entries[0]) => {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditPin(entry.pin);
    setEditRole(entry.role);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editPin.trim()) return;
    const updated = entries.map(e =>
      e.id === editingId ? { ...e, name: editName.trim(), pin: editPin.trim(), role: editRole } : e
    );
    saveEntries(updated);
    setEditingId(null);
    setEditName('');
    setEditPin('');
    setEditRole('');
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveEntries(updated);
  };

  if (!isOpen) return null;

  const roleColors: Record<string, string> = {
    Salesman: '#22c55e',
    Admin: '#ea580c',
    SuperAdmin: '#8b5cf6',
    Accounts: '#3b82f6',
    Warehouse: '#f59e0b',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e293b] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] z-50 shadow-xl border border-[#334155] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <StickyNote size={20} className="text-[#ea580c]" />
            <h2 className="text-xl font-bold text-[#f1f5f9]">PIN Reminder</h2>
            <span className="text-xs text-[#64748b] bg-[#0f172a] px-2 py-1 rounded-full">{entries.length} saved</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#334155] text-[#94a3b8]">
            <X size={20} />
          </button>
        </div>

        {/* Add Entry Form */}
        <div className="flex-shrink-0 mb-4 p-4 bg-[#0f172a] rounded-xl border border-[#334155]">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Name / Username"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 min-w-[120px] px-3 py-2 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm"
              onKeyDown={e => e.key === 'Enter' && addEntry()}
            />
            <input
              type="text"
              placeholder="PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              className="w-24 px-3 py-2 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm text-center"
              onKeyDown={e => e.key === 'Enter' && addEntry()}
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="px-3 py-2 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm"
            >
              <option value="Salesman">Salesman</option>
              <option value="Admin">Admin</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Accounts">Accounts</option>
              <option value="Warehouse">Warehouse</option>
            </select>
            <button
              onClick={addEntry}
              disabled={!newName.trim() || !newPin.trim()}
              className="px-4 py-2 rounded-lg border-none bg-[#ea580c] text-white text-sm font-medium hover:bg-[#c2410c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* Entries List - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-[#64748b]">
              <StickyNote size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No PINs saved yet</p>
              <p className="text-xs mt-1">Add entries above to keep track of user PINs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const isEditing = editingId === entry.id;
                const roleColor = roleColors[entry.role] || '#94a3b8';
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-xl border border-[#334155] hover:border-[#ea580c]/30 transition-all"
                  >
                    {isEditing ? (
                      // Edit mode
                      <>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editPin}
                          onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                          maxLength={6}
                          className="w-20 px-3 py-1.5 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm text-center"
                        />
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value)}
                          className="px-3 py-1.5 border border-[#334155] rounded-lg focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 bg-[#1e293b] text-[#f1f5f9] text-sm"
                        >
                          <option value="Salesman">Salesman</option>
                          <option value="Admin">Admin</option>
                          <option value="SuperAdmin">SuperAdmin</option>
                          <option value="Accounts">Accounts</option>
                          <option value="Warehouse">Warehouse</option>
                        </select>
                        <button
                          onClick={saveEdit}
                          className="p-2 rounded-lg bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors"
                          title="Save"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 rounded-lg bg-[#334155] text-[#94a3b8] hover:bg-[#475569] transition-colors"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      // View mode
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#f1f5f9] text-sm">{entry.name}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: `${roleColor}22`,
                                color: roleColor,
                                border: `1px solid ${roleColor}33`,
                              }}
                            >
                              {entry.role}
                            </span>
                          </div>
                          <div className="text-xs text-[#64748b] mt-0.5 font-mono">PIN: {entry.pin}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-2 rounded-lg hover:bg-[#334155] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 mt-4 pt-4 border-t border-[#334155] flex justify-between items-center">
          <span className="text-xs text-[#64748b]">💡 PINs are stored locally in your browser</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#334155] text-[#94a3b8] hover:bg-[#334155] transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main AdminUsers Component ──────────────────────────────────────────────

export function AdminUsers() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const [users,        setUsers]        = useState<UserDto[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPinReminder, setShowPinReminder] = useState(false);

  const [toggling,     setToggling]     = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserDto | null>(null);

  const [pinModal,     setPinModal]     = useState<UserDto | null>(null);
  const [pinValue,     setPinValue]     = useState('');
  const [showPinValue, setShowPinValue] = useState(false);
  const [pinSaving,    setPinSaving]    = useState(false);
  const [pinError,     setPinError]     = useState('');
  const [pinAvailability, setPinAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [pinConflictName, setPinConflictName] = useState('');

 async function load() {
  setLoading(true); setError('');
  try {
    // ── CHANGE: Only get active users ──
    const all = await usersApi.getAll(
      roleFilter === 'All' ? undefined : roleFilter
    );
    setUsers(all);
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Failed to load users');
  } finally { setLoading(false); }
}
  useEffect(() => { load(); }, [roleFilter]);

  async function handleToggleConfirm() {
    if (!toggleTarget) return;
    setToggling(toggleTarget.id);
    setError('');
    try {
      await usersApi.toggleActive(toggleTarget.id);
      setSuccess(
        `${toggleTarget.fullName} has been ${toggleTarget.isActive ? 'deactivated' : 'activated'}.`
      );
      setToggleTarget(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
      setToggleTarget(null);
    } finally { setToggling(null); }
  }

  function openPinModal(u: UserDto) {
    setPinModal(u);
    setPinValue('');
    setPinError('');
    setShowPinValue(false);
    setPinAvailability('idle');
    setPinConflictName('');
  }

  useEffect(() => {
    if (!pinModal || !/^\d{6}$/.test(pinValue)) {
      setPinAvailability('idle');
      return;
    }
    setPinAvailability('checking');
    const handle = setTimeout(async () => {
      try {
        const res = await authApi.checkPinAvailability(pinValue, pinModal.id);
        if (res.isAvailable) {
          setPinAvailability('available');
          setPinConflictName('');
        } else {
          setPinAvailability('taken');
          setPinConflictName(res.conflictingUserName ?? 'another user');
        }
      } catch {
        setPinAvailability('idle');
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [pinValue, pinModal]);

  async function handleSetPin() {
    if (!pinModal) return;
    if (!/^\d{6}$/.test(pinValue)) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }
    if (pinAvailability === 'taken') {
      setPinError(`This PIN is already used by ${pinConflictName}. Choose a different one.`);
      return;
    }
    setPinSaving(true); setPinError('');
    try {
      await authApi.setPin(pinValue, pinModal.id);
      setSuccess(`PIN set successfully for ${pinModal.fullName}.`);
      setPinModal(null);
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Failed to set PIN');
    } finally { setPinSaving(false); }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={40} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Back Button ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <Link 
            to={user?.role === 'Admin' || user?.role === 'SuperAdmin' ? '/admin/dashboard' : '/'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = D.text;
              e.currentTarget.style.borderColor = D.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = D.muted;
              e.currentTarget.style.borderColor = D.border;
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        {/* ── PIN Reminder Button ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowPinReminder(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 10,
              background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 4px 14px ${D.accentGlow}`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${D.accentGlow}`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${D.accentGlow}`;
            }}
          >
            <StickyNote size={18} />
            PIN Reminder
            <span style={{
              background: 'rgba(255,255,255,0.20)',
              padding: '1px 8px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
            }}>
              {(() => {
                try {
                  const saved = localStorage.getItem('pin_reminder_entries');
                  return saved ? JSON.parse(saved).length : 0;
                } catch { return 0; }
              })()}
            </span>
          </button>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: D.text, margin: 0, letterSpacing: '-0.02em' }}>Users</h1>
            <p style={{ color: D.muted, fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              {users.length} user{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={load}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 9,
                background: D.surface,
                border: `1px solid ${D.border}`,
                color: D.muted,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 9,
                border: 'none',
                background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                color: '#fff',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: `0 4px 14px ${D.accentGlow}`,
                transition: 'all 0.15s',
              }}
            >
              <UserPlus size={16} /> Create Salesman
            </button>
          </div>
        </div>

        {error   && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: D.sub,
            }} />
            <input
              style={{
                width: '100%',
                padding: '9px 12px 9px 32px',
                background: D.surface,
                border: `1px solid ${D.border}`,
                borderRadius: 9,
                fontSize: 13,
                color: D.text,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.sub }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {ROLE_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${roleFilter === r ? D.accent : D.border}`,
                  background: roleFilter === r ? D.accent : D.surface,
                  color: roleFilter === r ? '#fff' : D.muted,
                  cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Content - Table or Mobile Cards */}
        {filtered.length === 0 ? (
          <EmptyState title="No users found" message="Try adjusting your filters." icon={UserCheck} />
        ) : isMobile ? (
          // Mobile card view
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(u => (
              <div
                key={u.id}
                style={{
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  opacity: u.isActive ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: u.isActive ? `${D.accent}22` : D.border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700,
                    color: u.isActive ? D.accent : D.sub,
                  }}>
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: D.text }}>{u.fullName}</div>
                    <div style={{ fontSize: 12, color: D.sub, marginTop: 1 }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <Badge variant={ROLE_BADGE[u.role] ?? 'muted'}>{u.role}</Badge>
                    <Badge variant={u.isActive ? 'green' : 'muted'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(u.role === 'Salesman' || u.role === 'Admin' || u.role === 'SuperAdmin') && u.isActive && (
                    <button
                      onClick={() => openPinModal(u)}
                      style={{
                        flex: 1, justifyContent: 'center', minWidth: 100,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: `1px solid ${D.border}`,
                        background: D.bg,
                        color: D.muted,
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
                    >
                      <KeyRound size={13} /> Set PIN
                    </button>
                  )}
                  <button
                    onClick={() => setToggleTarget(u)}
                    disabled={toggling === u.id}
                    style={{
                      flex: 1, justifyContent: 'center', minWidth: 100,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: `1px solid ${u.isActive ? D.red : D.border}`,
                      background: u.isActive ? 'rgba(239,68,68,0.10)' : D.bg,
                      color: u.isActive ? D.red : D.muted,
                      fontSize: 12, fontWeight: 600,
                      cursor: toggling === u.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      if (toggling !== u.id) {
                        (e.currentTarget as HTMLElement).style.background = u.isActive ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.05)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = u.isActive ? 'rgba(239,68,68,0.10)' : D.bg;
                    }}
                  >
                    {toggling === u.id
                      ? <Spinner size={13} />
                      : u.isActive
                        ? <><UserX size={13} /> Deactivate</>
                        : <><UserCheck size={13} /> Activate</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop table view
          <div style={{
            background: D.surface,
            borderRadius: 14,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 14, background: D.surface }}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{
                        background: D.bg,
                        color: D.muted,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase' as const,
                        padding: '12px 16px',
                        borderBottom: `1px solid ${D.border}`,
                        textAlign: 'left' as const,
                        whiteSpace: 'nowrap' as const,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}
                      style={{
                        borderBottom: `1px solid ${D.border}`,
                        opacity: u.isActive ? 1 : 0.55,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: u.isActive ? `${D.accent}22` : D.border,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                            color: u.isActive ? D.accent : D.sub,
                          }}>
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: D.text }}>{u.fullName}</span>
                        </div>
                      </td>
                      <td style={{ color: D.sub, fontSize: 13 }}>{u.email}</td>
                      <td><Badge variant={ROLE_BADGE[u.role] ?? 'muted'}>{u.role}</Badge></td>
                      <td><Badge variant={u.isActive ? 'green' : 'muted'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {(u.role === 'Salesman' || u.role === 'Admin' || u.role === 'SuperAdmin') && u.isActive && (
                            <button
                              onClick={() => openPinModal(u)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 7,
                                border: `1px solid ${D.border}`,
                                background: D.bg,
                                color: D.muted,
                                fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 4,
                                transition: 'all 0.12s',
                              }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
                            >
                              <KeyRound size={12} /> Set PIN
                            </button>
                          )}
                          <button
                            onClick={() => setToggleTarget(u)}
                            disabled={toggling === u.id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 7,
                              border: `1px solid ${u.isActive ? D.red : D.border}`,
                              background: u.isActive ? 'rgba(239,68,68,0.10)' : D.bg,
                              color: u.isActive ? D.red : D.muted,
                              fontSize: 12, fontWeight: 600,
                              cursor: toggling === u.id ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', gap: 4,
                              transition: 'all 0.12s',
                            }}
                            onMouseEnter={e => {
                              if (toggling !== u.id) {
                                (e.currentTarget as HTMLElement).style.background = u.isActive ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.05)';
                              }
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = u.isActive ? 'rgba(239,68,68,0.10)' : D.bg;
                            }}
                          >
                            {toggling === u.id
                              ? <Spinner size={12} />
                              : u.isActive
                                ? <><UserX size={12} /> Deactivate</>
                                : <><UserCheck size={12} /> Activate</>
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Salesman Modal */}
        <CreateSalesmanModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={load}
        />

        {/* PIN Reminder Modal */}
        <PinReminderModal
          isOpen={showPinReminder}
          onClose={() => setShowPinReminder(false)}
        />

        {/* Set PIN Modal */}
        {pinModal && (
          <div className="modal-overlay" onClick={() => setPinModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, background: D.surface, border: `1px solid ${D.border}` }}>
              <h3 style={{ marginTop: 0, fontWeight: 700, color: D.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color={D.accent} /> Set PIN
              </h3>
              <p style={{ fontSize: 13, color: D.muted, marginBottom: 16 }}>
                Setting PIN for <strong style={{ color: D.text }}>{pinModal.fullName}</strong>.
                They'll use this 6-digit PIN to log in from the PIN login screen.
              </p>

              {pinError && (
                <div style={{
                  background: 'rgba(239,68,68,0.10)',
                  border: `1px solid rgba(239,68,68,0.30)`,
                  borderRadius: 8, padding: '8px 12px',
                  color: D.red, fontSize: 13, marginBottom: 12,
                }}>
                  {pinError}
                </div>
              )}

              <label style={{ fontSize: 12, color: D.muted, display: 'block', marginBottom: 6 }}>
                PIN (6 digits) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPinValue ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={pinValue}
                  onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSetPin()}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 10,
                    fontSize: 20,
                    color: D.text,
                    textAlign: 'center',
                    letterSpacing: 8,
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPinValue(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.sub, cursor: 'pointer', padding: 4, display: 'flex' }}
                  title={showPinValue ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPinValue ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ minHeight: 20, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                {pinAvailability === 'checking' && (
                  <><Spinner size={12} /> <span style={{ color: D.muted }}>Checking…</span></>
                )}
                {pinAvailability === 'available' && (
                  <span style={{ color: D.green, fontWeight: 600 }}>✓ Available</span>
                )}
                {pinAvailability === 'taken' && (
                  <span style={{ color: D.red, fontWeight: 600 }}>
                    ✗ Already used by {pinConflictName} — choose a different PIN
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setPinModal(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSetPin}
                  disabled={pinSaving || pinValue.length !== 6 || pinAvailability === 'taken' || pinAvailability === 'checking'}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: pinSaving || pinValue.length !== 6 || pinAvailability === 'taken' || pinAvailability === 'checking'
                      ? D.border
                      : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: pinSaving || pinValue.length !== 6 || pinAvailability === 'taken' || pinAvailability === 'checking' ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: pinSaving || pinValue.length !== 6 || pinAvailability === 'taken' || pinAvailability === 'checking'
                      ? 'none'
                      : `0 4px 14px ${D.accentGlow}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {pinSaving ? <Spinner size={16} /> : 'Set PIN'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          open={!!toggleTarget}
          title={toggleTarget?.isActive ? 'Deactivate User' : 'Activate User'}
          message={`Are you sure you want to ${toggleTarget?.isActive ? 'deactivate' : 'activate'} ${toggleTarget?.fullName}?`}
          confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
          danger={toggleTarget?.isActive}
          loading={!!toggling}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </div>
  );
}