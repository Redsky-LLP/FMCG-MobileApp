import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Gift, RefreshCw } from 'lucide-react';
import { incentivesApi, productsApi } from '../../api/services';
import type { ProductIncentiveDto, ProductSearchDto } from '../../types';
import { fmt, fmtDate } from '../../types';
import { PageLoader, Spinner, Alert, Badge, EmptyState, Field, ConfirmModal } from '../../components/ui';

const INCENTIVE_TYPES = { 1: 'Per Unit (₹)', 2: 'Percentage (%)' };

export function AdminIncentives() {
  const [incentives, setIncentives] = useState<ProductIncentiveDto[]>([]);
  const [products,   setProducts]   = useState<ProductSearchDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [modal,      setModal]      = useState<'add' | 'edit' | null>(null);
  const [confirm,    setConfirm]    = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [selected,   setSelected]   = useState<ProductIncentiveDto | null>(null);
  const [form, setForm] = useState({
    productId: '', incentiveType: '1', incentiveValue: '',
    minQuantity: '', validFrom: '', validTo: '', description: '',
  });

  async function load() {
    setLoading(true); setError('');
    try {
      const [inc, prod] = await Promise.all([
        incentivesApi.getProductIncentives(),
        productsApi.search(undefined, undefined, 200),
      ]);
      setIncentives(inc); setProducts(prod);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setSelected(null);
    setForm({ productId: '', incentiveType: '1', incentiveValue: '', minQuantity: '', validFrom: '', validTo: '', description: '' });
    setModal('add');
  }

  function openEdit(inc: ProductIncentiveDto) {
    setSelected(inc);
    setForm({
      productId: inc.productId,
      incentiveType: inc.incentiveType.toString(),
      incentiveValue: inc.incentiveValue.toString(),
      minQuantity: inc.minQuantity?.toString() ?? '',
      validFrom: inc.validFrom?.split('T')[0] ?? '',
      validTo: inc.validTo?.split('T')[0] ?? '',
      description: inc.description ?? '',
    });
    setModal('edit');
  }

  async function handleSave() {
    if (!form.productId || !form.incentiveValue) return;
    setSaving(true); setError('');
    try {
      const payload = {
        productId: form.productId,
        incentiveType: parseInt(form.incentiveType),
        incentiveValue: parseFloat(form.incentiveValue),
        minQuantity: form.minQuantity ? parseInt(form.minQuantity) : undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        description: form.description || undefined,
      };
      if (modal === 'add') {
        await incentivesApi.createProductIncentive(payload);
      } else if (selected) {
        await incentivesApi.updateProductIncentive(selected.id, payload);
      }
      setModal(null); load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(true);
    try { await incentivesApi.deleteProductIncentive(confirm); setConfirm(null); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(false); }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Incentives</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>SKU-level salesman incentive configuration</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Incentive</button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {incentives.length === 0 ? (
        <EmptyState title="No incentives configured" message="Add product incentives to motivate your salesmen." icon={Gift} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>Product</th><th>Type</th><th>Value</th><th>Min Qty</th><th>Valid</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {incentives.map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontWeight: 600 }}>{inc.productName ?? inc.productId.slice(0, 8)}</td>
                  <td style={{ fontSize: 13 }}>{INCENTIVE_TYPES[inc.incentiveType as 1 | 2] ?? '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {inc.incentiveType === 1 ? fmt(inc.incentiveValue) : `${inc.incentiveValue}%`}
                  </td>
                  <td style={{ fontSize: 13 }}>{inc.minQuantity ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {inc.validFrom ? fmtDate(inc.validFrom) : '∞'} – {inc.validTo ? fmtDate(inc.validTo) : '∞'}
                  </td>
                  <td><Badge variant={inc.isActive ? 'green' : 'muted'}>{inc.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(inc)}><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirm(inc.id)}><Trash2 size={14} color="var(--red)" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontWeight: 700 }}>{modal === 'add' ? 'Add Incentive' : 'Edit Incentive'}</h3>
            {error && <Alert variant="error">{error}</Alert>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <Field label="Product" required>
                <select className="input" value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}>
                  <option value="">Select Product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.nameEnglish} {p.nameMalayalam ? `(${p.nameMalayalam})` : ''}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Incentive Type" required>
                  <select className="input" value={form.incentiveType} onChange={(e) => setForm((p) => ({ ...p, incentiveType: e.target.value }))}>
                    <option value="1">Per Unit (₹)</option>
                    <option value="2">Percentage (%)</option>
                  </select>
                </Field>
                <Field label="Value" required>
                  <input className="input" type="number" step="0.01" value={form.incentiveValue} onChange={(e) => setForm((p) => ({ ...p, incentiveValue: e.target.value }))} placeholder="e.g. 5" />
                </Field>
              </div>
              <Field label="Min Quantity">
                <input className="input" type="number" value={form.minQuantity} onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))} placeholder="e.g. 10" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Valid From"><input className="input" type="date" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} /></Field>
                <Field label="Valid To"><input className="input" type="date" value={form.validTo} onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))} /></Field>
              </div>
              <Field label="Description">
                <input className="input" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional note" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size={16} /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title="Delete Incentive" message="This will permanently delete the incentive rule."
          danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
