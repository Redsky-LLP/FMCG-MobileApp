// PATH: src/pages/Admin/AdminRoutes/DeleteRoutePage.tsx
// NEW FILE: Dedicated delete confirmation page instead of modal
// Navigated to from RoutesTable when Delete is clicked

import { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, AlertTriangle, Route, ShieldAlert } from 'lucide-react';
import { routesApi } from '../../../api/services';
import { Spinner } from '../../../components/ui';

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
      // Navigate back after short delay so user sees success
      setTimeout(() => navigate('/admin/routes'), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────
  if (confirmed) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8FAFC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#F0FDF4', border: '2px solid #BBF7D0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <span style={{ fontSize: 32 }}>✓</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
            Route Deleted
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            <strong>{routeName}</strong> has been permanently removed.
            Redirecting back to routes…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ── Top bar with back button ─────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 9,
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, transition: 'all 0.14s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F5F9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
        >
          <ArrowLeft size={14} />
          Back to Routes
        </button>
        <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Route size={15} color="#64748B" />
          <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Routes</span>
          <span style={{ color: '#CBD5E1', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Delete</span>
        </div>
      </div>

      {/* ── Main content — centered card ─────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 61px)', padding: 24,
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Warning icon */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg,#FEF2F2,#FEE2E2)',
              border: '2px solid #FECACA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(220,38,38,0.15)',
            }}>
              <ShieldAlert size={34} color="#DC2626" strokeWidth={1.8} />
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: '#0F172A',
              margin: '0 0 8px', letterSpacing: '-0.03em',
            }}>
              Delete Route
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              You are about to permanently delete this route.
            </p>
          </div>

          {/* Route info card */}
          <div style={{
            background: '#fff', borderRadius: 16,
            border: '1px solid #E2E8F0',
            padding: '20px 22px', marginBottom: 16,
            boxShadow: '0 1px 6px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: '#FEF2F2', border: '1.5px solid #FECACA',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Route size={22} color="#DC2626" strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {routeName}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
                  Route ID: {id?.slice(0, 8)}…
                </div>
              </div>
            </div>
          </div>

          {/* Warning consequences card */}
          <div style={{
            background: '#FFFBEB', borderRadius: 14,
            border: '1px solid #FDE68A',
            padding: '16px 18px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={17} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                  This action cannot be undone. The following will be lost:
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'All customer mappings for this route',
                    'Route assignment history',
                    'Salesman assignment for this route',
                  ].map(item => (
                    <li key={item} style={{ fontSize: 13, color: '#B45309' }}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 16,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#DC2626', fontWeight: 600,
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
                border: '1.5px solid #E2E8F0', background: '#fff',
                color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
            >
              Cancel
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                flex: 1, padding: '13px', borderRadius: 11,
                border: 'none',
                background: deleting
                  ? '#FCA5A5'
                  : 'linear-gradient(135deg,#B91C1C 0%,#DC2626 100%)',
                color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: deleting ? 'none' : '0 4px 14px rgba(220,38,38,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {deleting
                ? <><Spinner size={16} /> Deleting…</>
                : <><Trash2 size={16} /> Yes, Delete Route</>
              }
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#CBD5E1', marginTop: 16 }}>
            Route data will be permanently removed from the database
          </p>
        </div>
      </div>
    </div>
  );
}