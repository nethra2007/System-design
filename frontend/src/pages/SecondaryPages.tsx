import React from 'react';
import { Header } from '../components/Header';
import { Database, Shield, Zap, Lock, Code2, Copy, Check } from 'lucide-react';

export const ArchitecturePage: React.FC = () => {
  const [copied, setCopied] = React.useState(false);

  const sqlSnippet = `UPDATE inventory 
SET reserved_quantity = reserved_quantity + :qty,
    updated_at = NOW()
WHERE product_id = :product_id 
  AND (total_quantity - reserved_quantity - sold_quantity) >= :qty;`;

  const copyCode = () => {
    navigator.clipboard.writeText(sqlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      <Header />

      <main className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172033]">System Architecture & Invariants</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Detailed breakdown of service boundaries, failure isolation, and PostgreSQL atomic reservation invariants
          </p>
        </div>

        {/* Section 1: Critical Consistency Boundary */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center">
                <Lock size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172033]">Critical Inventory Consistency Boundary</h2>
                <p className="text-xs text-[#64748B]">
                  Single point of truth where zero-overselling is strictly enforced
                </p>
              </div>
            </div>
            <span className="text-xs bg-[#ECFDF3] text-[#16A34A] font-semibold px-2.5 py-1 rounded-md border border-[#16A34A]/20">
              ACID SQL Invariant
            </span>
          </div>

          <div className="relative bg-[#1E293B] text-[#F8FAFC] p-4 rounded-lg font-mono text-xs overflow-x-auto">
            <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5"><Code2 size={14} /> PostgreSQL Assertion Statement</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 hover:text-white transition"
              >
                {copied ? <Check size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre><code>{sqlSnippet}</code></pre>
          </div>

          <p className="text-xs text-[#64748B]">
            This single atomic conditional statement guarantees zero overselling regardless of microservice scaling or concurrent request surges. If `affected_rows == 0`, the reservation fails deterministically.
          </p>
        </div>

        {/* Section 2: Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-[#F3F0FF] text-[#5B4BDB] flex items-center justify-center">
              <Zap size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#172033]">Edge Traffic Shedder</h3>
            <p className="text-xs text-[#64748B]">
              Redis Lua atomic pre-check drops 9,900 out of 10,000 requests in sub-milliseconds, protecting database connection pools from starvation.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Shield size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#172033]">Idempotency Protection</h3>
            <p className="text-xs text-[#64748B]">
              Unique idempotency key indexes in Redis & PostgreSQL prevent duplicate client submissions, replay attacks, or double payment authorization.
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center">
              <Database size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#172033]">Event-Driven Saga Recovery</h3>
            <p className="text-xs text-[#64748B]">
              Payment success emits stream events to Redis Streams. If Order Service crashes, events remain in the Pending Entry List (PEL) and automatically replay upon recovery.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export const TransactionsPage: React.FC = () => {
  const sampleTransactions = [
    { id: 'TX-9901', orderId: 'ORD-8801', resId: 'RES-101', status: 'SUCCESS', amount: '$100.00', time: '11:42:08', key: 'ikey_user_1', corr: 'corr_a819' },
    { id: 'TX-9902', orderId: 'ORD-8802', resId: 'RES-102', status: 'SUCCESS', amount: '$100.00', time: '11:42:08', key: 'ikey_user_2', corr: 'corr_b920' },
    { id: 'TX-9903', orderId: 'ORD-8803', resId: 'RES-103', status: 'FAILED', amount: '$100.00', time: '11:42:09', key: 'ikey_user_3', corr: 'corr_c031' },
    { id: 'TX-9904', orderId: 'ORD-8804', resId: 'RES-104', status: 'DUPLICATE', amount: '$100.00', time: '11:42:09', key: 'ikey_user_1', corr: 'corr_a819' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      <Header />

      <main className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172033]">Transaction & Idempotency Audit Log</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time audit trail of payment transactions, idempotency keys, and correlation IDs
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#64748B] uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Transaction ID</th>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5">Reservation ID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Idempotency Key</th>
                <th className="p-3.5">Correlation ID</th>
                <th className="p-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] font-mono text-[11px]">
              {sampleTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#F8FAFC]">
                  <td className="p-3.5 font-bold text-[#5B4BDB]">{tx.id}</td>
                  <td className="p-3.5 text-[#172033]">{tx.orderId}</td>
                  <td className="p-3.5 text-[#64748B]">{tx.resId}</td>
                  <td className="p-3.5 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        tx.status === 'SUCCESS'
                          ? 'bg-[#ECFDF3] text-[#16A34A] border-[#16A34A]/20'
                          : tx.status === 'FAILED'
                          ? 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20'
                          : 'bg-[#FFF7ED] text-[#D97706] border-[#D97706]/20'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-[#172033]">{tx.amount}</td>
                  <td className="p-3.5 text-[#64748B]">{tx.key}</td>
                  <td className="p-3.5 text-[#2563EB]">{tx.corr}</td>
                  <td className="p-3.5 text-[#64748B] font-sans">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export const FailuresPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      <Header />

      <main className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172033]">Failure & Recovery Center</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Visual recovery timelines and system resilience isolation drills
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6">
          <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
            Order Service Outage Recovery Timeline
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-center text-xs font-semibold">
            <div className="bg-[#ECFDF3] border border-[#16A34A]/20 p-3 rounded-lg text-[#16A34A]">
              1. PAYMENT SUCCESS
            </div>
            <div className="bg-[#FEF2F2] border border-[#DC2626]/20 p-3 rounded-lg text-[#DC2626]">
              2. ORDER SVC DOWN
            </div>
            <div className="bg-[#FFF7ED] border border-[#D97706]/20 p-3 rounded-lg text-[#D97706]">
              3. EVENT STORED (PEL)
            </div>
            <div className="bg-[#F3F0FF] border border-[#7C6CE6]/20 p-3 rounded-lg text-[#5B4BDB]">
              4. SVC RECOVERED
            </div>
            <div className="bg-[#EFF6FF] border border-[#2563EB]/20 p-3 rounded-lg text-[#2563EB]">
              5. EVENT REPLAYED
            </div>
            <div className="bg-[#ECFDF3] border border-[#16A34A]/20 p-3 rounded-lg text-[#16A34A]">
              6. ORDER CONFIRMED
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export const MetricsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      <Header />

      <main className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172033]">System Telemetry & Metrics</h1>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time latency percentiles, throughput, and stream backlog metrics
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <span className="text-xs text-[#64748B]">Average Latency</span>
            <div className="text-2xl font-bold text-[#172033] font-mono mt-1">2.4 ms</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <span className="text-xs text-[#64748B]">P95 Latency</span>
            <div className="text-2xl font-bold text-[#172033] font-mono mt-1">12.8 ms</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <span className="text-xs text-[#64748B]">P99 Latency</span>
            <div className="text-2xl font-bold text-[#172033] font-mono mt-1">18.4 ms</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-xs">
            <span className="text-xs text-[#64748B]">HTTP 500 Error Rate</span>
            <div className="text-2xl font-bold text-[#16A34A] font-mono mt-1">0.00%</div>
          </div>
        </div>
      </main>
    </div>
  );
};
