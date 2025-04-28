const request = require('supertest');
const { expect } = require('chai');
const { authenticateTestUser } = require('./helpers');

describe('Users API', function() {
  this.timeout(10000);
  const api = request('http://localhost:4000');
  let userA;

  before(async function() {
    userA = await authenticateTestUser('+44770000111');
  });

  it('GET /users/me should return the user profile', async function() {
    const res = await api
      .get('/users/me')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    expect(res.body).to.have.property('anonId', userA.user.anonId);
  });

  it('PUT /users/me should update bio', async function() {
    const newBio = 'Updated bio';
    const res = await api
      .put('/users/me')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ bio: newBio })
      .expect(200);

    expect(res.body.user).to.have.property('bio', newBio);
  });

  it('POST /users/block/:id should block another user', async function() {
    const userB = await authenticateTestUser('+44770000112');
    await api
      .post(`/users/block/${userB.user._id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
  });
}); 