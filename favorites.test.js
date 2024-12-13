const request = require('supertest')
const app = require('./app')
const User = require('./models/user')
const mongoose = require('mongoose')


it ('PUT /favorites token manquant', async () => {
    const res = (await request(app).put('/favorites')).send({obj_id: '123456'});
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({result: false, error: 'Token requis'});
})

it ('PUT /favorites place ID manquant', async () => {
    const res = (await request(app).put('/favorites')).send({token: '12345678'});

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: false, error: 'Place Id requis' })
})

it ('PUT /favorites ajout d un nouveau fav', async() => {
    const res = (await request(app).put('/users')).send({
        token: 'SuperToken',
        obj_id: 'Place12345678'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe({result: true, message: 'Favori ajouté avec succès'})
})