// PATH: src/pages/Admin/AdminRoutes/DeleteRoutePage.tsx
// UPDATED: Dark theme with orange accent

import { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, AlertTriangle, Route, ShieldAlert } from 'lucide-react';
import { routesApi } from '../../../api/services';
import { Spinner } from '../../../components/ui';

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

export default function DeleteRoutePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id }    = useParams<{ id: string }>();
  const routeName = (location.state as { routeName?: string })?.routeName ?? 'this route';

  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');
  const [confirmed, setConfirmed] = useState(false);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true); setError('');
    try {
      await routesApi.delete(id);
      setConfirmed(true);
      setTimeout(() => navigate('/admin/routes'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  // ── Success state ──
  if (confirmed) {
    return (
      <div style={{
        minHeight: '100vh', background: D.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            border: `2px solid ${D.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <span style={{ fontSize: 32 }}>✓</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.text, margin: '0 0 8px' }}>
            Route Deleted
          </h2>
          <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>
            <strong style={{ color: D.text }}>{routeName}</strong> has been permanently removed.
            Redirecting back to routes…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: D.bg }}>

      {/* ── Top bar with back button ── */}
      <div style={{
        background: D.surface,
        borderBottom: `1px solid ${D.border}`,
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 9,
            border: `1px solid ${D.border}`,
            background: D.bg,
            color: D.muted,
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600,
            transition: 'all 0.14s',
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
          <ArrowLeft size={14} />
          Back to Routes
        </button>
        <div style={{ width: 1, height: 20, background: D.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Route size={15} style={{ color: D.muted }} />
          <span style={{ fontSize: 13, color: D.muted, fontWeight: 500 }}>Routes</span>
          <span style={{ color: D.border, fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: D.red, fontWeight: 600 }}>Delete</span>
        </div>
      </div>

      {/* ── Main content — centered card ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 61px)', padding: 24,
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Warning icon */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              border: `2px solid ${D.red}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: `0 8px 24px rgba(239,68,68,0.15)`,
            }}>
              <ShieldAlert size={34} color={D.red} strokeWidth={1.8} />
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: D.text,
              margin: '0 0 8px', letterSpacing: '-0.03em',
            }}>
              Delete Route
            </h1>
            <p style={{ fontSize: 14, color: D.muted, margin: 0 }}>
              You are about to permanently delete this route.
            </p>
          </div>

          {/* Route info card */}
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            padding: '20px 22px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: 'rgba(239,68,68,0.10)',
                border: `1.5px solid ${D.red}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Route size={22} color={D.red} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
                  {routeName}
                </div>
                <div style={{ fontSize: 12, color: D.sub, marginTop: 3 }}>
                  Route ID: {id?.slice(0, 8)}…
                </div>
              </div>
            </div>
          </div>

          {/* Warning consequences card */}
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            borderRadius: 14,
            border: `1px solid ${D.amber}44`,
            padding: '16px 18px',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={17} color={D.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: D.amber }}>
                  This action cannot be undone. The following will be lost:
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'All customer mappings for this route',
                    'Route assignment history',
                  ].map(item => (
                    <li key={item} style={{ fontSize: 13, color: D.muted }}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(239,68,68,0.10)',
              border: `1px solid ${D.red}33`,
              fontSize: 13, color: D.red, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                flex: 1, padding: '13px', borderRadius: 11,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.muted,
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700,
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
              onClick={handleDelete}
              disabled={deleting}
              style={{
                flex: 1, padding: '13px', borderRadius: 11,
                border: 'none',
                background: deleting ? D.border : `linear-gradient(135deg, ${D.red}, #b91c1c)`,
                color: '#fff',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: deleting ? 'none' : `0 4px 14px rgba(239,68,68,0.35)`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!deleting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 6px 20px rgba(239,68,68,0.45)`;
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (!deleting) {
                  e.currentTarget.style.boxShadow = `0 4px 14px rgba(239,68,68,0.35)`;
                }
              }}
            >
              {deleting
                ? <><Spinner size={16} /> Deleting…</>
                : <><Trash2 size={16} /> Yes, Delete Route</>
              }
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: D.sub, marginTop: 16 }}>
            Route data will be permanently removed from the database
          </p>
        </div>
      </div>
    </div>
  );
}