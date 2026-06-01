// PATH: src/pages/Admin/AdminCustomers.tsx
// Kyte-style redesign with dedicated Reorder and Delete pages

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, Users, Search, RefreshCw,
  AlertTriangle, Phone, MapPin, Route, X, Save,
  ChevronRight, ArrowUpDown, MoveRight, Trash,
} from 'lucide-react';
import { customersApi, routesApi } from '../../api/services';
import type { CustomerDto, RouteDto } from '../../types';
import { PageLoader, Spinner, Alert, ConfirmModal } from '../../components/ui';

// ── Avatar with initials ─────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors   = ['#2563EB', '#1E3A8A', '#7C3AED', '#0891B2', '#D97706', '#16A34A'];
  const color    = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}18`, border: `2px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.35, fontWeight: 800, color }}>{initials}</span>
    </div>
  );
}

// ── Reorder Page (Full width slide-in panel) ─────────────────
function ReorderPage({
  customer,
  customers,
  onClose,
  onReorder,
  saving,
}: {
  customer: CustomerDto;
  customers: CustomerDto[];
  onClose: () => void;
  onReorder: (newSeq: number) => void;
  saving: boolean;
}) {
  const currentSeq = customer.sequenceOrder;
  const routeCustomers = customers
    .filter(c => c.routeId === customer.routeId)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const maxSeq = routeCustomers.length;
  const [selectedPosition, setSelectedPosition] = useState(currentSeq > 0 ? currentSeq : 1);

  const handleSubmit = () => {
    if (selectedPosition === currentSeq) {
      onClose();
      return;
    }
    onReorder(selectedPosition);
  };

  // Preview what the order will look like
  const getPreviewOrder = () => {
    const ordered = [...routeCustomers];
    const oldIndex = ordered.findIndex(c => c.id === customer.id);
    const newIndex = selectedPosition - 1;
    
    if (oldIndex === -1 || oldIndex === newIndex) return ordered;
    
    const [moved] = ordered.splice(oldIndex, 1);
    ordered.splice(newIndex, 0, moved);
    return ordered;
  };

  const previewOrder = getPreviewOrder();

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520,
        background: '#fff', zIndex: 210,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        animation: 'slide-in-right 0.26s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoveRight size={20} color="#2563EB" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>Reorder Visit Sequence</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>{customer.nameEnglish}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
              New Position (1–{maxSeq})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={1}
                max={maxSeq}
                value={selectedPosition}
                onChange={e => setSelectedPosition(parseInt(e.target.value))}
                style={{ flex: 1, height: 4, borderRadius: 2, accentColor: '#2563EB' }}
              />
              <div style={{
                width: 60, height: 60, borderRadius: 12,
                background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 24, fontWeight: 800
              }}>
                {selectedPosition}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Preview Order
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 4 }}>
              {previewOrder.map((c, idx) => {
                const isMoving = c.id === customer.id;
                const newPosition = idx + 1;
                const isChanged = isMoving && newPosition !== currentSeq;
                
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', margin: 4,
                      borderRadius: 8,
                      background: isMoving ? '#EFF6FF' : 'transparent',
                      border: isMoving ? '1px solid rgba(37,99,235,0.25)' : 'none',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: isMoving ? '#2563EB' : '#E2E8F0',
                      color: isMoving ? '#fff' : '#64748B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14
                    }}>
                      {newPosition}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{c.nameEnglish}</div>
                      {c.nameMalayalam && (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.nameMalayalam}</div>
                      )}
                    </div>
                    {isChanged && (
                      <div style={{ fontSize: 11, color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: 12 }}>
                        {currentSeq} → {newPosition}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: 12, background: '#FFFBEB', borderRadius: 10, border: '1px solid #FEF3C7' }}>
            <div style={{ fontSize: 12, color: '#D97706', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} />
              <span>All customers on this route will be renumbered sequentially (1, 2, 3...)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || selectedPosition === currentSeq}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 800,
              color: '#fff', border: 'none',
              background: (saving || selectedPosition === currentSeq) ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)',
              cursor: (saving || selectedPosition === currentSeq) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(37,99,235,0.25)'
            }}
          >
            {saving ? <Spinner size={15} /> : <><MoveRight size={14} /> Apply Reorder</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Delete Confirmation Page (Slide-in panel) ─────────────────
function DeletePage({
  customer,
  onClose,
  onDelete,
  deleting,
}: {
  customer: CustomerDto;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480,
        background: '#fff', zIndex: 210,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
        animation: 'slide-in-right 0.26s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash size={20} color="#DC2626" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#DC2626', letterSpacing: '-0.02em' }}>Delete Customer</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>This action cannot be undone</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <Avatar name={customer.nameEnglish} size={56} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{customer.nameEnglish}</div>
              {customer.nameMalayalam && (
                <div style={{ fontSize: 13, color: '#64748B' }}>{customer.nameMalayalam}</div>
              )}
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                {customer.phoneNumber} · {customer.routeName}
              </div>
            </div>
          </div>

          <div style={{ background: '#FEF2F2', borderRadius: 12, padding: 16, border: '1px solid #FEE2E2', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertTriangle size={18} color="#DC2626" />
              <span style={{ fontWeight: 700, color: '#B91C1C' }}>Warning: Permanent Deletion</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#7F1D1D', fontSize: 13, lineHeight: 1.6 }}>
              <li>Customer will be permanently removed</li>
              <li>All order history for this customer will be deleted</li>
              <li>Outstanding payments and settlement records will be removed</li>
              <li>This action cannot be reversed</li>
            </ul>
          </div>

          <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 10, border: '1px solid #DBEAFE' }}>
            <div style={{ fontSize: 12, color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💡</span>
              <span>If you want to temporarily disable this customer, consider setting them as Inactive instead of deleting.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button
            onClick={onDelete}
            disabled={deleting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 800,
              color: '#fff', border: 'none',
              background: deleting ? '#FCA5A5' : '#DC2626',
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(220,38,38,0.25)'
            }}
          >
            {deleting ? <Spinner size={15} /> : <><Trash size={14} /> Permanently Delete</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Customer Card ────────────────────────────────────────────
function CustomerCard({
  customer, onEdit, onReorder, onDelete,
}: {
  customer: CustomerDto;
  onEdit:   () => void;
  onReorder: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasSeqWarn = customer.sequenceOrder === 0;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? 'rgba(37,99,235,0.25)' : '#E2E8F0'}`,
        borderRadius: 14,
        padding: '18px 18px 14px',
        transition: 'all 0.18s',
        boxShadow: hovered ? '0 4px 20px rgba(37,99,235,0.08)' : '0 1px 3px rgba(15,23,42,0.05)',
        cursor: 'default',
        position: 'relative' as const,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        position: 'absolute', top: 14, right: 14,
        width: 8, height: 8, borderRadius: '50%',
        background: customer.isActive ? '#16A34A' : '#94A3B8',
        boxShadow: customer.isActive ? '0 0 0 2px rgba(22,163,74,0.20)' : 'none',
      }} title={customer.isActive ? 'Active' : 'Inactive'} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <Avatar name={customer.nameEnglish} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 2 }}>
            {customer.nameEnglish}
          </div>
          {customer.nameMalayalam && (
            <div style={{ fontSize: 12, color: '#64748B', fontFamily: "'Manjari', sans-serif", fontWeight: 500 }}>
              {customer.nameMalayalam}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
        {customer.phoneNumber && (
          <a href={`tel:${customer.phoneNumber}`} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
            <Phone size={12} /> {customer.phoneNumber}
          </a>
        )}
        {customer.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#64748B', fontWeight: 500 }}>
            <MapPin size={11} style={{ flexShrink: 0 }} /> {customer.address}
          </div>
        )}
        {customer.routeName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            <Route size={11} style={{ flexShrink: 0 }} /> {customer.routeName}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
        {hasSeqWarn ? (
          <button
            onClick={onEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 8,
              background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)',
              color: '#D97706', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <AlertTriangle size={11} /> Set Sequence
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 8,
            background: '#EFF6FF', border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>STOP</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#2563EB' }}>{customer.sequenceOrder}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onReorder}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC',
              fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer',
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.25)'; (e.currentTarget as HTMLElement).style.color = '#2563EB'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#334155'; }}
          >
            <ArrowUpDown size={12} /> Reorder
          </button>
          <button
            onClick={onEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC',
              fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer',
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.25)'; (e.currentTarget as HTMLElement).style.color = '#2563EB'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#334155'; }}
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid #E2E8F0', background: '#F8FAFC',
              color: '#94A3B8', cursor: 'pointer', transition: 'all 0.13s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.25)'; (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#94A3B8'; }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form Fields Component ────────────────────────────────────
interface FormFieldsProps {
  form: {
    name: string;
    nameMl: string;
    phone: string;
    address: string;
    routeId: string;
    sequenceOrder: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  routes: RouteDto[];
  isEdit?: boolean;
}

const FormFields = React.memo(({ form, setForm, routes, isEdit = false }: FormFieldsProps) => {
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit && nameInputRef.current && !form.name) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isEdit, form.name]);

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  }, [setForm]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, fontSize: 14, color: '#334155',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', transition: 'all 0.15s',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
          Customer Name <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <input
          ref={nameInputRef}
          type="text"
          value={form.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder="Shop / business name"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
          Malayalam Name <span style={{ fontSize: 10, color: '#94A3B8' }}>(optional)</span>
        </label>
        <input
          type="text"
          value={form.nameMl}
          onChange={e => handleChange('nameMl', e.target.value)}
          placeholder="പേര്"
          lang="ml"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        />
      </div>

      <div style={{ gridColumn: isEdit ? undefined : '1 / -1' }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
          Route <span style={{ color: '#DC2626' }}>*</span>
        </label>
        <select
          value={form.routeId}
          onChange={e => handleChange('routeId', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        >
          <option value="">Select route</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {isEdit && (
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Visit Sequence <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            type="number"
            min="1"
            value={form.sequenceOrder}
            onChange={e => handleChange('sequenceOrder', e.target.value)}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
          />
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Order salesman visits (1 = first stop)</div>
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Phone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={e => handleChange('phone', e.target.value)}
          placeholder="+91 9876543210"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Address</label>
        <input
          type="text"
          value={form.address}
          onChange={e => handleChange('address', e.target.value)}
          placeholder="Shop / locality"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        />
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// AdminCustomers page
// ═══════════════════════════════════════════════════════════
export function AdminCustomers() {
  const [customers,   setCustomers]   = useState<CustomerDto[]>([]);
  const [routes,      setRoutes]      = useState<RouteDto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [search,      setSearch]      = useState('');
  const [searchParams] = useSearchParams();
  const [routeFilter, setRouteFilter] = useState(() => searchParams.get('routeId') ?? '');
  const [showAdd,     setShowAdd]     = useState(false);
  const [editModal,   setEditModal]   = useState<CustomerDto | null>(null);
  const [reorderPage, setReorderPage] = useState<CustomerDto | null>(null);
  const [deletePage,  setDeletePage]  = useState<CustomerDto | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [reordering,  setReordering]  = useState(false);
  const addCardRef = useRef<HTMLDivElement>(null);

  const emptyForm = { name: '', nameMl: '', phone: '', address: '', routeId: '', sequenceOrder: '1' };
  const [addForm,  setAddForm]  = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  async function load() {
    setLoading(true); setError('');
    try {
      const [c, r] = await Promise.all([
        customersApi.getAll(routeFilter || undefined),
        routesApi.getAll(),
      ]);
      setCustomers(c); setRoutes(r);
    } catch (err: unknown) {
      console.error('Load error:', err);
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [routeFilter]);

  useEffect(() => {
    if (showAdd) {
      const defaultRoute = String(routes[0]?.id ?? '');
      setAddForm({ ...emptyForm, routeId: defaultRoute, sequenceOrder: String(nextSeq(defaultRoute)) });
      setTimeout(() => addCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [showAdd, routes]);

  function nextSeq(routeId: string): number {
    const existing = customers.filter(c => c.routeId === routeId && c.sequenceOrder > 0).map(c => c.sequenceOrder);
    return existing.length > 0 ? Math.max(...existing) + 1 : 1;
  }

  function openEdit(c: CustomerDto) {
    setEditForm({
      name: c.nameEnglish, nameMl: c.nameMalayalam ?? '',
      phone: c.phoneNumber ?? '', address: c.address ?? '',
      routeId: c.routeId,
      sequenceOrder: String(c.sequenceOrder > 0 ? c.sequenceOrder : nextSeq(c.routeId)),
    });
    setEditModal(c);
  }

  async function handleReorder(customer: CustomerDto, newSeq: number) {
    setReordering(true);
    setError('');
    try {
      await customersApi.reorder(customer.routeId, customer.id, newSeq);
      setReorderPage(null);
      setSuccess('Customer order updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      await load();
    } catch (err) {
      console.error('Reorder error:', err);
      setError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setReordering(false);
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.routeId) return;
    setSaving(true); setError('');
    try {
      await customersApi.create({
        nameEnglish: addForm.name, nameMalayalam: addForm.nameMl || undefined,
        phoneNumber: addForm.phone || undefined, address: addForm.address || undefined,
        routeId: addForm.routeId,
      });
      setShowAdd(false); setAddForm(emptyForm); load();
      setSuccess('Customer added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) { 
      console.error('Add error:', err);
      setError(err instanceof Error ? err.message : 'Save failed'); 
    }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editForm.name.trim() || !editForm.routeId || !editModal) return;
    setSaving(true); setError('');
    try {
      const updatePayload = {
        id: editModal.id,
        nameEnglish: editForm.name,
        nameMalayalam: editForm.nameMl || undefined,
        phoneNumber: editForm.phone || undefined,
        address: editForm.address || undefined,
        routeId: editForm.routeId,
        isActive: editModal.isActive,
      };
      await customersApi.update(editModal.id, updatePayload);
      setEditModal(null); 
      load();
      setSuccess('Customer updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) { 
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Save failed'); 
    }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deletePage) return;
    setDeleting(true);
    setError('');
    try {
      await customersApi.delete(deletePage.id); 
      setDeletePage(null); 
      await load();
      setSuccess('Customer deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) { 
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Delete failed'); 
    }
    finally { setDeleting(false); }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || (c.nameEnglish ?? '').toLowerCase().includes(q)
      || (c.nameMalayalam ?? '').includes(search)
      || (c.phoneNumber ?? '').includes(search);
  });

  const zeroSeqCount = filtered.filter(c => c.sequenceOrder === 0).length;

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--navy)', letterSpacing: '-0.03em' }}>Customers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => load()} title="Refresh"><RefreshCw size={14} /></button>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800,
            color: showAdd ? '#64748B' : '#fff', border: showAdd ? '1px solid #E2E8F0' : 'none',
            background: showAdd ? 'transparent' : 'linear-gradient(135deg,#1E3A8A,#2563EB)',
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: showAdd ? 'none' : '0 3px 10px rgba(37,99,235,0.28)',
            transition: 'all 0.15s', letterSpacing: '-0.01em',
          }}
        >
          {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Customer</>}
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {zeroSeqCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', fontSize: 13, color: '#D97706', fontWeight: 600 }}>
          <AlertTriangle size={15} />
          <span><strong>{zeroSeqCount}</strong> customer{zeroSeqCount > 1 ? 's have' : ' has'} Sequence = 0 — edit to set visit order.</span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input 
            type="text"
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by name, phone..."
            style={{
              width: '100%', padding: '11px 14px 11px 38px',
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 10, fontSize: 14, color: '#334155',
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
          />
        </div>
        <select 
          value={routeFilter} 
          onChange={e => setRouteFilter(e.target.value)}
          style={{
            width: 'auto', minWidth: 160, padding: '11px 14px',
            background: '#fff', border: '1px solid #E2E8F0',
            borderRadius: 10, fontSize: 14, color: '#334155',
            outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          }}
          onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
        >
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Inline Add Customer card */}
      {showAdd && (
        <div ref={addCardRef} style={{
          background: '#fff', border: '1.5px solid rgba(37,99,235,0.25)',
          borderRadius: 16, padding: '24px 24px 20px',
          boxShadow: '0 4px 24px rgba(37,99,235,0.10)',
          marginBottom: 24, animation: 'slide-up 0.22s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
              <Users size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>New Customer</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Fill in the details below</div>
            </div>
          </div>

          <FormFields form={addForm} setForm={setAddForm} routes={routes} />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
            <button onClick={() => { setShowAdd(false); setError(''); }} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving || !addForm.name.trim() || !addForm.routeId}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', background: saving || !addForm.name.trim() || !addForm.routeId ? '#93C5FD' : 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(37,99,235,0.25)' }}
            >
              {saving ? <Spinner size={15} /> : <><Save size={15} /> Save Customer</>}
            </button>
          </div>
        </div>
      )}

      {/* Customer grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={28} style={{ opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#334155', marginBottom: 6 }}>No customers found</div>
          <div style={{ fontSize: 13 }}>Add customers or adjust your filters.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              onEdit={() => openEdit(c)}
              onReorder={() => setReorderPage(c)}
              onDelete={() => setDeletePage(c)}
            />
          ))}
        </div>
      )}

      {/* Reorder Page (Slide-in) */}
      {reorderPage && (
        <ReorderPage
          customer={reorderPage}
          customers={customers}
          onClose={() => setReorderPage(null)}
          onReorder={(newSeq) => handleReorder(reorderPage, newSeq)}
          saving={reordering}
        />
      )}

      {/* Delete Page (Slide-in) */}
      {deletePage && (
        <DeletePage
          customer={deletePage}
          onClose={() => setDeletePage(null)}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}

      {/* Edit Modal (Slide-in) */}
      {editModal && (
        <>
          <div onClick={() => setEditModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.40)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480,
            background: '#fff', zIndex: 210,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(15,23,42,0.14)',
            animation: 'slide-in-right 0.26s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <Avatar name={editModal.nameEnglish} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>Edit Customer</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{editModal.nameEnglish}</div>
              </div>
              <button onClick={() => setEditModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {error && <Alert variant="error">{error}</Alert>}
              <FormFields form={editForm} setForm={setEditForm} routes={routes} isEdit />
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#64748B', border: '1px solid #E2E8F0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleEdit} disabled={saving || !editForm.name.trim() || !editForm.routeId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(37,99,235,0.25)' }}
              >
                {saving ? <Spinner size={15} /> : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}