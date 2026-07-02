// PATH: src/pages/Admin/AdminRoutes/EditRoutePage.tsx
// UPDATED: Dark theme with orange accent

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Edit2 } from 'lucide-react';
import { Spinner, Alert } from '../../../components/ui';
import { routesApi } from '../../../api/services';
import type { RouteDto } from '../../../types';

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

export default function EditRoutePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = location.state?.route as RouteDto;
  
  const [form, setForm] = useState({
    name: route?.name || '',
    description: route?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!route) {
      navigate('/admin/routes');
      return;
    }
  }, [route, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Route name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await routesApi.update(route.id, {
        id: String(route.id),
        name: form.name,
        description: form.description || undefined,
        isActive: true,
      } as any);
      setSuccess('Route updated successfully!');
      setTimeout(() => {
        navigate('/admin/routes');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        
        {/* ── Back Button ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate('/admin/routes')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
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
            <ArrowLeft size={16} /> Back to Routes
          </button>
        </div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${D.accent}22`,
            border: `1px solid ${D.accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Edit2 size={22} color={D.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: 0, letterSpacing: '-0.03em' }}>
              Edit Route
            </h1>
            <p style={{ color: D.muted, fontSize: 13, marginTop: 2, fontWeight: 500 }}>
              {route?.name}
            </p>
          </div>
        </div>

        {/* ── Form Card ────────────────────────────────────────────────────── */}
        <div style={{
          background: D.surface,
          border: `1px solid ${D.border}`,
          borderRadius: 16,
          padding: '28px 28px 24px',
        }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: D.red, fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(34,197,94,0.10)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: D.green, fontSize: 13, fontWeight: 600,
            }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 700,
                  color: D.muted, marginBottom: 6, textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}>
                  Route Name <span style={{ color: D.red }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Changanassery, North Zone"
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 10, fontSize: 14, color: D.text,
                    outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box' as const,
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
                  autoFocus
                />
              </div>

              <div>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 700,
                  color: D.muted, marginBottom: 6, textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                }}>
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional - e.g., 3 customers"
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 10, fontSize: 14, color: D.text,
                    outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box' as const,
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

              {/* ── Assign Salesman field removed ── */}
            </div>

            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              marginTop: 24, paddingTop: 20,
              borderTop: `1px solid ${D.border}`,
            }}>
              <button
                type="button"
                onClick={() => navigate('/admin/routes')}
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
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800,
                  color: '#fff', border: 'none',
                  background: saving ? D.border : `linear-gradient(135deg, ${D.accent}, ${D.accentH})`,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: saving ? 'none' : `0 4px 14px ${D.accentGlow}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${D.accentGlow}`;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!saving) {
                    e.currentTarget.style.boxShadow = `0 4px 14px ${D.accentGlow}`;
                  }
                }}
              >
                {saving ? <Spinner size={16} /> : <Save size={16} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}