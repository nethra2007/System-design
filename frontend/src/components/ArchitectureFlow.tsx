import React from 'react';
import { 
  Users, 
  Shield, 
  Package, 
  Bookmark, 
  CreditCard, 
  ClipboardList, 
  ArrowRight,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
  isBoundary?: boolean;
}

export const ArchitectureFlow: React.FC = () => {
  const stages: Stage[] = [
    {
      id: 'users',
      name: 'Users',
      desc: '10,000 Concurrent',
      icon: <Users size={18} className="text-[#2563EB]" />,
    },
    {
      id: 'gateway',
      name: 'API Gateway',
      desc: 'Rate Limiter',
      icon: <Shield size={18} className="text-[#7C6CE6]" />,
    },
    {
      id: 'queue',
      name: 'Redis Queue',
      desc: 'Lua Fast Shedding',
      icon: <Layers size={18} className="text-[#2563EB]" />,
    },
    {
      id: 'inventory',
      name: 'Inventory',
      desc: 'Atomic Reservation',
      icon: <Package size={18} className="text-[#16A34A]" />,
      badge: 'CONSISTENCY BOUNDARY',
      isBoundary: true,
    },
    {
      id: 'reservation',
      name: 'Reservation',
      desc: '10 min TTL Hold',
      icon: <Bookmark size={18} className="text-[#D97706]" />,
    },
    {
      id: 'payment',
      name: 'Payment',
      desc: 'Idempotent Charge',
      icon: <CreditCard size={18} className="text-[#5B4BDB]" />,
    },
    {
      id: 'order',
      name: 'Order Service',
      desc: 'Event Recovery',
      icon: <ClipboardList size={18} className="text-[#16A34A]" />,
    },
  ];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
            Architecture Traffic Pipeline
            <span className="bg-[#ECFDF3] text-[#16A34A] text-xs px-2.5 py-0.5 rounded-full font-medium border border-[#16A34A]/20 flex items-center gap-1">
              <CheckCircle2 size={12} /> Live Simulation
            </span>
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            End-to-end request path showing the isolated inventory consistency boundary
          </p>
        </div>
      </div>

      {/* Horizontal Scroll Pipeline */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-thin">
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <div
              className={`flex flex-col p-4 rounded-xl border min-w-[150px] transition-all relative ${
                stage.isBoundary
                  ? 'bg-[#ECFDF3]/40 border-[#16A34A] shadow-xs'
                  : 'bg-[#F8FAFC] border-[#E5E7EB]'
              }`}
            >
              {stage.badge && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#16A34A] text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs uppercase tracking-wider">
                  {stage.badge}
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    stage.isBoundary
                      ? 'bg-[#16A34A]/10 text-[#16A34A]'
                      : 'bg-white border border-[#E5E7EB]'
                  }`}
                >
                  {stage.icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#172033]">{stage.name}</div>
                  <div className="text-[11px] text-[#64748B] font-normal">{stage.desc}</div>
                </div>
              </div>
            </div>

            {idx < stages.length - 1 && (
              <ArrowRight size={16} className="text-[#94A3B8] shrink-0 mx-0.5" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
