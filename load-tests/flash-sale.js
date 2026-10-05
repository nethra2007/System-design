// k6 Load Testing Script: 10,000 Concurrent Flash Sale Purchase Attempts
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    flash_sale_surge: {
      executor: 'per-vu-iterations',
      vus: 10000,
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

export default function () {
  const url = 'http://localhost:3000/api/v1/sale/HOT_SALE_PRODUCT_X/reserve';
  const payload = JSON.stringify({
    quantity: 1,
    userId: `user_vu_${__VU}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `k6_key_${__VU}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 200 or 409': (r) => r.status === 200 || r.status === 409,
    'zero 500 server errors': (r) => r.status !== 500,
  });
}
