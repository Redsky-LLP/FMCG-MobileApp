import { useState } from 'react';
import { ChevronDown, Calendar, X } from 'lucide-react';
import { Spinner } from '../../../../components/ui';  // ← Fix: import from ui
import type { UserDto } from '../../../../types';

interface OverrideRouteCardProps {
  route: { routeId: string; routeName: string };
  salesmen: UserDto[];
  saving: boolean;
  error: string;
  onSave: (routeId: string, salesmanId: string, date: string, notes: string) => void;
  onCancel: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OverrideRouteCard({
  route,
  salesmen,
  saving,
  error,
  onSave,
  onCancel,
}: OverrideRouteCardProps) {
  const [salesmanId, setSalesmanId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(217,119,6,0.35)',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(217,119,6,0.12)',
      padding: '28px 28px 24px',
      animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#D97706,#F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronDown size={17} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>Temporary Route Assignment</div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Route: <strong>{route.routeName}</strong></div>
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

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <strong>📅 When to use:</strong> Salesman on leave, resigned, or temporary coverage.
        This overrides the permanent assignment ONLY for the selected date.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 7 }}>Assign to Salesman *</label>
          <select
            className="input"
            value={salesmanId}
            onChange={e => setSalesmanId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Select salesman...</option>
            {salesmen.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 7 }}>Assignment Date *</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={e => setDate(e.target.value)}
            min={todayStr()}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 7 }}>Notes (optional)</label>
          <input
            className="input"
            placeholder="e.g., Rajesh on leave, covering for him"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
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
          onClick={() => onSave(route.routeId, salesmanId, date, notes)}
          disabled={saving || !salesmanId}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800,
            color: '#fff', border: 'none',
            background: saving || !salesmanId ? '#FCD34D' : 'linear-gradient(135deg,#D97706,#F59E0B)',
            cursor: saving || !salesmanId ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: saving || !salesmanId ? 0.6 : 1,
            boxShadow: saving ? 'none' : '0 4px 14px rgba(217,119,6,0.28)',
          }}
        >
          {saving ? <Spinner size={16} /> : <><Calendar size={14} /> Assign for {date}</>}
        </button>
      </div>
    </div>
  );
}