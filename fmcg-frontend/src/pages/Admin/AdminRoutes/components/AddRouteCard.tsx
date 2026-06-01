import { useEffect, useRef, useState } from 'react';
import { Route, X, Save } from 'lucide-react';
import { Spinner } from '../../../../components/ui';  // ← Fix: import from ui
import type { UserDto } from '../../../../types';
import type { RouteFormData } from '../types';

interface AddRouteCardProps {
  salesmen: UserDto[];
  saving: boolean;
  error: string;
  onSave: (form: RouteFormData) => void;
  onCancel: () => void;
}

export function AddRouteCard({
  salesmen,
  saving,
  error,
  onSave,
  onCancel,
}: AddRouteCardProps) {
  const [form, setForm] = useState<RouteFormData>({ name: '', description: '', assignedSalesmanId: '' });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const update = (key: keyof RouteFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(37,99,235,0.25)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(37,99,235,0.10)',
      padding: '28px 28px 24px',
      animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Route size={17} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>Add New Route</div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Fill in the details below</div>
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-sub)',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)',
          color: '#B91C1C', fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>
            Route Name <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            ref={nameRef}
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g., Changanassery, North Zone"
            style={{
              width: '100%', padding: '11px 14px',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 10, fontSize: 14, color: '#334155',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
            }}
            onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>
            Assign Salesman
          </label>
          <select
            value={form.assignedSalesmanId}
            onChange={e => update('assignedSalesmanId', e.target.value)}
            style={{
              width: '100%', padding: '11px 14px',
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 10, fontSize: 14, color: '#334155',
              outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="">— Unassigned —</option>
            {salesmen.map(s => (
              <option key={String(s.id)} value={String(s.id)}>
                {s.fullName} ({s.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>
          Description
        </label>
        <input
          value={form.description}
          onChange={e => update('description', e.target.value)}
          placeholder="Optional — e.g., 10 shops, morning route"
          style={{
            width: '100%', padding: '11px 14px',
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 10, fontSize: 14, color: '#334155',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            color: 'var(--text-sub)', border: '1px solid var(--border)',
            background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
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
            background: saving || !form.name.trim() ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)',
            cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 4px 14px rgba(37,99,235,0.28)',
          }}
        >
          {saving ? <Spinner size={16} /> : <><Save size={15} /> Create Route</>}
        </button>
      </div>
    </div>
  );
}