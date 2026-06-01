import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronDown } from 'lucide-react';
import { Spinner, Alert } from '../../../components/ui';
import { routeAssignmentsApi, usersApi } from '../../../api/services';
import type { UserDto } from '../../../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OverrideRoutePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { routeId, routeName } = location.state as { routeId: string; routeName: string };
  
  const [salesmen, setSalesmen] = useState<UserDto[]>([]);
  const [salesmanId, setSalesmanId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!routeId) {
      navigate('/admin/routes');
      return;
    }
    usersApi.getAll('Salesman').then(setSalesmen).catch(() => {});
  }, [routeId, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salesmanId) {
      setError('Please select a salesman');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await routeAssignmentsApi.upsert({
        routeId,
        salesmanId,
        assignmentDate: date,
        notes: notes || 'Temporary assignment',
      });
      setSuccess(`Route temporarily assigned for ${new Date(date).toLocaleDateString()}`);
      setTimeout(() => {
        navigate('/admin/routes');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/routes')}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 mb-4"
          >
            <ArrowLeft size={18} /> Back to Routes
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <ChevronDown size={22} color="#fff" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Temporary Route Assignment</h1>
              <p className="text-slate-500">Route: <strong>{routeName}</strong></p>
            </div>
          </div>
        </div>

        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>📅 When to use:</strong> Salesman on leave, resigned, or temporary coverage.
            This overrides the permanent assignment ONLY for the selected date.
          </p>
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
                  Assign to Salesman *
                </label>
                <select
                  value={salesmanId}
                  onChange={e => setSalesmanId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  required
                >
                  <option value="">Select salesman...</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Assignment Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={todayStr()}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g., Rajesh on leave, covering for him"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
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
                className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Spinner size={16} /> : <Calendar size={16} />}
                Assign for {date}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}