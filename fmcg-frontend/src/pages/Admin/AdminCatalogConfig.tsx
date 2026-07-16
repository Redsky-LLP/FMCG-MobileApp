// PATH: src/pages/Admin/AdminCatalogConfig.tsx
// UPDATED: Removed Units and Incentives cards

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings, Plus, Edit2, Trash2, X, Save,
  Boxes, ArrowLeft, RefreshCw,
  Layers, Package,
} from 'lucide-react';
import { productGroupsApi, unitsApi, sizeGroupsApi } from '../../api/services';
import type { ProductGroupDto, UnitDto, UnitPriorityDto, SizeGroupDto } from '../../types';
import { Spinner, Alert, ConfirmModal } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useIsMobile } from '../../hooks/useIsMobile';

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
// ── Packing Category Modal ────────────────────────────────────────────────────
// ── ────────────────────────────────────────────────────────────────────────────

function PackingCategoryModal({
  isOpen,
  onClose,
  onSave,
  editing,
  initialData,
  existingCategories,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; priority: number }) => void;
  editing: boolean;
  initialData: { id?: string | undefined; name: string; priority: number };
  existingCategories: { id: string; name: string; priority: number }[];
  saving: boolean;
}) {
  const [name, setName] = useState(initialData.name);
  const [priority, setPriority] = useState<string>(initialData.priority ? String(initialData.priority) : '');
  const [priorityError, setPriorityError] = useState('');

  useEffect(() => {
    setName(initialData.name);
    setPriority(initialData.priority ? String(initialData.priority) : '');
    setPriorityError('');
  }, [initialData, isOpen]);

  // Get used priorities (excluding current if editing)
  const usedPriorities = existingCategories
    .filter(c => !initialData.id || c.id !== initialData.id)
    .map(c => c.priority);

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    if (value === '') {
      setPriorityError('');
      return;
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      setPriorityError('Priority must be a positive number.');
      return;
    }
    if (usedPriorities.includes(numValue)) {
      setPriorityError(`Priority ${numValue} is already used by another category.`);
    } else {
      setPriorityError('');
    }
  };

  // Get the numeric value for validation
  const getNumericPriority = (): number | null => {
    if (priority === '') return null;
    const num = parseInt(priority, 10);
    return isNaN(num) ? null : num;
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) {
      setPriorityError('Category name is required');
      return;
    }
    const numPriority = getNumericPriority();
    if (numPriority === null || numPriority < 1) {
      setPriorityError('Please enter a valid priority number (1 or higher).');
      return;
    }
    if (usedPriorities.includes(numPriority)) {
      setPriorityError(`Priority ${numPriority} is already used. Choose a different number.`);
      return;
    }
    onSave({ name: name.trim(), priority: numPriority });
  };

  const numPriority = getNumericPriority();
  const isValid = numPriority !== null && numPriority >= 1 && !usedPriorities.includes(numPriority);

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
            {editing ? 'Edit Packing Category' : 'Add Packing Category'}
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
              Category Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Heavy, Medium, Light, Fragile"
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
              Priority (1 = highest)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={priority}
              onChange={e => handlePriorityChange(e.target.value)}
              placeholder="Enter priority number"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${priorityError ? D.red : D.border}`,
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
            {priorityError && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: D.red }}>
                ⚠️ {priorityError}
              </p>
            )}
            {!priorityError && priority && numPriority !== null && usedPriorities.includes(numPriority) && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: D.amber }}>
                ⚠️ Priority {numPriority} is already in use by another category.
              </p>
            )}
            {!priorityError && priority && numPriority !== null && !usedPriorities.includes(numPriority) && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: D.green }}>
                ✅ Available
              </p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 11, color: D.sub }}>
              💡 Used priorities: {usedPriorities.length > 0 
                ? usedPriorities.sort((a,b) => a-b).join(', ')
                : 'None yet'}
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
              disabled={saving || !name.trim() || !!priorityError || !isValid}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: (saving || !name.trim() || !!priorityError || !isValid)
                  ? D.border
                  : D.accent,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: (saving || !name.trim() || !!priorityError || !isValid)
                  ? 'not-allowed'
                  : 'pointer',
                fontFamily: 'inherit',
                opacity: (saving || !name.trim() || !!priorityError || !isValid) ? 0.5 : 1,
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
  const isMobile = useIsMobile();

  // State for Groups
  const [groups, setGroups] = useState<ProductGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // ── State for Size Groups ──
  const [sizeGroups, setSizeGroups] = useState<SizeGroupDto[]>([]);
  const [sizeGroupsLoading, setSizeGroupsLoading] = useState(true);

  // ── State for Packing Categories (replaces Priorities) ──
  const [packingCategories, setPackingCategories] = useState<{ id: string; name: string; priority: number }[]>([]);
  const [packingCategoriesLoading, setPackingCategoriesLoading] = useState(true);

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSizeGroupModal, setShowSizeGroupModal] = useState(false);
  const [showPackingCategoryModal, setShowPackingCategoryModal] = useState(false);

  const [editingGroup, setEditingGroup] = useState<ProductGroupDto | null>(null);
  const [editingSizeGroup, setEditingSizeGroup] = useState<SizeGroupDto | null>(null);
  const [editingPackingCategory, setEditingPackingCategory] = useState<{ id: string; name: string; priority: number } | null>(null);

  // Form states
  const [groupForm, setGroupForm] = useState({ name: '', nameMl: '' });
  const [sizeGroupForm, setSizeGroupForm] = useState({ name: '', nameMl: '', description: '' });
  const [packingCategoryForm, setPackingCategoryForm] = useState<{ id?: string | undefined; name: string; priority: number }>({ id: undefined, name: '', priority: 0 });

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'sizeGroup' | 'packingCategory'; id: string; name: string } | null>(null);

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

  async function loadPackingCategories() {
    setPackingCategoriesLoading(true);
    try {
      const data = await unitsApi.getPriorities();
      // Transform to packing categories with names
      const categories = data.map((u: UnitPriorityDto) => ({
        id: u.id,
        name: u.name,
        priority: u.loadingPriority,
      }));
      setPackingCategories(categories);
    } catch (err: any) {
      setError(err.message || 'Failed to load packing categories');
    } finally {
      setPackingCategoriesLoading(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadGroups(), loadSizeGroups(), loadPackingCategories()]);
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

  // ── Packing Category Handlers ──
  function openAddPackingCategory() {
    setEditingPackingCategory(null);
    const maxPriority = packingCategories.length > 0 ? Math.max(...packingCategories.map(c => c.priority)) : 0;
    setPackingCategoryForm({ id: undefined, name: '', priority: 0 });
    setShowPackingCategoryModal(true);
  }

  function openEditPackingCategory(category: { id: string; name: string; priority: number }) {
    setEditingPackingCategory(category);
    setPackingCategoryForm({ id: category.id, name: category.name, priority: category.priority });
    setShowPackingCategoryModal(true);
  }

  async function handleSavePackingCategory(data: { name: string; priority: number }) {
    if (!data.name.trim()) {
      setError('Category name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (editingPackingCategory) {
        // Update priority via API
        await unitsApi.updatePriority(editingPackingCategory.id, data.priority);
        setSuccess('Packing category updated successfully!');
      } else {
        // Create new unit as a packing category
        const result = await unitsApi.create(data.name);
        if (result?.id) {
          await unitsApi.updatePriority(result.id, data.priority);
        }
        setSuccess('Packing category created successfully!');
      }
      setShowPackingCategoryModal(false);
      await loadPackingCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save packing category');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePackingCategory(id: string) {
    try {
      await unitsApi.delete(id);
      setSuccess('Packing category deleted successfully!');
      await loadPackingCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete packing category');
    } finally {
      setDeleteConfirm(null);
    }
  }

  // ── Priority Handler (for reordering) ──
  async function handleUpdatePriority(unitId: string, newPriority: number) {
    try {
      await unitsApi.updatePriority(unitId, newPriority);
      await loadPackingCategories();
      setSuccess('Priority updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update priority');
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
              Item Groups, Size Groups
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

        {/* {error && <Alert variant="error">{error}</Alert>} */}
        {success && <Alert variant="success">{success}</Alert>}

        {/* ── Responsive Grid ── */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr ', 
          gap: 16 
        }}>
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
                  Item Groups
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

         

        </div>
      </div>

      {/* ── Modals ── */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSave={handleSaveGroup}
        editing={!!editingGroup}
        initialData={groupForm}
        saving={loading}
      />

      <SizeGroupModal
        isOpen={showSizeGroupModal}
        onClose={() => setShowSizeGroupModal(false)}
        onSave={handleSaveSizeGroup}
        editing={!!editingSizeGroup}
        initialData={sizeGroupForm}
        saving={loading}
      />

      {/* <PackingCategoryModal
        isOpen={showPackingCategoryModal}
        onClose={() => setShowPackingCategoryModal(false)}
        onSave={handleSavePackingCategory}
        editing={!!editingPackingCategory}
        initialData={packingCategoryForm}
        existingCategories={packingCategories}
        saving={loading}
      /> */}

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.type === 'group' ? 'Group' : deleteConfirm?.type === 'sizeGroup' ? 'Size Group' : 'Packing Category'}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteConfirm) {
            if (deleteConfirm.type === 'group') {
              handleDeleteGroup(deleteConfirm.id);
            } else if (deleteConfirm.type === 'sizeGroup') {
              handleDeleteSizeGroup(deleteConfirm.id);
            } else if (deleteConfirm.type === 'packingCategory') {
              handleDeletePackingCategory(deleteConfirm.id);
            }
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}