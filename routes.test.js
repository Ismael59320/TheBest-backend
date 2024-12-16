//TEST TDD

const request = require('supertest');
const app = require('../app');

describe('GET /findNearbyRestaurants', () => {
  it('should return an array of formatted restaurants with the correct structure and data attended', async () => {
    const res = await request(app).get('/findNearbyRestaurants');

    // Vérifie que la réponse est un succès (code 200)
    expect(res.statusCode).toBe(200);

    // Vérifie que la réponse est un tableau
    expect(Array.isArray(res.body)).toBe(true);

    // Vérifie la structure s'il a au moins un restaurant
    if (res.body.length > 0) {
      const firstRestaurant = res.body[0];
      expect(firstRestaurant).toHaveProperty('id');
      expect(firstRestaurant).toHaveProperty('name');
      expect(firstRestaurant).toHaveProperty('address');
      expect(firstRestaurant).toHaveProperty('rating');
      expect(firstRestaurant).toHaveProperty('photo');
      expect(firstRestaurant).toHaveProperty('phoneNumber');
      expect(firstRestaurant).toHaveProperty('openingHours');
      expect(firstRestaurant).toHaveProperty('categories');
      expect(firstRestaurant).toHaveProperty('type');
    }
  });
});
