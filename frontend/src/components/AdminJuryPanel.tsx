import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  Zap, 
  RefreshCw,
  ServerOff
} from 'lucide-react';

interface Feedback {
  type: 'success' | 'danger' | 'info';
  message: string;
}

export const AdminJuryPanel: React.FC = () => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const executeAction = async (endpoint: string, actionName: string, successMsg: string, isDanger = false) => {
    setLoadingAction(actionName);
    setFeedback(null);
    try {
      await fetch(`/api/v1/admin/simulation/${endpoint}`, { method: 'POST' });
      setFeedback({
        type: isDanger ? 'danger' : 'success',
        message: successMsg
      });
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: `Failed to execute ${actionName}`
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#5B4BDB] uppercase tracking-wider bg-[#F3F0FF] px-2.5 py-0.5 rounded-md border border-[#7C6CE6]/20">
              JURY MODE
            </span>
            <h3 className="text-base font-bold text-[#172033]">Controlled Failure Simulation</h3>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Inject controlled fault scenarios to observe real-time system isolation and recovery logic
          </p>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-[#ECFDF3] text-[#16A34A] border-[#16A34A]/20'
                : 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Category 1: TRAFFIC */}
        <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E5E7EB]">
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={14} className="text-[#5B4BDB]" /> Traffic Controls
          </div>
          <div className="space-y-2">
            <button
              onClick={() => executeAction('flash-sale', 'Start Flash Sale', 'Flash sale initialized with 100 stock units')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#5B4BDB] text-white hover:bg-[#4C3CBD] px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Zap size={14} /> Start Flash Sale
            </button>

            <button
              onClick={() => executeAction('inject-10k', 'Inject 10,000 Requests', '10,000 concurrent purchase attempts ingested')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#172033] border border-[#E5E7EB] hover:bg-[#F1F5F9] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <Play size={14} className="text-[#16A34A]" /> Inject 10,000 Requests
            </button>

            <button
              onClick={() => executeAction('duplicate-attack', 'Duplicate Request Attack', 'Duplicate attack executed — replays blocked')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#FFF7ED] text-[#D97706] border border-[#D97706]/20 hover:bg-[#FFEDD5] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <AlertTriangle size={14} /> Duplicate Request Attack
            </button>
          </div>
        </div>

        {/* Category 2: PAYMENTS */}
        <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E5E7EB]">
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
            <Radio size={14} className="text-[#2563EB]" /> Payment Faults
          </div>
          <div className="space-y-2">
            <button
              onClick={() => executeAction('payment-failure', 'Simulate Payment Failure', 'Payment failed — reservation released', true)}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20 hover:bg-[#FEE2E2] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <ShieldAlert size={14} /> Simulate Payment Failure
            </button>

            <button
              onClick={() => executeAction('payment-timeout', 'Simulate Payment Timeout', 'Payment timed out after threshold', true)}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20 hover:bg-[#FEE2E2] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <Clock size={14} /> Simulate Payment Timeout
            </button>

            <button
              onClick={() => executeAction('gateway-down', 'Payment Gateway Down', 'Gateway tripped to OPEN state', true)}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20 hover:bg-[#FEE2E2] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <ServerOff size={14} /> Payment Gateway Down
            </button>
          </div>
        </div>

        {/* Category 3: SERVICES */}
        <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E5E7EB]">
          <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw size={14} className="text-[#16A34A]" /> Service Recovery
          </div>
          <div className="space-y-2">
            <button
              onClick={() => executeAction('order-down', 'Order Service Down', 'Order Service marked unavailable — events retained in stream', true)}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#FFF7ED] text-[#D97706] border border-[#D97706]/20 hover:bg-[#FFEDD5] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <ServerOff size={14} /> Order Service Down
            </button>

            <button
              onClick={() => executeAction('expiry', 'Reservation Expiry', 'Stale reservations expired & stock restored')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#172033] border border-[#E5E7EB] hover:bg-[#F1F5F9] px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <Clock size={14} /> Reservation Expiry
            </button>

            <button
              onClick={() => executeAction('recover', 'Recover Services', 'Services recovered — pending events replayed successfully')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-2 bg-[#16A34A] text-white hover:bg-[#15803D] px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <RotateCcw size={14} /> Recover Services
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
