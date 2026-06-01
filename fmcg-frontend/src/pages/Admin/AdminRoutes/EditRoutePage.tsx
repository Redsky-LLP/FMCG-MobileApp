import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Edit2 } from 'lucide-react';
import { Spinner, Alert } from '../../../components/ui';
import { routesApi, usersApi } from '../../../api/services';
import type { RouteDto, UserDto } from '../../../types';

export default function EditRoutePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = location.state?.route as RouteDto;
  
  const [form, setForm] = useState({
    name: route?.name || '',
    description: route?.description || '',
    assignedSalesmanId: route?.assignedSalesmanId || '',
  });
  const [salesmen, setSalesmen] = useState<UserDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!route) {
      navigate('/admin/routes');
      return;
    }
    usersApi.getAll('Salesman').then(setSalesmen).catch(() => {});
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
        assignedSalesmanId: form.assignedSalesmanId || undefined,
      });
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
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-3xl mx-auto px-5 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/routes')}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 mb-4"
          >
            <ArrowLeft size={18} /> Back to Routes
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Edit2 size={22} color="#fff" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Edit Route</h1>
              <p className="text-slate-500">{route?.name}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Route Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Changanassery, North Zone"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional - e.g., 10 shops, morning route"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Assign Salesman
                </label>
                <select
                  value={form.assignedSalesmanId}
                  onChange={e => setForm({ ...form, assignedSalesmanId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Unassigned —</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/admin/routes')}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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