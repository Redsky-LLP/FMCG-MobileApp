// PATH: src/pages/Admin/AdminRoutes/components/RoutesTable.tsx
// UPDATED: Added "Customers" action button — clicking navigates to
//          /admin/customers?routeId=<id> so admin can see customers for that route.

import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../../components/ui';
import { ActionBtn } from './ActionBtn';
import { Route, Users, Edit2, Trash2, Calendar, ChevronDown } from 'lucide-react';
import { fmtDate } from '../../../../types';
import type { RouteDto } from '../../../../types';

interface RoutesTableProps {
  routes:    RouteDto[];
  onAssign:  (route: RouteDto) => void;
  onOverride:(route: RouteDto) => void;
  onEdit:    (route: RouteDto) => void;
  onDelete:  (routeId: string) => void;
}

export function RoutesTable({
  routes, onAssign, onOverride, onEdit, onDelete,
}: RoutesTableProps) {
  const navigate = useNavigate();
  const hasCustomers = (n?: number) => !!(n && n > 0);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff' }}>
        <thead>
          <tr>
            {['Route Name', 'Assigned Salesman', 'Customers', 'Status', 'Created', 'Override', 'Actions'].map(h => (
              <th key={h} style={{
                background: '#F8FAFC', color: '#64748B',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase' as const, padding: '12px 16px',
                borderBottom: '1px solid #E2E8F0', textAlign: 'left' as const,
                whiteSpace: 'nowrap' as const,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map(r => (
            <tr
              key={r.id}
              style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFBFD'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {/* Route name */}
              <td style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Route size={16} color="#2563EB" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{r.name}</div>
                    {r.description && <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 1 }}>{r.description}</div>}
                  </div>
                </div>
              </td>

              {/* Salesman */}
              <td style={{ padding: '14px 16px' }}>
                {r.assignedSalesmanName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#2563EB' }}>
                        {r.assignedSalesmanName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{r.assignedSalesmanName}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>— Not Assigned —</span>
                )}
              </td>

              {/* Customers — clickable to navigate */}
              <td style={{ padding: '14px 16px' }}>
                <button
                  onClick={() => navigate(`/admin/customers?routeId=${r.id}`)}
                  title="View customers for this route"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 700,
                    color: hasCustomers(r.customerCount) ? '#2563EB' : '#94A3B8',
                    background: hasCustomers(r.customerCount) ? '#EFF6FF' : 'transparent',
                    border: hasCustomers(r.customerCount) ? '1px solid #BFDBFE' : 'none',
                    borderRadius: 7, padding: hasCustomers(r.customerCount) ? '4px 10px' : '0',
                    cursor: hasCustomers(r.customerCount) ? 'pointer' : 'default',
                    fontFamily: 'inherit', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => hasCustomers(r.customerCount) && ((e.currentTarget as HTMLElement).style.background = '#DBEAFE')}
                  onMouseLeave={e => hasCustomers(r.customerCount) && ((e.currentTarget as HTMLElement).style.background = '#EFF6FF')}
                >
                  <Users size={13} />
                  {r.customerCount ?? 0}
                </button>
              </td>

              {/* Status */}
              <td style={{ padding: '14px 16px' }}>
                <Badge variant={r.isActive ? 'green' : 'muted'}>
                  {r.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>

              {/* Created */}
              <td style={{ padding: '14px 16px', color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>
                {r.createdAt ? fmtDate(r.createdAt) : '—'}
              </td>

              {/* Override badge */}
              <td style={{ padding: '14px 16px' }}>
                {r.hasOverrideToday && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: 'rgba(217,119,6,0.10)',
                    color: '#B45309', padding: '3px 8px',
                    borderRadius: 6, border: '1px solid rgba(217,119,6,0.20)',
                  }}>
                    Override Today
                  </span>
                )}
              </td>

              {/* Actions */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' as const }}>
                  <ActionBtn
                    icon={Calendar}
                    label="Assign"
                    color="blue"
                    title="Assign salesman for today"
                    onClick={() => onAssign(r)}
                  />
                  <ActionBtn
                    icon={ChevronDown}
                    label="Override"
                    color="amber"
                    title="Assign different salesman for a specific date"
                    onClick={() => onOverride(r)}
                  />
                  <ActionBtn
                    icon={Edit2}
                    label="Edit"
                    color="default"
                    title="Edit route"
                    onClick={() => onEdit(r)}
                  />
                  <ActionBtn
                    icon={Trash2}
                    label="Delete"
                    color="red"
                    title={hasCustomers(r.customerCount) ? 'Cannot delete route with customers' : 'Delete route'}
                    disabled={hasCustomers(r.customerCount)}
                    onClick={() => onDelete(String(r.id))}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}