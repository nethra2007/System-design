// k6 Load Testing Script: Duplicate Request Attack (2% Replay Rate)
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const url = 'http://localhost:3000/api/v1/sale/HOT_SALE_PRODUCT_X/reserve';
  const sameKey = `duplicate_attack_key_fixed`;

  const payload = JSON.stringify({ quantity: 1, userId: 'user_attacker' });
  const params = { headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': sameKey } };

  // First Request
  const res1 = http.post(url, payload, params);
  // Replay Attack Request
  const res2 = http.post(url, payload, params);

  check(res2, {
    'duplicate request returns original result': (r) => r.status === 200 && JSON.parse(r.body).isDuplicate === true,
  });
}
