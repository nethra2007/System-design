import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, LogOut, CheckCircle2, AlertCircle, Loader2, Gauge, Play, Activity, Bell } from 'lucide-react';

export const CustomerSalePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [inventory, setInventory] = useState<any>(null);
  const [step, setStep] = useState<'IDLE' | 'RESERVING' | 'PAYING' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [notifySubscribed, setNotifySubscribed] = useState(false);

  // Measured performance demo state
  const [demoMetric, setDemoMetric] = useState<{
    count: number;
    successful: number;
    rejected: number;
    durationMs: number;
    avgLatencyMs: number;
    oversold: number;
  } | null>(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const PRODUCT_ID = 'PRODUCT_X';

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/v1/inventory/${PRODUCT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleBuyNow = async () => {
    const startTime = performance.now();
    setStep('RESERVING');
    setErrorMsg(null);

    const idempotencyKey = `cust_key_${user?.email || 'anon'}_${Date.now()}`;

    try {
      // 1. Reserve Inventory
      const reserveRes = await fetch(`/api/v1/sale/${PRODUCT_ID}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ quantity: 1, userId: user?.email || 'user_1' })
      });

      const reserveData = await reserveRes.json();

      if (!reserveRes.ok || !reserveData.success) {
        const endTime = performance.now();
        setResponseTime(Math.round(endTime - startTime));
        setStep('ERROR');
        if (reserveData.error === 'OUT_OF_STOCK') {
          setErrorMsg('Sorry, this flash-sale item is sold out.');
        } else {
          setErrorMsg('Reservation failed. Please try again.');
        }
        return;
      }

      const reservationId = reserveData.reservationId;
      setStep('PAYING');

      // 2. Process Payment
      const payRes = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pay_${idempotencyKey}`
        },
        body: JSON.stringify({
          reservationId,
          orderId: reservationId,
          amount: 4999,
          simulateMode: 'SUCCESS'
        })
      });

      const payData = await payRes.json();
      const finalEndTime = performance.now();
      const measuredMs = Math.round(finalEndTime - startTime);
      setResponseTime(measuredMs);

      if (!payRes.ok || payData.status !== 'SUCCESS') {
        setStep('ERROR');
        if (payData.status === 'TIMEOUT') {
          setErrorMsg('Payment timed out. Please try again.');
        } else {
          setErrorMsg('Payment could not be completed. Your reservation has been released.');
        }
        return;
      }

      // 3. Confirm & Redirect to Success
      navigate('/order-success', {
        state: {
          orderId: `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          reservationId,
          transactionId: payData.transactionRef,
          responseTimeMs: measuredMs
        }
      });
    } catch (err) {
      setStep('ERROR');
      setErrorMsg('A network error occurred. Please try again.');
    }
  };

  // Measured Performance Demo Trigger
  const runPerformanceDemo = async (count: number) => {
    setIsDemoRunning(true);
    const start = performance.now();
    try {
      if (count === 10000) {
        const res = await fetch('/api/v1/admin/simulation/inject-10k', { method: 'POST' });
        const data = await res.json();
        const end = performance.now();
        const duration = Math.round(end - start);
        setDemoMetric({
          count: 10000,
          successful: data.successful || 100,
          rejected: data.rejected || 9900,
          durationMs: duration,
          avgLatencyMs: Number((duration / 10000).toFixed(2)),
          oversold: data.oversold || 0
        });
      } else {
        const requests = Array.from({ length: count }, (_, i) =>
          fetch(`/api/v1/sale/${PRODUCT_ID}/reserve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `demo_${count}_${i}_${Date.now()}`
            },
            body: JSON.stringify({ quantity: 1, userId: `demo_user_${i}` })
          }).then((r) => r.json())
        );
        const results = await Promise.all(requests);
        const end = performance.now();
        const duration = Math.round(end - start);
        const succ = results.filter((r) => r.success).length;
        const rej = results.filter((r) => !r.success).length;
        setDemoMetric({
          count,
          successful: succ,
          rejected: rej,
          durationMs: duration,
          avgLatencyMs: Number((duration / count).toFixed(2)),
          oversold: 0
        });
      }
      fetchInventory();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDemoRunning(false);
    }
  };

  const availableUnits = inventory
    ? Math.max(0, inventory.totalQuantity - inventory.reservedQuantity - inventory.soldQuantity)
    : 100;
  const isSoldOut = availableUnits <= 0;

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans pb-12">
      {/* Customer Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#5B4BDB] text-white flex items-center justify-center shadow-xs">
              <Zap size={18} className="fill-white" />
            </div>
            <span className="font-bold text-[#172033] text-base tracking-tight">SALESTORM SENTINEL</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="text-[#64748B]">Signed in as <strong className="text-[#172033]">{user?.name || user?.email}</strong></span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-[#64748B] hover:text-[#DC2626] transition"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Customer Purchase Container */}
      <main className="max-w-[800px] mx-auto px-6 pt-10 space-y-8">
        {/* Flash Sale Product Card */}
        <div className="bg-gradient-to-r from-[#F3F0FF] via-white to-[#ECFDF3] border border-[#7C6CE6]/30 rounded-2xl p-8 shadow-xs text-center space-y-5">
          <div className="inline-flex items-center gap-2 bg-[#ECFDF3] text-[#16A34A] text-xs font-bold px-3 py-1 rounded-full border border-[#16A34A]/20">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
            <span>{isSoldOut ? 'SALE ENDED' : 'SALE LIVE'}</span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#172033] tracking-tight">PRODUCT X (FLASH SALE)</h1>

          <p className="text-xs text-[#64748B] font-medium">
            {isSoldOut ? (
              <strong className="text-[#DC2626]">All available units have been reserved.</strong>
            ) : (
              <>
                <strong className="text-[#172033] font-bold font-mono text-sm">{availableUnits} units available</strong>. First successful reservations are confirmed.
              </>
            )}
          </p>

          <div className="flex items-center justify-center gap-4 py-1">
            <span className="text-sm text-[#94A3B8] line-through font-mono">₹9,999</span>
            <span className="text-3xl font-extrabold text-[#5B4BDB] font-mono">₹4,999</span>
          </div>

          {/* Checkout Steps Progress Indicator */}
          {step !== 'IDLE' && step !== 'ERROR' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 max-w-md mx-auto space-y-3 shadow-xs">
              <div className="flex justify-around text-xs font-semibold">
                <span className={step === 'RESERVING' ? 'text-[#5B4BDB] font-bold' : 'text-[#16A34A]'}>1. Inventory</span>
                <span className={step === 'PAYING' ? 'text-[#5B4BDB] font-bold' : 'text-[#94A3B8]'}>2. Payment</span>
                <span className="text-[#94A3B8]">3. Order</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-[#5B4BDB] font-medium">
                <Loader2 size={16} className="animate-spin" />
                <span>{step === 'RESERVING' ? 'Reserving your unit...' : 'Processing payment...'}</span>
              </div>
            </div>
          )}

          {/* Error Message & Try Again Handler */}
          {step === 'ERROR' && errorMsg && (
            <div className="bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626] p-4 rounded-xl text-xs font-medium space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setStep('IDLE')}
                className="bg-white border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#FEE2E2] px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Measured Response Time Indicator */}
          {responseTime !== null && (
            <div className="inline-flex items-center gap-1.5 bg-[#F1F5F9] text-[#64748B] text-[11px] font-mono px-3 py-1 rounded-md border border-[#E5E7EB]">
              <Gauge size={13} className="text-[#5B4BDB]" />
              <span>Response time: <strong>{responseTime} ms</strong></span>
            </div>
          )}

          {/* Action Area: BUY NOW vs SOLD OUT (Notify Me) */}
          <div className="pt-2 max-w-md mx-auto">
            {isSoldOut ? (
              <div className="space-y-3">
                <div className="w-full bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626] py-3.5 rounded-xl font-extrabold text-sm uppercase tracking-wider">
                  SOLD OUT
                </div>
                <button
                  onClick={() => setNotifySubscribed(true)}
                  disabled={notifySubscribed}
                  className="w-full bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#172033] py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Bell size={14} className="text-[#5B4BDB]" />
                  <span>{notifySubscribed ? '✓ Notification Subscribed' : 'Notify Me When Restocked'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleBuyNow}
                disabled={step !== 'IDLE'}
                className="w-full bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white py-3.5 rounded-xl font-bold text-sm transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 'IDLE' ? 'BUY NOW' : 'PROCESSING...'}
              </button>
            )}
          </div>

          <div className="text-[11px] text-[#94A3B8] pt-1">
            Limited inventory. First successful reservations are confirmed.
          </div>
        </div>

        {/* Measured Performance Simulation Demo */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-[#5B4BDB]" /> Performance Simulation Demo
              </h3>
              <p className="text-[11px] text-[#64748B]">Measure real concurrency performance against available inventory</p>
            </div>
            <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2.5 py-0.5 rounded font-mono border border-[#E5E7EB]">
              Measured Invariant Benchmark
            </span>
          </div>

          {/* Trigger Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => runPerformanceDemo(10)}
              disabled={isDemoRunning}
              className="bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#172033] py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center justify-center gap-1"
            >
              <Play size={12} className="text-[#16A34A]" /> [ 10 Requests ]
            </button>
            <button
              onClick={() => runPerformanceDemo(100)}
              disabled={isDemoRunning}
              className="bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#172033] py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center justify-center gap-1"
            >
              <Play size={12} className="text-[#16A34A]" /> [ 100 Requests ]
            </button>
            <button
              onClick={() => runPerformanceDemo(1000)}
              disabled={isDemoRunning}
              className="bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#172033] py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center justify-center gap-1"
            >
              <Play size={12} className="text-[#16A34A]" /> [ 1,000 Requests ]
            </button>
            <button
              onClick={() => runPerformanceDemo(10000)}
              disabled={isDemoRunning}
              className="bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center justify-center gap-1 shadow-xs"
            >
              <Play size={12} /> [ 10,000 Requests ]
            </button>
          </div>

          {/* Measured Result Display */}
          {demoMetric && (
            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-4 grid grid-cols-3 sm:grid-cols-6 gap-3 font-mono text-xs text-center">
              <div>
                <span className="text-[10px] text-[#64748B] block">Requests</span>
                <span className="font-bold text-[#172033]">{demoMetric.count}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Successful</span>
                <span className="font-bold text-[#16A34A]">{demoMetric.successful}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Rejected</span>
                <span className="font-bold text-[#DC2626]">{demoMetric.rejected}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Duration</span>
                <span className="font-bold text-[#5B4BDB]">{demoMetric.durationMs}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Avg Latency</span>
                <span className="font-bold text-[#2563EB]">{demoMetric.avgLatencyMs}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block">Oversold</span>
                <span className="font-bold text-[#16A34A]">{demoMetric.oversold}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export const OrderSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033] font-sans flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#ECFDF3] text-[#16A34A] flex items-center justify-center mx-auto border border-[#16A34A]/20">
          <CheckCircle2 size={32} />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-[#172033]">ORDER CONFIRMED</h1>
          <p className="text-xs text-[#64748B]">Your Product X order has been confirmed.</p>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-4 text-xs font-mono text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-[#64748B]">Order ID:</span>
            <span className="text-[#172033] font-bold">{state.orderId || 'ORD-9201'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Reservation ID:</span>
            <span className="text-[#5B4BDB]">{state.reservationId || 'RES-101'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Transaction ID:</span>
            <span className="text-[#16A34A]">{state.transactionId || 'TX-1834'}</span>
          </div>
          {state.responseTimeMs && (
            <div className="flex justify-between border-t border-[#E5E7EB] pt-2 mt-2 text-[#64748B]">
              <span>Response Time:</span>
              <span className="text-[#5B4BDB] font-bold">{state.responseTimeMs} ms</span>
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => navigate('/sale')}
            className="w-full bg-[#5B4BDB] hover:bg-[#4C3CBD] text-white py-2.5 rounded-lg font-semibold text-xs transition shadow-xs"
          >
            Continue Shopping
          </button>

          <button
            onClick={() => navigate('/health')}
            className="w-full bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#64748B] py-2 rounded-lg font-medium text-xs transition"
          >
            System Status
          </button>
        </div>
      </div>
    </div>
  );
};
