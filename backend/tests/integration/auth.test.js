'use strict';

require('./setup');
const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp();

describe('POST /api/auth/signup', () => {
  test('creates a user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'aayush@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('aayush@test.com');
    expect(res.body.user.role).toBe('subscriber'); // never trusts a client-supplied role
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.password_hash).toBeUndefined(); // hash never leaves the server
  });

  test('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'dup@test.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'dup@test.com', password: 'anotherPassword' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  test('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'short@test.com', password: '123' });

    expect(res.status).toBe(400);
  });

  test('attempting to sign up as admin via body is ignored — role is never client-controlled', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'sneaky@test.com', password: 'password123', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('subscriber');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'login@test.com', password: 'correctPassword1' });
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'correctPassword1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  test('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'wrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects unknown email with the SAME error shape as wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS'); // never reveals whether the email exists
  });
});

describe('GET /api/auth/me', () => {
  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  test('returns the authenticated user for a valid token', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'me@test.com', password: 'password123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signupRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });
});


describe('POST /api/auth/refresh', () => {
  test('rotates a valid refresh token and rejects the old token', async () => {
    const signup = await request(app).post('/api/auth/signup').send({ email: 'refresh@test.com', password: 'password123' });
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: signup.body.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    expect(first.body.refreshToken).toEqual(expect.any(String));
    expect(first.body.refreshToken).not.toBe(signup.body.refreshToken);

    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken: signup.body.refreshToken });
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('INVALID_REFRESH_TOKEN');

    const second = await request(app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  test('rejects a malformed refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });
});
