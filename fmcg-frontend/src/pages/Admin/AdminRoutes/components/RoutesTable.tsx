// PATH: src/pages/Admin/AdminRoutes/components/RoutesTable.tsx
// UPDATED: Dark theme with orange accent

import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../../components/ui';
import { ActionBtn } from './ActionBtn';
import { Route, Users, Edit2, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { fmtDate } from '../../../../types';
import type { RouteDto } from '../../../../types';
import { useIsMobile } from '../../../../hooks/useIsMobile';

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

interface RoutesTableProps {
  routes:    RouteDto[];
  onAssign:  (route: RouteDto) => void;
  onEdit:    (route: RouteDto) => void;
  onDelete:  (routeId: string) => void;
}

export function RoutesTable({
  routes, onAssign, onEdit, onDelete,
}: RoutesTableProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const hasCustomers = (n?: number) => !!(n && n > 0);

  function getDuplicateWarning(route: RouteDto): string | null {
    if (!route.assignedSalesmanName || !route.name) return null;
    const duplicates = routes.filter(r =>
      r.id !== route.id &&
      r.name?.trim().toLowerCase() === route.name?.trim().toLowerCase() &&
      r.assignedSalesmanName === route.assignedSalesmanName
    );
    if (duplicates.length > 0) {
      return `${route.assignedSalesmanName} is already assigned to another "${route.name}" route`;
    }
    return null;
  }

  // ── Mobile card layout ──────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {routes.map(r => {
          const dupWarning = getDuplicateWarning(r);
          return (
            <div key={r.id} style={{
              background: D.surface,
              border: dupWarning ? `1px solid ${D.amber}` : `1px solid ${D.border}`,
              borderRadius: 14, padding: '14px 16px',
            }}>
              {dupWarning && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 10,
                  background: 'rgba(245,158,11,0.10)',
                  border: `1px solid rgba(245,158,11,0.25)`,
                }}>
                  <AlertTriangle size={13} color={D.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: D.amber, lineHeight: 1.4 }}>{dupWarning}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Route size={18} color={D.accent} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: D.text, marginBottom: 2 }}>{r.name}</div>
                  {r.description && <div style={{ color: D.sub, fontSize: 12 }}>{r.description}</div>}
                </div>
                <Badge variant={r.isActive ? 'green' : 'muted'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: D.accent }}>
                      {r.assignedSalesmanName ? r.assignedSalesmanName.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                  <span style={{ color: r.assignedSalesmanName ? D.text : D.sub, fontStyle: r.assignedSalesmanName ? 'normal' : 'italic', fontWeight: 600 }}>
                    {r.assignedSalesmanName ?? 'Not Assigned'}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/admin/customers?routeId=${r.id}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700,
                    color: hasCustomers(r.customerCount) ? D.accent : D.sub,
                    background: hasCustomers(r.customerCount) ? `${D.accent}15` : 'transparent',
                    border: hasCustomers(r.customerCount) ? `1px solid ${D.accent}33` : 'none',
                    borderRadius: 6, padding: hasCustomers(r.customerCount) ? '3px 8px' : '0',
                    cursor: hasCustomers(r.customerCount) ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  <Users size={11} />
                  {r.customerCount ?? 0} customers
                </button>
                {r.createdAt && <span style={{ color: D.sub }}>Created {fmtDate(r.createdAt)}</span>}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ActionBtn icon={Calendar} label="Assign" color="blue" title="Assign salesman to this route" onClick={() => onAssign(r)} />
                <ActionBtn icon={Edit2} label="Edit" color="default" title="Edit route" onClick={() => onEdit(r)} />
                <ActionBtn
                  icon={Trash2} label="Delete" color="red"
                  title={hasCustomers(r.customerCount) ? 'Cannot delete route with customers' : 'Delete route'}
                  disabled={hasCustomers(r.customerCount)}
                  onClick={() => onDelete(String(r.id))}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Desktop table layout ────────────────────────────────────
  return (
    <div style={{
      background: D.surface,
      borderRadius: 14,
      border: `1px solid ${D.border}`,
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 14, background: D.surface }}>
          <thead>
            <tr>
              {['Route Name', 'Assigned Salesman', 'Customers', 'Status', 'Created', 'Actions'].map(h => (
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
            {routes.map(r => {
              const dupWarning = getDuplicateWarning(r);
              return (
                <tr key={r.id}
                  style={{
                    borderBottom: `1px solid ${D.border}`,
                    transition: 'background 0.12s',
                    background: dupWarning ? 'rgba(245,158,11,0.05)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dupWarning ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = dupWarning ? 'rgba(245,158,11,0.05)' : 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Route size={16} color={D.accent} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: D.text }}>{r.name}</div>
                        {r.description && <div style={{ color: D.sub, fontSize: 12, marginTop: 1 }}>{r.description}</div>}
                        {dupWarning && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <AlertTriangle size={11} color={D.amber} />
                            <span style={{ fontSize: 11, color: D.amber }}>{dupWarning}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {r.assignedSalesmanName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${D.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: D.accent }}>
                            {r.assignedSalesmanName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>{r.assignedSalesmanName}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: D.sub, fontStyle: 'italic' }}>— Not Assigned —</span>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <button
                      onClick={() => navigate(`/admin/customers?routeId=${r.id}`)}
                      title="View customers for this route"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 700,
                        color: hasCustomers(r.customerCount) ? D.accent : D.sub,
                        background: hasCustomers(r.customerCount) ? `${D.accent}15` : 'transparent',
                        border: hasCustomers(r.customerCount) ? `1px solid ${D.accent}33` : 'none',
                        borderRadius: 7, padding: hasCustomers(r.customerCount) ? '4px 10px' : '0',
                        cursor: hasCustomers(r.customerCount) ? 'pointer' : 'default',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => hasCustomers(r.customerCount) && ((e.currentTarget as HTMLElement).style.background = `${D.accent}25`)}
                      onMouseLeave={e => hasCustomers(r.customerCount) && ((e.currentTarget as HTMLElement).style.background = `${D.accent}15`)}
                    >
                      <Users size={13} />
                      {r.customerCount ?? 0}
                    </button>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <Badge variant={r.isActive ? 'green' : 'muted'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>

                  <td style={{ padding: '14px 16px', color: D.sub, fontSize: 12, fontWeight: 500 }}>
                    {r.createdAt ? fmtDate(r.createdAt) : '—'}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' as const }}>
                      <ActionBtn icon={Calendar} label="Assign" color="blue" title="Assign salesman to this route" onClick={() => onAssign(r)} />
                      <ActionBtn icon={Edit2} label="Edit" color="default" title="Edit route" onClick={() => onEdit(r)} />
                      <ActionBtn
                        icon={Trash2} label="Delete" color="red"
                        title={hasCustomers(r.customerCount) ? 'Cannot delete route with customers' : 'Delete route'}
                        disabled={hasCustomers(r.customerCount)}
                        onClick={() => onDelete(String(r.id))}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}