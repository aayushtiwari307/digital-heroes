'use strict';

require('./setup');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/config/db');

const app = createApp();

async function signup(email, role = 'subscriber') {
  const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
  if (role === 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [res.body.user.id]);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    return { token: login.body.accessToken, userId: res.body.user.id };
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

describe('Admin: users + reports', () => {
  test('non-admin cannot list users', async () => {
    const { token } = await signup('regularuser@test.com');
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin can list users', async () => {
    const admin = await signup('adminusers1@test.com', 'admin');
    await signup('plainuser1@test.com');

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
  });

  test('admin can view reports summary', async () => {
    const admin = await signup('adminreports1@test.com', 'admin');
    const res = await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('totalPrizePoolFunding');
    expect(res.body).toHaveProperty('totalPayouts');
    expect(res.body).toHaveProperty('totalCharityContributions');
    expect(res.body).toHaveProperty('drawStatistics');
  });

  test('404 for a nonexistent user', async () => {
    const admin = await signup('adminusers2@test.com', 'admin');
    const res = await request(app)
      .get('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});
