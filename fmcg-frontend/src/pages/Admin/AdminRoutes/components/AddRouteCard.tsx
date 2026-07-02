// PATH: src/pages/Admin/AdminRoutes/components/AddRouteCard.tsx
// UPDATED: Dark theme with orange accent

import { useEffect, useRef, useState } from 'react';
import { Route, X, Save } from 'lucide-react';
import { Spinner } from '../../../../components/ui';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import type { RouteFormData } from '../types';

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

interface AddRouteCardProps {
  saving: boolean;
  error: string;
  onSave: (form: RouteFormData) => void;
  onCancel: () => void;
}

export function AddRouteCard({
  saving,
  error,
  onSave,
  onCancel,
}: AddRouteCardProps) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<RouteFormData>({ name: '', description: '' });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const update = (key: keyof RouteFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      background: D.surface,
      border: `1px solid ${D.border}`,
      borderRadius: 16,
      boxShadow: `0 4px 24px ${D.accentGlow}`,
      padding: '28px 28px 24px',
      animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Route size={17} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>Add New Route</div>
            <div style={{ fontSize: 12, color: D.muted, fontWeight: 500 }}>Fill in the details below</div>
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${D.border}`,
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: D.muted,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = D.accent;
            e.currentTarget.style.color = D.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = D.border;
            e.currentTarget.style.color = D.muted;
          }}
        >
          <X size={15} />
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(239,68,68,0.10)',
          border: `1px solid ${D.red}33`,
          color: D.red, fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            Route Name <span style={{ color: D.red }}>*</span>
          </label>
          <input
            ref={nameRef}
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g., Changanassery, North Zone"
            style={{
              width: '100%', padding: '11px 14px',
              background: D.bg,
              border: `1px solid ${D.border}`,
              borderRadius: 10, fontSize: 14, color: D.text,
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
              transition: 'all 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = D.accent;
              e.target.style.boxShadow = `0 0 0 3px ${D.accentGlow}`;
              e.target.style.background = D.surface2;
            }}
            onBlur={e => {
              e.target.style.borderColor = D.border;
              e.target.style.boxShadow = 'none';
              e.target.style.background = D.bg;
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            Description
          </label>
          <input
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Optional — e.g., 10 shops, morning route"
            style={{
              width: '100%', padding: '11px 14px',
              background: D.bg,
              border: `1px solid ${D.border}`,
              borderRadius: 10, fontSize: 14, color: D.text,
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
              transition: 'all 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = D.accent;
              e.target.style.boxShadow = `0 0 0 3px ${D.accentGlow}`;
              e.target.style.background = D.surface2;
            }}
            onBlur={e => {
              e.target.style.borderColor = D.border;
              e.target.style.boxShadow = 'none';
              e.target.style.background = D.bg;
            }}
          />
        </div>
      </div>

      {/* ── Assign Salesman field removed ── */}

      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'flex-end',
        borderTop: `1px solid ${D.border}`,
        paddingTop: 20,
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            color: D.muted, border: `1px solid ${D.border}`,
            background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = D.accent;
            e.currentTarget.style.color = D.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = D.border;
            e.currentTarget.style.color = D.muted;
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800,
            color: '#fff', border: 'none',
            background: saving || !form.name.trim() ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
            cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: saving ? 'none' : `0 4px 14px ${D.accentGlow}`,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!saving && form.name.trim()) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 6px 20px ${D.accentGlow}`;
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            if (!saving && form.name.trim()) {
              e.currentTarget.style.boxShadow = `0 4px 14px ${D.accentGlow}`;
            }
          }}
        >
          {saving ? <Spinner size={16} /> : <><Save size={15} /> Create Route</>}
        </button>
      </div>
    </div>
  );
}