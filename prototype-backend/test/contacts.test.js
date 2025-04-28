const request = require('supertest');
const { expect } = require('chai');
const { authenticateTestUser } = require('./helpers');

describe('Contacts API', function() {
  this.timeout(10000);
  const api = request('http://localhost:4000');
  let userA, userB;

  before(async function() {
    // Create two real users
    userA = await authenticateTestUser('+44770000011');
    userB = await authenticateTestUser('+44770000022');
  });

  it('POST /contacts (body.contactId) should add a new contact', async function() {
    const res = await api
      .post('/contacts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ contactId: userB.user._id })
      .expect(200);

    expect(res.body).to.have.property('message').match(/Contact added/);
    expect(res.body).to.have.property('contact');
    expect(res.body.contact).to.have.property('_id', userB.user._id);
  });

  it('GET /contacts should list the newly added contact', async function() {
    const res = await api
      .get('/contacts')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    expect(res.body).to.have.property('contacts');
    const contact = res.body.contacts.find(c => c._id === userB.user._id);
    expect(contact).to.exist;
  });

  it('DELETE /contacts/:contactId should remove the contact', async function() {
    await api
      .delete(`/contacts/${userB.user._id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    const res = await api
      .get('/contacts')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    const contact = res.body.contacts.find(c => c._id === userB.user._id);
    expect(contact).to.not.exist;
  });
}); 