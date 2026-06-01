import React from 'react';
import { AlertTriangle } from 'lucide-react';

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        border: `2px solid var(--border)`,
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

// ── Loading page ──────────────────────────────────────────────────────────────
export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Spinner size={32} />
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'muted' | 'primary';
export function Badge({ variant = 'muted', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ── Alert ─────────────────────────────────────────────────────────────────────
type AlertVariant = 'error' | 'success' | 'warning' | 'info';
export function Alert({ variant = 'error', children }: { variant?: AlertVariant; children: React.ReactNode }) {
  return <div className={`alert alert-${variant}`}>{children}</div>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ title, message, icon: Icon }: {
  title: string; message?: string; icon?: React.ElementType;
}) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} />}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
export function ConfirmModal({
  open = true, title, message, onConfirm, onCancel, loading, danger = false, confirmLabel,
}: {
  open?:         boolean;
  title:         string;
  message:       string;
  onConfirm:     () => void;
  onCancel:      () => void;
  loading?:      boolean;
  danger?:       boolean;
  confirmLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <AlertTriangle size={22} color={danger ? 'var(--red)' : 'var(--amber)'} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
            <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Spinner size={16} /> : (confirmLabel ?? 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({
  label, children, error, required,
}: {
  label: string; children: React.ReactNode; error?: string; required?: boolean;
}) {
  return (
    <div className="input-wrap">
      <label className="input-label">
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}
