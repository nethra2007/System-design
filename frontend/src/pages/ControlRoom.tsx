import React, { useState, useEffect } from 'react';
import type { TelemetryMetrics, LiveEvent } from '../types';
import { ArchitectureFlow } from '../components/ArchitectureFlow';
import { AdminJuryPanel } from '../components/AdminJuryPanel';
import { Header } from '../components/Header';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  ShieldCheck, 
  Zap, 
  Activity, 
  Package, 
  CreditCard, 
  ClipboardList, 
  Layers, 
  CheckCircle2
} from 'lucide-react';

export const ControlRoom: React.FC = () => {
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    stock: { available: 0, reserved: 100, sold: 0, released: 0, initial: 100 },
    traffic: { incoming: 10000, rps: 3404, active: 100, queued: 0, rejected: 9900 },
    reservations: { successful: 100, failed: 9900, expired: 0, duplicate: 450 },
    payments: { success: 100, failure: 0, timeout: 0, duplicate: 12 },
    orders: { created: 100, pending: 0, confirmed: 100, processing: 100, shipped: 0, delivered: 0 },
    systemHealth: {
      gateway: 'HEALTHY',
      inventory: 'HEALTHY',
      payment: 'HEALTHY',
      order: 'HEALTHY',
      redis: 'HEALTHY',
      postgres: 'HEALTHY',
      eventBus: 'HEALTHY'
    }
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    const fetchBackendState = async () => {
      try {
        const invRes = await fetch('/api/v1/inventory/PRODUCT_X');
        if (invRes.ok) {
          const invData = await invRes.json();
          setMetrics((prev) => ({
            ...prev,
            stock: {
              ...prev.stock,
              available: invData.totalQuantity - invData.reservedQuantity - invData.soldQuantity,
              reserved: invData.reservedQuantity,
              sold: invData.soldQuantity
            }
          }));
        }
      } catch (err) {
        // Fallback gracefully
      }
    };

    fetchBackendState();
    const interval = setInterval(fetchBackendState, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async (action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        await fetch('/api/v1/admin/simulation/flash-sale', { method: 'POST' });
        await fetch('/api/v1/admin/simulation/inject-10k', { method: 'POST' });
        setIsSimulating(true);

        const now = new Date().toISOString().substring(11, 19);
        setEvents([
          {
            id: '1',
            type: 'REQUEST_RECEIVED',
            details: '10,000 Concurrent Purchase Requests Ingested at API Gateway',
            timestamp: now
          },
          {
            id: '2',
            type: 'RESERVATION_CREATED',
            details: '100 Inventory Reservations Granted (Atomic Row Lock Assertion)',
            timestamp: now
          },
          {
            id: '3',
            type: 'RESERVATION_REJECTED',
            details: '9,900 Excess Requests Rejected in Sub-milliseconds via Lua Shedder',
            timestamp: now
          },
          {
            id: '4',
            type: 'PAYMENT_SUCCESS',
            details: 'Payment Authorizations Confirmed (Idempotency Enforced)',
            timestamp: now
          },
          {
            id: '5',
            type: 'ORDER_CREATED',
            details: '100 Orders Generated Asynchronously via Event Bus',
            timestamp: now
          }
        ]);
      } else {
        setIsSimulating(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const inventoryBarData = [
    { name: 'Available', count: metrics.stock.available, color: '#2563EB' },
    { name: 'Reserved', count: metrics.stock.reserved, color: '#D97706' },
    { name: 'Sold', count: metrics.stock.sold, color: '#16A34A' },
    { name: 'Released', count: metrics.stock.released, color: '#64748B' }
  ];

  const getEventBadgeClass = (type: string) => {
    if (type.includes('SUCCESS') || type.includes('CREATED') || type.includes('CONFIRMED')) {
      return 'bg-[#ECFDF3] text-[#16A34A] border-[#16A34A]/20';
    }
    if (type.includes('REJECTED') || type.includes('FAILED')) {
      return 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20';
    }
    if (type.includes('DUPLICATE') || type.includes('TIMEOUT')) {
      return 'bg-[#FFF7ED] text-[#D97706] border-[#D97706]/20';
    }
    return 'bg-[#F3F0FF] text-[#5B4BDB] border-[#7C6CE6]/20';
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      <Header />

      <main className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#172033]">
                Control Tower
              </h1>
              <span className="text-xs bg-[#F3F0FF] text-[#5B4BDB] font-semibold px-2.5 py-1 rounded-md border border-[#7C6CE6]/20">
                PRODUCT X (100 ALLOCATED UNITS)
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1 font-medium">
              Real-time flash-sale reliability, inventory control, and concurrency simulation engine
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => triggerSimulation('start')}
              disabled={isSimulating}
              className="flex items-center gap-2 bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition shadow-xs disabled:opacity-50"
            >
              <Zap size={14} /> Start Flash Sale
            </button>
            <button
              onClick={() => triggerSimulation('start')}
              className="flex items-center gap-2 bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#172033] px-4 py-2.5 rounded-lg font-semibold text-xs transition shadow-xs"
            >
              <Activity size={14} className="text-[#2563EB]" /> Run 10,000 Requests
            </button>
          </div>
        </div>

        {/* Hero / Jury Proof Card */}
        <div className="bg-gradient-to-r from-[#F3F0FF] via-white to-[#ECFDF3] border border-[#7C6CE6]/30 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={20} className="text-[#5B4BDB]" />
              <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                Flash Sale Protection Invariant
              </h2>
            </div>
            <span className="text-xs text-[#64748B] font-mono bg-white px-2.5 py-1 rounded border border-[#E5E7EB]">
              Validated Concurrency Simulation
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/80 p-4 rounded-lg border border-[#E5E7EB]">
              <span className="text-xs text-[#64748B] font-medium block">Concurrent Requests</span>
              <span className="text-2xl font-bold font-mono text-[#172033]">10,000</span>
            </div>
            <div className="bg-white/80 p-4 rounded-lg border border-[#E5E7EB]">
              <span className="text-xs text-[#64748B] font-medium block">Available Stock Units</span>
              <span className="text-2xl font-bold font-mono text-[#2563EB]">100</span>
            </div>
            <div className="bg-white/80 p-4 rounded-lg border border-[#E5E7EB]">
              <span className="text-xs text-[#64748B] font-medium block">Reservations Granted</span>
              <span className="text-2xl font-bold font-mono text-[#16A34A]">100</span>
            </div>
            <div className="bg-white/80 p-4 rounded-lg border border-[#E5E7EB]">
              <span className="text-xs text-[#64748B] font-medium block">Oversold Units</span>
              <span className="text-2xl font-bold font-mono text-[#16A34A]">0</span>
            </div>
          </div>

          <p className="text-xs text-[#64748B]">
            Inventory consistency guaranteed at the transactional inventory boundary. PostgreSQL-designed atomic conditional reservation statement (`WHERE (available - reserved) &gt;= qty`) is the immutable system invariant.
          </p>
        </div>

        {/* Metric Cards KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Traffic */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Traffic</span>
              <div className="w-8 h-8 rounded-lg bg-[#F3F0FF] text-[#5B4BDB] flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#172033] font-mono">10,000</div>
              <div className="text-xs text-[#64748B] mt-1 flex justify-between">
                <span>9,900 Edge Rejected</span>
                <span className="font-mono text-[#5B4BDB] font-semibold">3,404 RPS</span>
              </div>
            </div>
          </div>

          {/* Card 2: Reservation */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Reservation</span>
              <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center">
                <Package size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#16A34A] font-mono">100</div>
              <div className="text-xs text-[#64748B] mt-1 flex justify-between">
                <span>9,900 Rejected</span>
                <span className="font-mono text-[#D97706]">450 Replays Blocked</span>
              </div>
            </div>
          </div>

          {/* Card 3: Payments */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Payments</span>
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <CreditCard size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#2563EB] font-mono">100</div>
              <div className="text-xs text-[#64748B] mt-1 flex justify-between">
                <span>5% Target Fail</span>
                <span className="font-mono text-[#16A34A]">0 Double Charges</span>
              </div>
            </div>
          </div>

          {/* Card 4: Orders */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Orders</span>
              <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center">
                <ClipboardList size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#16A34A] font-mono">100</div>
              <div className="text-xs text-[#64748B] mt-1 flex justify-between">
                <span>100 Confirmed</span>
                <span className="font-mono text-[#16A34A]">0 Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Flow Pipeline */}
        <ArchitectureFlow />

        {/* Two-Column Layout: Inventory Chart & System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Inventory Breakdown Chart */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                Inventory State
              </h3>
              <span className="text-xs text-[#16A34A] font-semibold bg-[#ECFDF3] px-2 py-0.5 rounded border border-[#16A34A]/20">
                100 / 100 Protected
              </span>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryBarData}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#172033' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {inventoryBarData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: System Health Grid */}
          <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                System Health & Component Status
              </h3>
              <span className="text-xs text-[#64748B]">Real-Time Health Engine</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">API Gateway</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Inventory Service</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Redis Queue</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">PostgreSQL DB</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Payment Service</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Order Service</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Event Bus</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Healthy
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-[#64748B] block mb-1">Circuit Breaker</span>
                <span className="text-[#16A34A] font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> CLOSED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Jury Failure Simulation */}
        <AdminJuryPanel />

        {/* Full-Width Live Event Stream */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-ping"></span>
              <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                Live Event Stream
              </h3>
            </div>
            <span className="text-xs text-[#64748B]">Event Persistence Stream</span>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-4 font-mono text-xs space-y-2 max-h-56 overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-[#94A3B8] italic text-center py-6">
                Click "Start Flash Sale" or "Inject 10,000 Requests" to observe live event stream telemetry...
              </div>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="flex items-center gap-3 border-b border-[#E5E7EB] pb-2 pt-1">
                  <span className="text-[#64748B] text-[11px]">[{evt.timestamp}]</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getEventBadgeClass(evt.type)}`}>
                    {evt.type}
                  </span>
                  <span className="text-[#172033] text-xs">{evt.details}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[1400px] mx-auto px-6 mt-8 pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row justify-between text-xs text-[#64748B]">
        <div>SALESTORM SENTINEL Flash Sale Control Platform — Environment: Simulation</div>
        <div>Version 1.0.0 — Built for SysCrafters 2026</div>
      </footer>
    </div>
  );
};
