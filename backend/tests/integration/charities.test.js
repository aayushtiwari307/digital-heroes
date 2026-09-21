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
    // token was signed with role='subscriber' as a fast-path hint; re-login
    // to get a token reflecting the new role, exactly like a real client would.
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    return { token: login.body.accessToken, userId: res.body.user.id };
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

describe('Charity routes', () => {
  test('public: anyone can list charities with no auth', async () => {
    const res = await request(app).get('/api/charities');
    expect(res.status).toBe(200);
    expect(res.body.charities).toEqual([]);
  });

  test('non-admin cannot create a charity', async () => {
    const { token } = await signup('notadmin@test.com');
    const res = await request(app)
      .post('/api/charities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Charity' });
    expect(res.status).toBe(403);
  });

  test('unauthenticated cannot create a charity', async () => {
    const res = await request(app).post('/api/charities').send({ name: 'Test Charity' });
    expect(res.status).toBe(401);
  });

  test('admin can create, list, get, update, delete a charity', async () => {
    const { token } = await signup('admin1@test.com', 'admin');

    const created = await request(app)
      .post('/api/charities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Water For All', description: 'Clean water access' });
    expect(created.status).toBe(201);
    expect(created.body.min_pct).toBe(10); // PRD fact default

    const list = await request(app).get('/api/charities');
    expect(list.body.charities).toHaveLength(1);

    const got = await request(app).get(`/api/charities/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.events).toEqual([]);

    const updated = await request(app)
      .put(`/api/charities/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description' });
    expect(updated.body.description).toBe('Updated description');

    const deleted = await request(app)
      .delete(`/api/charities/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const listAfter = await request(app).get('/api/charities');
    expect(listAfter.body.charities).toHaveLength(0);
    const stillThere = await pool.query(`SELECT is_active FROM charities WHERE id=$1`, [created.body.id]);
    expect(stillThere.rows[0].is_active).toBe(false);
  });

  test('rejects a min_pct below the PRD-mandated 10% floor', async () => {
    const { token } = await signup('admin2@test.com', 'admin');
    const res = await request(app)
      .post('/api/charities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Charity', minPct: 5 });
    expect(res.status).toBe(400);
  });

  test('404 for a nonexistent charity', async () => {
    const res = await request(app).get('/api/charities/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
