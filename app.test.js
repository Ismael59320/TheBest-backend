const request = require("supertest");
const app = require("./app");
const mongoose = require("mongoose");
const User = require("./models/user");


beforeEach(async () => await User.findOne());

it("PUT /users/favorites verification route existante ", async () => {
  const res = await request(app).put("/users/favorites");
  expect(res.statusCode).toBe(200);
});

it("PUT /users/favorites ", async () => {
  const res = await request(app).put("/users/favorites");
  expect(res.body.result).toBe(false);
});


it("PUT /users/favorites ajout d'un favoris", async () => {
  const token = 'roHH_3p7ve0oB_Y7ZVx-o3XcERxFE_uT';
  const obj_id = '6759c36641a7d64d06dac3ab'
  
  const res = await request(app).put("/users/favorites").send({
    token: token,
    obj_id: obj_id,
    
  });
  expect(res.body).toEqual({message: "Favori ajouté avec succès", result: true});
  
  // User.update();
});

afterAll(async () => {
  User.deleteMany();
  mongoose.connection.close();
});


// it("PUT /generatedata/users?nbUsers", async () => {
//   const res = await request(app).put("/users/favorites")
//   .query({
//     token: 'roHH_3p7ve0oB_Y7ZVx-o3XcERxFE_uT',
//     obj_id: '1564513154645'

//   });
//   expect(res.body.result).toBe(true);
//   // expect(res.body.data.length).toBe(10);
//   //check the properties
//   const firstUser = res.body.data[0];
//   expect(firstUser.infos.firstname).not.toBeNull();
//   expect(firstUser.infos.lastname).not.toBeNull();
//   expect(firstUser.infos.telephone).not.toBeNull();
//   expect(firstUser.infos.email).not.toBeNull();
//   expect(firstUser).toHaveProperty(["infos.photo"]);
//   expect(firstUser).toHaveProperty(["infos.isDogSitter"]);
//   expect(firstUser).toHaveProperty(["infos.isSearchingDogSitter"]);
//   expect(firstUser.password).not.toBeNull();
//   expect(firstUser.token).not.toBeNull();
//   expect(firstUser.status).toMatch(/(walk|pause|off)/i);
//   expect(firstUser).toHaveProperty(["currentLocation.type"]);
//   expect(firstUser).toHaveProperty(["currentLocation.coordinates"]);
//   expect(firstUser).toHaveProperty(["homeLocation.type"]);
//   expect(firstUser).toHaveProperty(["homeLocation.coordinates"]);
//   expect(firstUser.dogs.length).toBeGreaterThanOrEqual(1);
//   expect(firstUser).toHaveProperty("friends");
//   expect(firstUser.isFake).toBe(true);

//   User.deleteMany();
// });



// const express = require('express');
// const User = require('./models/user'); // Mock du modèle User
// const router = require('./routes/users'); // Route à tester
// const request = require('supertest')

// jest.mock('./models/user'); // Mock du modèle User pour éviter d'interagir avec une vraie DB

// const app = express();
// app.use(express.json());
// app.use(router);

// describe('PUT /favorites', () => {
//   beforeEach(() => {
//     jest.clearAllMocks(); // Réinitialiser les mocks avant chaque test
//   });

//   it('retourne une erreur si le token est manquant', async () => {
//     const response = await request(app).put('/favorites').send({ obj_id: '123' });

//     expect(response.body).toEqual({ result: false, error: 'Token requis' });
//   });

//   it('retourne une erreur si le obj_id est manquant', async () => {
//     const response = await request(app).put('/favorites').send({ token: 'valid_token' });

//     expect(response.body).toEqual({ result: false, error: 'Place Id requis' });
//   });

//   it("ajoute un favori lorsque le tableau des favoris est vide", async () => {
//     User.findOne.mockResolvedValue({ favorites: [] });
//     User.updateOne.mockResolvedValue({});

//     const response = await request(app)
//       .put('/favorites')
//       .send({ token: 'valid_token', obj_id: '123' });

//     expect(User.findOne).toHaveBeenCalledWith({ token: 'valid_token' });
//     expect(User.updateOne).toHaveBeenCalledWith(
//       { token: 'valid_token' },
//       { $push: { favorites: '123' } }
//     );
//     expect(response.body).toEqual({ result: true, message: 'Favori ajouté avec succès' });
//   });

//   it("ajoute un favori lorsque le favori n'est pas déjà dans le tableau", async () => {
//     User.findOne.mockResolvedValue({ favorites: ['456'] });
//     User.find.mockResolvedValue([]);
//     User.updateOne.mockResolvedValue({});

//     const response = await request(app)
//       .put('/favorites')
//       .send({ token: 'valid_token', obj_id: '123' });

//     expect(User.find).toHaveBeenCalledWith({
//       token: 'valid_token',
//       favorites: '123',
//     });
//     expect(User.updateOne).toHaveBeenCalledWith(
//       { token: 'valid_token' },
//       { $push: { favorites: '123' } }
//     );
//     expect(response.body).toEqual({ result: true, message: 'Favori ajouté avec succès' });
//   });

//   it('supprime un favori lorsqu’il est déjà présent', async () => {
//     User.findOne.mockResolvedValue({ favorites: ['123', '456'] });
//     User.find.mockResolvedValue([{ token: 'valid_token', favorites: '123' }]);
//     User.updateOne.mockResolvedValue({});

//     const response = await request(app)
//       .put('/favorites')
//       .send({ token: 'valid_token', obj_id: '123' });

//     expect(User.find).toHaveBeenCalledWith({
//       token: 'valid_token',
//       favorites: '123',
//     });
//     expect(User.updateOne).toHaveBeenCalledWith(
//       { token: 'valid_token' },
//       { $pull: { favorites: '123' } }
//     );
//     expect(response.body).toEqual({ result: false, message: 'Favori supprimé' });
//   });
// });



// const request = require('supertest')
// const app = require('./app')
// const User = require('./models/user')
// const mongoose = require('mongoose')
// var express = require("express");
// var router = express.Router();


// it ('PUT /favorites token manquant', async () => {
//     const res = (await request(app).put('/favorites')).send({obj_id: '123456'});
    
//     expect(res.statusCode).toBe(200);
//     expect(res.body.result).toEqual(false);
// })

// it ('PUT /favorites place ID manquant', async () => {
//     const res = (await request(app).put('/favorites')).send({token: 'roHH_3p7ve0oB_Y7ZVx-o3XcERxFE_uT'});

//     expect(res.statusCode).toBe(200);
//     expect(res.body.result).toEqual(false)
// })

// it ('PUT /favorites ajout d un nouveau fav', async() => {
//     User.findOne({ favorites : ['6759c36641a7d64d06dac3ab']})
//     User.find([])
//     User.updateOne({})

//     // const response = 'roHH_3p7ve0oB_Y7ZVx-o3XcERxFE_uT'
//     // const updateFav = {
//     //     favorites : '6759c36641a7d64d06dac3ab' 
//     // }

//     const res = await request(app)
//     .put(`/favorites`)
//     .send({
//       token: 'roHH_3p7ve0oB_Y7ZVx-o3XcERxFE_uT',
//       obj_id: '6759c36641a7d64d06dac3ab'
//     })


//     expect(res.statusCode).toBe(200);
//     expect(res.body.result).toEqual(true)
// })



// router.put('/favorites', (req, res) => {
//     const { token, obj_id } = req.body
  
//     if (!token) {
//       return res.json({ result: false, error: 'Token requis' })
//     } else if (!obj_id) {
//       return res.json({ result: false, error: 'Place Id requis' })
//     }
  
//     User.findOne({ token }).then(data => {
  
//       if (data.favorites.length === 0) {
//         User.updateOne(
//           { token },
//           { $push: { favorites: obj_id } } //Push du nouveau favoris dans le tableau favorites si rien dans la BDD
//         ).then(() => {
//           res.json({ result: true, message: 'Favori ajouté avec succès' })
//         })
//       } else {
//         // Vérification si le favori n'est pas dejà ajouté
//         User.find({token: token, favorites: obj_id}).then(infos => {
//           console.log(infos)
//           if (infos.length === 0){
//             User.updateOne(
//               {token},
//               { $push: {favorites: obj_id}}
//             ).then((object) => {
//               console.log(object)
//               res.json({ result: true, message: 'Favori ajouté avec succès'})
//             })
//           } else {
//             // Si favori deja dans la BDD, le supprimer
//             User.updateOne(
//               {token},
//               {$pull : {favorites: obj_id}}
//             ).then((object) => {
//               console.log(object)
//               res.json({result: false, message: 'Favori supprimé'})
//             })
//           }
//         })
//       }
//     })
//   });

// it('PUT /favorites', async () => {
//     const res = await request(app).post('/favorites').send({
//       email: 'john@gmail.com',
//       password: 'azerty123',
//     });
   
//     expect(res.statusCode).toBe(200);
//     expect(res.body.result).toBe(true);
//    });


// it ('POST /users', async() => { 
//     const res = await request(UserRoute).post('/users/signin').send({
//         username : 'UserTest',
//         email: 'userTest@thebest.com',
//         password: 'superPassword'
//     })

//     expect(res.statusCode).toBe(200);
//     expect(res.body.result).toBe(true)
// })
