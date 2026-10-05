import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';

describe('API Layer Integration Test Suite', () => {
  let app: any;
  let inventoryService: any;
  const PRODUCT_ID = 'PROD_TEST_API';

  beforeEach(async () => {
    const serverInstance = createServer();
    app = serverInstance.app;
    inventoryService = serverInstance.inventoryService;
    await inventoryService.setupInventory(PRODUCT_ID, 2);
  });

  it('1. POST /api/v1/sale/:productId/reserve -> Reserves stock idempotently', async () => {
    const res1 = await request(app)
      .post(`/api/v1/sale/${PRODUCT_ID}/reserve`)
      .set('X-Idempotency-Key', 'api_key_100')
      .send({ quantity: 1, userId: 'user_api' });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.reservationId).toBeDefined();

    // Idempotent re-submission
    const res2 = await request(app)
      .post(`/api/v1/sale/${PRODUCT_ID}/reserve`)
      .set('X-Idempotency-Key', 'api_key_100')
      .send({ quantity: 1, userId: 'user_api' });

    expect(res2.status).toBe(200);
    expect(res2.body.isDuplicate).toBe(true);
    expect(res2.body.reservationId).toBe(res1.body.reservationId);
  });

  it('2. POST /api/v1/sale/:productId/reserve -> Returns 409 OUT_OF_STOCK when exhausted', async () => {
    await request(app)
      .post(`/api/v1/sale/${PRODUCT_ID}/reserve`)
      .set('X-Idempotency-Key', 'api_key_1')
      .send({ quantity: 1 });

    await request(app)
      .post(`/api/v1/sale/${PRODUCT_ID}/reserve`)
      .set('X-Idempotency-Key', 'api_key_2')
      .send({ quantity: 1 });

    // Third attempt (out of stock)
    const res = await request(app)
      .post(`/api/v1/sale/${PRODUCT_ID}/reserve`)
      .set('X-Idempotency-Key', 'api_key_3')
      .send({ quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('OUT_OF_STOCK');
  });

  it('3. GET /api/v1/inventory/:productId -> Returns stock status', async () => {
    const res = await request(app).get(`/api/v1/inventory/${PRODUCT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.totalQuantity).toBe(2);
  });

  it('4. POST /api/v1/admin/simulation/flash-sale', async () => {
    const res = await request(app).post('/api/v1/admin/simulation/flash-sale');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
