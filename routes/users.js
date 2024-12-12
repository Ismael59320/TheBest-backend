var express = require("express");
var router = express.Router();

const User = require("../models/user");
// const Favorite = require('../models/user')
const { checkBody } = require("../modules/checkBody");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");

router.post("/signup", (req, res) => {
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }
  console.log(req.body);
  User.findOne({ email: req.body.email }).then((data) => {
    if (data === null) {
      const hash = bcrypt.hashSync(req.body.password, 10);

      const newUser = new User({
        username: req.body.username,
        password: hash,
        token: uid2(32),
        email: req.body.email,
        avatarUrl: "map-pin-yellow",
      });
      newUser.save().then((newDoc) => {
        res.json({
          result: true,
          token: newDoc.token,
          avatarUrl: newDoc.avatarUrl,
        });
      });
    } else {
      // User already exists in database
      res.json({ result: false, error: "Email already exists" });
    }
  });
});

router.post("/signin", (req, res) => {
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ username: req.body.username }).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      res.json({
        result: true,
        token: data.token,
        avatarUrl: data.avatarUrl,
      });
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});

// Ajouter un favoris dans la bdd
router.post('/favorites', (req, res) => {
  const {token, place_id}  = req.body

  if (!token){
    return res.json({ result: false, error: 'Token requis' })
  } else if (!place_id){
    return res.json({result: false, error: 'Place Id requis'})
  }

User.findOne({token}).then(data => {
  console.log(data.favorites)
  if (data.token.length === 0){
    return res.json({ result: false, error:'Utilisateur non trouvé/connecté'})
  }

  if (data.favorites.length === 0){
    data.updateOne(
      {token},
      {$push: {favorites: {id : place_id}}} //Push du nouveau favoris dans le tableau favorites
    ).then(() => {
      console.log(data)
      // data.find().then(response => {
      //   console.log(response)
      // })
    })
    // data.favorites.push({id: place_id})
    // data.save().then (() => {
    //   data.find().then((res) => {
    //     console.log(res)
    //     res.json({ result: true, message: 'Favori ajouté'})
    //   })
    // })
  } else {
    // Vérification si le favori n'est pas dejà ajouté
    const alreadyExists = data.favorites.some(fav => fav.id.toString() === place_id);
    if (alreadyExists){
      return res.json({ result: false, error: 'Favori dejà dans la liste'})
    }

    // Ajouter le favori
    data.favorites.push({id : place_id})
    data.save().then(() => {
      data.find().then((res) => {
        console.log(res)
        res.json({ result: true, message: 'Favori ajouté'})
      })
    })
  }
  
})
  // if (!user){
  //   return res.json({ result: false, error: 'Utilisateur non trouvé'})
  // };

  // console.log(user)

  // if (user.favorites === 0){

  //   console.log(user)
  //   // user.favorites.push({id: place_id});
  //   // user.save().then(data => {
  //   //   req.json({result: true, message: data})
  //   // })
  // } else {
  //   //Vérifie si le favori est déja ajouté dans la liste
  //   const alreadyExists = user.favorites?.some(fav => fav.id.toString() === place_id);
  //   if (alreadyExists){
  //     return res.json({ result: false, error: 'Favori déja ajouté'})
  //   }
  
  //   //Ajouter le favori
  //   user.favorites.push({id: place_id});
  //   user.save().then(data => {
  //     req.json({result: true, message: data})
  //   })
  // }


  // res.json({result: true, message:'Favori ajouté en BDD', place_id})

  // const updateResult = User.updateOne(
  //   {token},
  //   {$push: {favorites: {id : place_id}}} //Push du nouveau favoris dans le tableau favorites
  // );

  // // Vérifie si l'utilisateur a été trouvé et mis à jour
  // if (updateResult.matchedCount === 0){
  //   return res.json({result: false, error: 'Aucun utilisateur ne correspond a ce token'})
  // }

  // //MAJ réussie
  // res.json({ result: true, message: 'Favori ajouté', place_id});
  
  
//   .then(() => {
//     User.find().then(data => {
//       console.log(data)
//     }) 
//   })
// });
  // .populate('favorites')
  // .then (data => {
  //   console.log(data)
  
  
  // .then((data) => {
  //   console.log(data)
  //   if (data) {
  //     const newFavorite = new Favorite ({
  //       id: O,
  //     })
  //     newFavorite.save();
  //     res.json({result: true, newFavorite});
  //   } else {
  //     res.json({ result: false, error:'pas de favori ajouté'})
  //   }
  });

module.exports = router;
