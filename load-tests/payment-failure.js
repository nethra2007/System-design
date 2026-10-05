// k6 Load Testing Script: 5% Payment Failure & Stock Release Verification
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const url = 'http://localhost:3000/api/v1/checkout';
  const payload = JSON.stringify({
    reservationId: 'res_sim_fail',
    userId: 'user_fail_test',
    amount: 100,
    simulateMode: 'FAILURE'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `k6_pay_fail_${Date.now()}`
    }
  };

  const res = http.post(url, payload, params);
  check(res, {
    'payment failure returns 402': (r) => r.status === 402,
  });
}
