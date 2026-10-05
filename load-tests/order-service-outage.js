// k6 Load Testing Script: Order Service 30s Outage & Event Replay Verification
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  // 1. Simulate Order Service DOWN
  http.post('http://localhost:3000/api/v1/admin/simulation/order-down');

  // 2. Process Successful Payment during Outage
  const payRes = http.post(
    'http://localhost:3000/api/v1/checkout',
    JSON.stringify({ reservationId: 'res_outage_1', userId: 'user_1', amount: 100, simulateMode: 'SUCCESS' }),
    { headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `outage_tx_${Date.now()}` } }
  );

  check(payRes, { 'payment accepted during outage': (r) => r.status === 200 });

  // 3. Recover Order Service & Replay Pending Stream Events
  const recRes = http.post('http://localhost:3000/api/v1/admin/simulation/recover');
  check(recRes, { 'event replay succeeds': (r) => r.status === 200 });
}
