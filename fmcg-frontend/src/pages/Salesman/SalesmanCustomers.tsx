// PATH: src/pages/Salesman/SalesmanCustomers.tsx
// Card-based customer list for a route. Tapping a card jumps straight to
// order entry for that customer. Search matches name/phone as before, plus:
// typing a plain number (e.g. "1") jumps to the shop at that stop/sequence
// number, rather than doing a text search on it.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Phone, MapPin, ArrowLeft, Search, X, ChevronRight } from 'lucide-react';
import { customersApi } from '../../api/services';
import { CustomerDto } from '../../types';
import { Spinner, EmptyState } from '../../components/ui';

export default function SalesmanCustomers() {
  const { routeId } = useParams<{ routeId: string }>();
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

  const sorted = [...customers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const filteredCustomers = (() => {
    const q = search.trim();
    if (!q) return sorted;
    // A plain number means "go to that stop number", not a text search —
    // typing "1" finds stop 1, not every name/code containing a "1".
    if (/^\d+$/.test(q)) {
      return sorted.filter(c => String(c.sequenceOrder) === q);
    }
    const ql = q.toLowerCase();
    return sorted.filter(c =>
      c.nameEnglish.toLowerCase().includes(ql) ||
      (c.nameMalayalam && c.nameMalayalam.toLowerCase().includes(ql)) ||
      (c.phoneNumber && c.phoneNumber.includes(q))
    );
  })();

  function selectCustomer(customerId: string) {
    if (!routeId) return;
    navigate(`/salesman/routes/${routeId}/order/${customerId}`);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-3 hover:text-slate-800">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-lg font-bold text-slate-800">Customers</h1>
        <p className="text-sm text-slate-500 mt-0.5">{customers.length} customer{customers.length !== 1 ? 's' : ''} on this route — tap one to take an order</p>
        <div className="relative mt-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-shadow"
            placeholder="Search by name, phone, or stop number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState
              title="No customers found"
              message={search ? `Nothing matches "${search}".` : undefined}
              icon={Users}
            />
          </div>
        ) : (
          filteredCustomers.map(c => (
            <button
              key={c.id}
              onClick={() => selectCustomer(c.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
                {c.sequenceOrder || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 truncate">{c.nameEnglish}</h3>
                {c.nameMalayalam && <p className="text-xs text-slate-500 truncate" lang="ml">{c.nameMalayalam}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {c.phoneNumber && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone size={11} /> {c.phoneNumber}
                    </span>
                  )}
                  {c.address && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                      <MapPin size={11} /> {c.address}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}