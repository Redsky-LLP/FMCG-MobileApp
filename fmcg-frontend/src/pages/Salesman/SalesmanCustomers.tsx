import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Phone, MapPin, ArrowLeft, Search } from 'lucide-react';
import { customersApi } from '../../api/services';
import { CustomerDto } from '../../types';
import { Spinner, EmptyState } from '../../components/ui';

export default function SalesmanCustomers() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (routeId) {
      customersApi.list(routeId)
        .then(setCustomers)
        .finally(() => setLoading(false));
    }
  }, [routeId]);

  const filteredCustomers = customers.filter(c =>
    c.nameEnglish.toLowerCase().includes(search.toLowerCase()) ||
    (c.nameMalayalam && c.nameMalayalam.includes(search))
  );

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 mb-3">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-800">Customers</h1>
        <p className="text-sm text-slate-500">{customers.length} customers on this route</p>
        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {filteredCustomers.length === 0 ? (
          <EmptyState title="No customers found" icon={Users} />
        ) : (
          filteredCustomers.sort((a, b) => a.sequenceOrder - b.sequenceOrder).map(c => (
            <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{c.nameEnglish}</h3>
                  {c.nameMalayalam && <p className="text-sm text-slate-500">{c.nameMalayalam}</p>}
                  {c.phoneNumber && (
                    <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                      <Phone size={12} /> {c.phoneNumber}
                    </p>
                  )}
                  {c.address && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin size={10} /> {c.address}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Stop {c.sequenceOrder || '?'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}