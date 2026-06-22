// PATH: src/pages/Admin/AdminCatalogConfig.tsx
// UPDATED: Added Size Groups tab with full CRUD, added UQC field to Units

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings, Plus, Edit2, Trash2, X, Save,
  Boxes, Ruler, ArrowLeft, RefreshCw, ArrowUp, ArrowDown,
  TrendingUp, Layers,
} from 'lucide-react';
import { productGroupsApi, unitsApi, sizeGroupsApi } from '../../api/services';
import type { ProductGroupDto, UnitDto, UnitPriorityDto, SizeGroupDto } from '../../types';
import { Spinner, Alert, ConfirmModal } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

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

// ── ────────────────────────────────────────────────────────────────────────────
// ── Size Group Modal ──────────────────────────────────────────────────────────
// ── ────────────────────────────────────────────────────────────────────────────

function SizeGroupModal({
  isOpen,
  onClose,
  onSave,
  editing,
  initialData,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; nameMl: string; description: string }) => void;
  editing: boolean;
  initialData: { name: string; nameMl: string; description: string };
  saving: boolean;
}) {
  const [name, setName] = useState(initialData.name);
  const [nameMl, setNameMl] = useState(initialData.nameMl);
  const [description, setDescription] = useState(initialData.description);

  useEffect(() => {
    setName(initialData.name);
    setNameMl(initialData.nameMl);
    setDescription(initialData.description);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), nameMl: nameMl.trim(), description: description.trim() });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: D.surface,
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          border: `1px solid ${D.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: 0 }}>
            {editing ? 'Edit Size Group' : 'Add Size Group'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: D.sub,
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Size Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Small, Medium, Large, Bulk"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Malayalam Name <span style={{ fontSize: 11, color: D.sub }}>(optional)</span>
            </label>
            <input
              type="text"
              value={nameMl}
              onChange={e => setNameMl(e.target.value)}
              placeholder="വലുപ്പ ഗ്രൂപ്പ്"
              lang="ml"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Description <span style={{ fontSize: 11, color: D.sub }}>(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Products weighing up to 1kg"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#A78BFA',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: (saving || !name.trim()) ? 0.5 : 1,
              }}
            >
              {saving ? <Spinner size={14} /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ────────────────────────────────────────────────────────────────────────────
// ── Group Modal ────────────────────────────────────────────────────────────────
// ── ────────────────────────────────────────────────────────────────────────────

function GroupModal({
  isOpen,
  onClose,
  onSave,
  editing,
  initialData,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; nameMl: string }) => void;
  editing: boolean;
  initialData: { name: string; nameMl: string };
  saving: boolean;
}) {
  const [name, setName] = useState(initialData.name);
  const [nameMl, setNameMl] = useState(initialData.nameMl);

  useEffect(() => {
    setName(initialData.name);
    setNameMl(initialData.nameMl);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), nameMl: nameMl.trim() });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: D.surface,
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          border: `1px solid ${D.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: 0 }}>
            {editing ? 'Edit Group' : 'Add Group'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: D.sub,
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Beverages, Snacks, Dairy"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Malayalam Name <span style={{ fontSize: 11, color: D.sub }}>(optional)</span>
            </label>
            <input
              type="text"
              value={nameMl}
              onChange={e => setNameMl(e.target.value)}
              placeholder="ഗ്രൂപ്പ് പേര്"
              lang="ml"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: D.accent,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: (saving || !name.trim()) ? 0.5 : 1,
              }}
            >
              {saving ? <Spinner size={14} /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ────────────────────────────────────────────────────────────────────────────
// ── Unit Modal (with UQC) ─────────────────────────────────────────────────────
// ── ────────────────────────────────────────────────────────────────────────────

function UnitModal({
  isOpen,
  onClose,
  onSave,
  editing,
  initialData,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; abbreviation: string; uqc: string }) => void;
  editing: boolean;
  initialData: { name: string; abbreviation: string; uqc: string };
  saving: boolean;
}) {
  const [name, setName] = useState(initialData.name);
  const [abbreviation, setAbbreviation] = useState(initialData.abbreviation);
  const [uqc, setUqc] = useState(initialData.uqc);

  useEffect(() => {
    setName(initialData.name);
    setAbbreviation(initialData.abbreviation);
    setUqc(initialData.uqc);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      uqc: uqc.trim().toUpperCase(),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: D.surface,
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          border: `1px solid ${D.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: 0 }}>
            {editing ? 'Edit Unit' : 'Add Unit'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: D.sub,
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Unit Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Kilogram, Box, Carton"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              Abbreviation
            </label>
            <input
              type="text"
              value={abbreviation}
              onChange={e => setAbbreviation(e.target.value)}
              placeholder="e.g., kg, bx, ctn"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: D.text, display: 'block', marginBottom: 6 }}>
              UQC (Unit Quantity Code) <span style={{ fontSize: 11, color: D.sub }}>(optional)</span>
            </label>
            <input
              type="text"
              value={uqc}
              onChange={e => setUqc(e.target.value.toUpperCase())}
              placeholder="e.g., BAG, BOX, CTN, PCS, KGS, LTR"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = D.accent}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}
            />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: D.sub }}>
              Standard GST codes: BAG, BOX, CTN, PCS, KGS, LTR, MTR, SQF, etc.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: `1px solid ${D.border}`,
                background: 'transparent',
                color: D.muted,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: D.green,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: (saving || !name.trim()) ? 0.5 : 1,
              }}
            >
              {saving ? <Spinner size={14} /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ────────────────────────────────────────────────────────────────────────────
// ── Main Page ──────────────────────────────────────────────────────────────────
// ── ────────────────────────────────────────────────────────────────────────────

export function AdminCatalogConfig() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // State for Groups
  const [groups, setGroups] = useState<ProductGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // State for Units
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);

  // ── NEW: State for Size Groups ──
  const [sizeGroups, setSizeGroups] = useState<SizeGroupDto[]>([]);
  const [sizeGroupsLoading, setSizeGroupsLoading] = useState(true);

  // State for Priorities
  const [priorities, setPriorities] = useState<UnitPriorityDto[]>([]);

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showSizeGroupModal, setShowSizeGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroupDto | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitDto | null>(null);
  const [editingSizeGroup, setEditingSizeGroup] = useState<SizeGroupDto | null>(null);

  // Form states
  const [groupForm, setGroupForm] = useState({ name: '', nameMl: '' });
  const [unitForm, setUnitForm] = useState({ name: '', abbreviation: '', uqc: '' });
  const [sizeGroupForm, setSizeGroupForm] = useState({ name: '', nameMl: '', description: '' });

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'unit' | 'sizeGroup'; id: string; name: string } | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  // ── Load Data ──
  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const data = await productGroupsApi.getAll();
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadUnits() {
    setUnitsLoading(true);
    try {
      const data = await unitsApi.getAll();
      setUnits(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load units');
    } finally {
      setUnitsLoading(false);
    }
  }

  // ── NEW: Load Size Groups ──
  async function loadSizeGroups() {
    setSizeGroupsLoading(true);
    try {
      const data = await sizeGroupsApi.getAll();
      setSizeGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load size groups');
    } finally {
      setSizeGroupsLoading(false);
    }
  }

  async function loadPriorities() {
    try {
      const data = await unitsApi.getPriorities();
      setPriorities(data);
    } catch {
      setPriorities([]);
    }
  }

  async function loadAll() {
    await Promise.all([loadGroups(), loadUnits(), loadSizeGroups(), loadPriorities()]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // ── Group Handlers ──
  function openAddGroup() {
    setEditingGroup(null);
    setGroupForm({ name: '', nameMl: '' });
    setShowGroupModal(true);
  }

  function openEditGroup(group: ProductGroupDto) {
    setEditingGroup(group);
    setGroupForm({ name: group.name, nameMl: group.nameMl || '' });
    setShowGroupModal(true);
  }

  async function handleSaveGroup(data: { name: string; nameMl: string }) {
    if (!data.name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (editingGroup) {
        await productGroupsApi.update(editingGroup.id, data.name, data.nameMl || undefined);
        setSuccess('Group updated successfully!');
      } else {
        await productGroupsApi.create(data.name, data.nameMl || undefined);
        setSuccess('Group created successfully!');
      }
      setShowGroupModal(false);
      await loadGroups();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save group');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    try {
      await productGroupsApi.delete(id);
      setSuccess('Group deleted successfully!');
      await loadGroups();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    } finally {
      setDeleteConfirm(null);
    }
  }

  // ── Unit Handlers ──
  function openAddUnit() {
    setEditingUnit(null);
    setUnitForm({ name: '', abbreviation: '', uqc: '' });
    setShowUnitModal(true);
  }

  function openEditUnit(unit: UnitDto) {
    setEditingUnit(unit);
    setUnitForm({
      name: unit.name,
      abbreviation: unit.abbreviation || '',
      uqc: unit.uqc || '',
    });
    setShowUnitModal(true);
  }

  async function handleSaveUnit(data: { name: string; abbreviation: string; uqc: string }) {
    if (!data.name.trim()) {
      setError('Unit name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (editingUnit) {
        await unitsApi.update(editingUnit.id, data.name, data.abbreviation || undefined);
        if (data.uqc) {
          await unitsApi.updateUQC(editingUnit.id, data.uqc);
        }
        setSuccess('Unit updated successfully!');
      } else {
        const result = await unitsApi.create(data.name, data.abbreviation || undefined);
        if (data.uqc && result?.id) {
          await unitsApi.updateUQC(result.id, data.uqc);
        }
        setSuccess('Unit created successfully!');
      }
      setShowUnitModal(false);
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save unit');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUnit(id: string) {
    try {
      await unitsApi.delete(id);
      setSuccess('Unit deleted successfully!');
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete unit');
    } finally {
      setDeleteConfirm(null);
    }
  }

  // ── Size Group Handlers ──
  function openAddSizeGroup() {
    setEditingSizeGroup(null);
    setSizeGroupForm({ name: '', nameMl: '', description: '' });
    setShowSizeGroupModal(true);
  }

  function openEditSizeGroup(group: SizeGroupDto) {
    setEditingSizeGroup(group);
    setSizeGroupForm({
      name: group.name,
      nameMl: group.nameMl || '',
      description: group.description || '',
    });
    setShowSizeGroupModal(true);
  }

  async function handleSaveSizeGroup(data: { name: string; nameMl: string; description: string }) {
    if (!data.name.trim()) {
      setError('Size group name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (editingSizeGroup) {
        await sizeGroupsApi.update(editingSizeGroup.id, {
          name: data.name,
          nameMl: data.nameMl || undefined,
          description: data.description || undefined,
          isActive: true,
        });
        setSuccess('Size group updated successfully!');
      } else {
        await sizeGroupsApi.create({
          name: data.name,
          nameMl: data.nameMl || undefined,
          description: data.description || undefined,
        });
        setSuccess('Size group created successfully!');
      }
      setShowSizeGroupModal(false);
      await loadSizeGroups();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save size group');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSizeGroup(id: string) {
    try {
      await sizeGroupsApi.delete(id);
      setSuccess('Size group deleted successfully!');
      await loadSizeGroups();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete size group');
    } finally {
      setDeleteConfirm(null);
    }
  }

  // ── Priority Handlers ──
  async function handleUpdatePriority(unitId: string, newPriority: number) {
    setUpdatingPriority(unitId);
    try {
      await unitsApi.updatePriority(unitId, newPriority);
      await loadPriorities();
    } catch (err: unknown) {
      setError('Failed to update priority');
    } finally {
      setUpdatingPriority(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: D.bg, padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Back Button ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <Link
            to={user?.role === 'Admin' || user?.role === 'SuperAdmin' ? '/admin/dashboard' : '/'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 10,
              background: D.surface,
              border: `1px solid ${D.border}`,
              color: D.muted,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              fontFamily: 'inherit',
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
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: D.text, margin: 0, letterSpacing: '-0.02em' }}>
              <Settings size={22} style={{ display: 'inline', marginRight: 8, color: D.accent }} />
              Catalog Config
            </h1>
            <p style={{ color: D.muted, fontSize: 14, marginTop: 4, fontWeight: 500 }}>
              Product Groups, Units &amp; Size Groups Management
            </p>
          </div>
          <button
            onClick={loadAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              border: `1px solid ${D.border}`,
              background: D.surface,
              color: D.muted,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.accent; (e.currentTarget as HTMLElement).style.color = D.text; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.muted; }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* ── Four Column Layout ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>

          {/* ── Groups Card ── */}
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={16} style={{ color: D.accent }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>
                  Groups
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: D.muted,
                  background: D.bg,
                  padding: '1px 8px',
                  borderRadius: 12,
                }}>
                  {groups.length}
                </span>
              </div>
              <button
                onClick={openAddGroup}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: D.accent,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div style={{ padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
              {groupsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spinner size={20} />
                </div>
              ) : groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: D.muted, fontSize: 12 }}>
                  No groups yet
                </div>
              ) : (
                groups.map(group => (
                  <div
                    key={group.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 8,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: D.text, fontSize: 13 }}>
                        {group.name}
                      </div>
                      {group.productCount !== undefined && (
                        <div style={{ fontSize: 10, color: D.accent }}>
                          {group.productCount} products
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        onClick={() => openEditGroup(group)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'group', id: group.id, name: group.name })}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Units Card ── */}
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ruler size={16} style={{ color: D.green }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>
                  Units
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: D.muted,
                  background: D.bg,
                  padding: '1px 8px',
                  borderRadius: 12,
                }}>
                  {units.length}
                </span>
              </div>
              <button
                onClick={openAddUnit}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: D.green,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div style={{ padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
              {unitsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spinner size={20} />
                </div>
              ) : units.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: D.muted, fontSize: 12 }}>
                  No units yet
                </div>
              ) : (
                units.map(unit => (
                  <div
                    key={unit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 8,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: D.text, fontSize: 13 }}>
                        {unit.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 10, flexWrap: 'wrap' }}>
                        {unit.abbreviation && (
                          <span style={{ color: D.sub }}>[{unit.abbreviation}]</span>
                        )}
                        {unit.uqc && (
                          <span style={{ color: D.accent, fontWeight: 700, background: `${D.accent}15`, padding: '1px 6px', borderRadius: 4 }}>
                            UQC: {unit.uqc}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        onClick={() => openEditUnit(unit)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'unit', id: unit.id, name: unit.name })}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Size Groups Card ── */}
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} style={{ color: '#A78BFA' }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>
                  Size Groups
                </h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: D.muted,
                  background: D.bg,
                  padding: '1px 8px',
                  borderRadius: 12,
                }}>
                  {sizeGroups.length}
                </span>
              </div>
              <button
                onClick={openAddSizeGroup}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#A78BFA',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div style={{ padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
              {sizeGroupsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spinner size={20} />
                </div>
              ) : sizeGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: D.muted, fontSize: 12 }}>
                  No size groups yet
                </div>
              ) : (
                sizeGroups.map(group => (
                  <div
                    key={group.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 8,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: D.text, fontSize: 13 }}>
                        {group.name}
                      </div>
                      {group.productCount !== undefined && (
                        <div style={{ fontSize: 10, color: '#A78BFA' }}>
                          {group.productCount} products
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        onClick={() => openEditSizeGroup(group)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'sizeGroup', id: group.id, name: group.name })}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Loading Priorities Card ── */}
          <div style={{
            background: D.surface,
            borderRadius: 16,
            border: `1px solid ${D.border}`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${D.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <TrendingUp size={16} style={{ color: D.accent }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>
                Priorities
              </h2>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: D.muted,
                background: D.bg,
                padding: '1px 8px',
                borderRadius: 12,
              }}>
                {priorities.length}
              </span>
            </div>

            <div style={{ padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, color: D.muted, marginBottom: 8, padding: '6px 8px', background: D.bg, borderRadius: 6 }}>
                <strong style={{ color: D.accent }}>1</strong> = Load FIRST ·
                <strong style={{ color: D.accent }}> 99</strong> = Load LAST
              </div>
              {priorities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: D.muted, fontSize: 12 }}>
                  No units with priorities
                </div>
              ) : (
                priorities.map((unit) => (
                  <div
                    key={unit.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 8,
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        flexShrink: 0,
                        background: `${D.accent}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 12,
                        color: D.accent,
                      }}>
                        {unit.loadingPriority}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: D.text }}>
                          {unit.name}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        onClick={() => handleUpdatePriority(unit.id, Math.max(1, unit.loadingPriority - 1))}
                        disabled={updatingPriority === unit.id || unit.loadingPriority <= 1}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: (updatingPriority === unit.id || unit.loadingPriority <= 1) ? 'not-allowed' : 'pointer',
                          opacity: (updatingPriority === unit.id || unit.loadingPriority <= 1) ? 0.3 : 1,
                        }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => handleUpdatePriority(unit.id, unit.loadingPriority + 1)}
                        disabled={updatingPriority === unit.id}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: D.sub,
                          cursor: updatingPriority === unit.id ? 'not-allowed' : 'pointer',
                          opacity: updatingPriority === unit.id ? 0.3 : 1,
                        }}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Group Modal ── */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSave={handleSaveGroup}
        editing={!!editingGroup}
        initialData={groupForm}
        saving={loading}
      />

      {/* ── Unit Modal ── */}
      <UnitModal
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
        onSave={handleSaveUnit}
        editing={!!editingUnit}
        initialData={unitForm}
        saving={loading}
      />

      {/* ── Size Group Modal ── */}
      <SizeGroupModal
        isOpen={showSizeGroupModal}
        onClose={() => setShowSizeGroupModal(false)}
        onSave={handleSaveSizeGroup}
        editing={!!editingSizeGroup}
        initialData={sizeGroupForm}
        saving={loading}
      />

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.type === 'group' ? 'Group' : deleteConfirm?.type === 'unit' ? 'Unit' : 'Size Group'}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteConfirm) {
            if (deleteConfirm.type === 'group') {
              handleDeleteGroup(deleteConfirm.id);
            } else if (deleteConfirm.type === 'unit') {
              handleDeleteUnit(deleteConfirm.id);
            } else if (deleteConfirm.type === 'sizeGroup') {
              handleDeleteSizeGroup(deleteConfirm.id);
            }
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}