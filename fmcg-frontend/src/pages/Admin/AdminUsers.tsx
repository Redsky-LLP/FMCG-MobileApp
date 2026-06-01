// PATH: src/pages/Admin/AdminUsers.tsx
// NEW FILE — Admin User Management: list, activate/deactivate, set salesman PIN

import { useEffect, useState } from 'react';
import { RefreshCw, UserCheck, UserX, KeyRound, Search } from 'lucide-react';
import { usersApi, authApi } from '../../api/services';
import type { UserDto } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState, ConfirmModal } from '../../components/ui';

// Badge only accepts: 'green' | 'amber' | 'red' | 'blue' | 'muted' | 'primary'
const ROLE_BADGE: Record<string, 'primary' | 'blue' | 'green' | 'muted' | 'amber'> = {
  SuperAdmin: 'primary',
  Admin:      'primary',
  Salesman:   'green',
  Accounts:   'blue',
  Warehouse:  'blue',
};

type RoleFilter = 'All' | 'Salesman' | 'Admin' | 'Accounts' | 'Warehouse';
const ROLE_FILTERS: RoleFilter[] = ['All', 'Salesman', 'Admin', 'Accounts', 'Warehouse'];

export function AdminUsers() {
  const [users,        setUsers]        = useState<UserDto[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('All');

  // Toggle active state
  const [toggling,     setToggling]     = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserDto | null>(null);

  // Set PIN modal
  const [pinModal,     setPinModal]     = useState<UserDto | null>(null);
  const [pinValue,     setPinValue]     = useState('');
  const [pinSaving,    setPinSaving]    = useState(false);
  const [pinError,     setPinError]     = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const all = await usersApi.getAllWithInactive(
        roleFilter === 'All' ? undefined : roleFilter
      );
      setUsers(all);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [roleFilter]);

  // ── Toggle active ─────────────────────────────────────────────────────────
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

  // ── Set PIN ───────────────────────────────────────────────────────────────
  function openPinModal(u: UserDto) {
    setPinModal(u);
    setPinValue('');
    setPinError('');
  }

  async function handleSetPin() {
    if (!pinModal) return;
    if (!/^\d{4,6}$/.test(pinValue)) {
      setPinError('PIN must be 4–6 digits.');
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

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Users</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {users.length} user{users.length !== 1 ? 's' : ''} · manage accounts, PIN and access
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Alerts — Alert only accepts variant + children, no style/onClose */}
      {error   && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)',
          }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Role filter pills */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {ROLE_FILTERS.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--border)',
                background: roleFilter === r ? 'var(--primary)' : 'var(--surface)',
                color:      roleFilter === r ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No users found" message="Try adjusting your filters." icon={UserCheck} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                  {/* Name */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: u.isActive ? 'var(--primary-glow)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        color: u.isActive ? 'var(--primary)' : 'var(--text-muted)',
                      }}>
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{u.fullName}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>

                  {/* Role — only valid BadgeVariant values used */}
                  <td>
                    <Badge variant={ROLE_BADGE[u.role] ?? 'muted'}>{u.role}</Badge>
                  </td>

                  {/* Status */}
                  <td>
                    <Badge variant={u.isActive ? 'green' : 'muted'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {/* Set PIN — Salesman only */}
                      {u.role === 'Salesman' && u.isActive && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => openPinModal(u)}
                          title="Set PIN for this salesman"
                        >
                          <KeyRound size={12} /> Set PIN
                        </button>
                      )}

                      {/* Activate / Deactivate */}
                      <button
                        className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-outline'}`}
                        style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setToggleTarget(u)}
                        disabled={toggling === u.id}
                        title={u.isActive ? 'Deactivate account' : 'Activate account'}
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
      )}

      {/* ── Set PIN Modal ──────────────────────────────────────────────────── */}
      {pinModal && (
        <div className="modal-overlay" onClick={() => setPinModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={18} color="var(--primary)" /> Set PIN
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Setting PIN for <strong style={{ color: 'var(--text)' }}>{pinModal.fullName}</strong>.
              The salesman uses this 4–6 digit PIN to log in from their mobile device.
            </p>

            {/* pinError shown inline — no Alert needed here */}
            {pinError && (
              <div style={{
                background: 'var(--red-dim, rgba(239,68,68,0.12))',
                border: '1px solid var(--red, #ef4444)',
                borderRadius: 8, padding: '8px 12px',
                color: 'var(--red, #ef4444)', fontSize: 13, marginBottom: 12,
              }}>
                {pinError}
              </div>
            )}

            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              PIN (4–6 digits) *
            </label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 1234"
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, ''))}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSetPin()}
              style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Choose something easy for the salesman to remember.
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setPinModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSetPin}
                disabled={pinSaving || pinValue.length < 4}
              >
                {pinSaving ? <Spinner size={16} /> : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle Active Confirm — ConfirmModal accepts open prop ────────── */}
      <ConfirmModal
        open={!!toggleTarget}
        title={toggleTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        message={
          toggleTarget?.isActive
            ? `Deactivating ${toggleTarget.fullName} will immediately block their login. Continue?`
            : `Reactivate ${toggleTarget?.fullName ?? ''}? They will be able to log in again immediately.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.isActive ?? false}
        loading={!!toggling}
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}