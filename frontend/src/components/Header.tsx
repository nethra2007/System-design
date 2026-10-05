import React from 'react';
import { NavLink } from 'react-router-dom';
import { Zap, Activity, ShieldCheck, Database, FileText, AlertTriangle } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Branding & Subtitle */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#5B4BDB] flex items-center justify-center text-white shadow-sm">
              <Zap size={18} className="fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#172033] text-base tracking-tight">SALESTORM SENTINEL</span>
                <span className="text-[10px] font-semibold bg-[#F3F0FF] text-[#5B4BDB] px-2 py-0.5 rounded-full border border-[#7C6CE6]/20">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] font-medium hidden sm:block">Flash Sale Reliability Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-[#E5E7EB] text-xs font-medium">
            <NavLink
              to="/control-room"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#5B4BDB] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`
              }
            >
              <Activity size={14} /> Control Room
            </NavLink>
            <NavLink
              to="/architecture"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#5B4BDB] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`
              }
            >
              <Database size={14} /> Architecture
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#5B4BDB] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`
              }
            >
              <FileText size={14} /> Transactions
            </NavLink>
            <NavLink
              to="/failures"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#5B4BDB] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`
              }
            >
              <AlertTriangle size={14} /> Failures
            </NavLink>
            <NavLink
              to="/metrics"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#5B4BDB] font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`
              }
            >
              <ShieldCheck size={14} /> Metrics
            </NavLink>
          </nav>
        </div>

        {/* Right Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#ECFDF3] border border-[#16A34A]/20 px-3 py-1 rounded-full text-xs font-medium text-[#16A34A]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
            <span>System Online</span>
          </div>
          <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-md border border-[#E5E7EB] font-medium hidden sm:inline-block">
            Environment: Simulation
          </span>
        </div>
      </div>
    </header>
  );
};
