import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, DollarSign, Package } from 'lucide-react';
import { productsApi, unitsApi } from '../../api/services';
import { ProductUnitPriceDto, UnitDto, ProductDto } from '../../types';
import { Spinner, Alert, ConfirmModal, Field } from '../ui';

interface ProductUnitPriceManagerProps {
    product: ProductDto;
    onClose: () => void;
    onUpdate: () => void;
}

export function ProductUnitPriceManager({ product, onClose, onUpdate }: ProductUnitPriceManagerProps) {
    const [unitPrices, setUnitPrices] = useState<ProductUnitPriceDto[]>([]);
    const [units, setUnits] = useState<UnitDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null);
    const [selectedPrice, setSelectedPrice] = useState<ProductUnitPriceDto | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [form, setForm] = useState({
        productUnitId: '',
        unitSize: 1,
        unitSizeLabel: '',
        salePrice: 0,
        salePrice2: 0,
        salePrice3: 0,
        salePrice4: 0,
        purchaseRate: 0,
        landingCost: 0,
        mrp: 0,
        mop: 0,
        discount1: 0,
        discount2: 0,
        discount3: 0,
        discount4: 0,
        vat: 0,
        floodCost: 0,
        isDefault: false,
    });

    async function load() {
        setLoading(true);
        try {
            const [prices, unitList] = await Promise.all([
                productsApi.getUnitPrices(product.id),
                unitsApi.getAll(),
            ]);
            setUnitPrices(prices);
            setUnits(unitList);
        } catch (err: any) {
            setError(err.message || 'Failed to load unit prices');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [product.id]);

    function openAdd() {
        setSelectedPrice(null);
        setForm({
            productUnitId: '',
            unitSize: 1,
            unitSizeLabel: '',
            salePrice: 0,
            salePrice2: 0,
            salePrice3: 0,
            salePrice4: 0,
            purchaseRate: 0,
            landingCost: 0,
            mrp: 0,
            mop: 0,
            discount1: 0,
            discount2: 0,
            discount3: 0,
            discount4: 0,
            vat: 0,
            floodCost: 0,
            isDefault: unitPrices.length === 0, // First item becomes default
        });
        setModalOpen('add');
    }

    function openEdit(price: ProductUnitPriceDto) {
        setSelectedPrice(price);
        setForm({
            productUnitId: price.productUnitId,
            unitSize: price.unitSize,
            unitSizeLabel: price.unitSizeLabel || '',
            salePrice: price.salePrice,
            salePrice2: price.salePrice2,
            salePrice3: price.salePrice3,
            salePrice4: price.salePrice4,
            purchaseRate: price.purchaseRate,
            landingCost: price.landingCost,
            mrp: price.mrp,
            mop: price.mop,
            discount1: price.discount1,
            discount2: price.discount2,
            discount3: price.discount3,
            discount4: price.discount4,
            vat: price.vat,
            floodCost: price.floodCost,
            isDefault: price.isDefault,
        });
        setModalOpen('edit');
    }

    async function handleSave() {
        if (!form.productUnitId || form.salePrice <= 0) {
            setError('Please select a unit and enter a valid sale price.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = {
                productId: product.id,
                productUnitId: form.productUnitId,
                unitSize: form.unitSize,
                unitSizeLabel: form.unitSizeLabel || undefined,
                salePrice: form.salePrice,
                salePrice2: form.salePrice2,
                salePrice3: form.salePrice3,
                salePrice4: form.salePrice4,
                purchaseRate: form.purchaseRate,
                landingCost: form.landingCost,
                mrp: form.mrp,
                mop: form.mop,
                discount1: form.discount1,
                discount2: form.discount2,
                discount3: form.discount3,
                discount4: form.discount4,
                vat: form.vat,
                floodCost: form.floodCost,
                isDefault: form.isDefault,
            };

            if (modalOpen === 'add') {
                await productsApi.addUnitPrice(payload);
                setSuccess('Unit price added successfully!');
            } else if (selectedPrice) {
                await productsApi.updateUnitPrice(selectedPrice.id, { ...payload, id: selectedPrice.id, isActive: true });
                setSuccess('Unit price updated successfully!');
            }

            setModalOpen(null);
            await load();
            onUpdate();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        try {
            await productsApi.deleteUnitPrice(id);
            setSuccess('Unit price deleted successfully!');
            await load();
            onUpdate();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Delete failed');
        } finally {
            setDeleteConfirm(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Unit Prices</h2>
                        <p className="text-sm text-slate-500 mt-1">{product.nameEnglish}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && <Alert variant="error">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}

                    {/* Add Button */}
                    <div className="flex justify-end mb-4">
                        <button onClick={openAdd} className="btn btn-primary btn-sm flex items-center gap-2">
                            <Plus size={14} /> Add Unit Price
                        </button>
                    </div>

                    {/* Unit Prices Table */}
                    {loading ? (
                        <div className="text-center py-12"><Spinner /></div>
                    ) : unitPrices.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Package size={48} className="mx-auto mb-3 opacity-40" />
                            <p>No unit prices configured for this product.</p>
                            <p className="text-sm mt-1">Click "Add Unit Price" to set up pricing for different units.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Unit</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Size</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Sale Price</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">MRP</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Default</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {unitPrices.map(price => (
                                        <tr key={price.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium">{price.unitName}</td>
                                            <td className="px-4 py-3 text-right">
                                                {price.unitSize} {price.unitSizeLabel}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                                ₹{price.salePrice.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                ₹{price.mrp.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {price.isDefault && (
                                                    <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Default</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => openEdit(price)} className="p-1 text-slate-400 hover:text-blue-600">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(price.id)} className="p-1 text-slate-400 hover:text-red-600">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {(modalOpen === 'add' || modalOpen === 'edit') && (
                <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4" onClick={() => setModalOpen(null)}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold">{modalOpen === 'add' ? 'Add' : 'Edit'} Unit Price</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Unit" required>
                                    <select
                                        className="input"
                                        value={form.productUnitId}
                                        onChange={e => setForm({ ...form, productUnitId: e.target.value })}
                                    >
                                        <option value="">Select unit...</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Unit Size">
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.unitSize}
                                        onChange={e => setForm({ ...form, unitSize: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <Field label="Sale Price (₹)" required>
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.salePrice}
                                        onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                                <Field label="MRP (₹)">
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.mrp}
                                        onChange={e => setForm({ ...form, mrp: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                                <Field label="Purchase Rate">
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.purchaseRate}
                                        onChange={e => setForm({ ...form, purchaseRate: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="VAT %">
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.vat}
                                        onChange={e => setForm({ ...form, vat: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                                <Field label="Flood Cost">
                                    <input
                                        type="number"
                                        className="input"
                                        value={form.floodCost}
                                        onChange={e => setForm({ ...form, floodCost: parseFloat(e.target.value) || 0 })}
                                        step="0.01"
                                    />
                                </Field>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={form.isDefault}
                                    onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                                />
                                <label htmlFor="isDefault" className="text-sm">Set as default selling unit</label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button className="btn btn-outline" onClick={() => setModalOpen(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? <Spinner size={16} /> : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                open={!!deleteConfirm}
                title="Delete Unit Price"
                message="Are you sure you want to delete this unit price? This action cannot be undone."
                confirmLabel="Delete"
                danger
                onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
                onCancel={() => setDeleteConfirm(null)}
            />
        </div>
    );
}