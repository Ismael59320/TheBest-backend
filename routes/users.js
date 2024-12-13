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
        favorites: data.favorites,
        avatarUrl: data.avatarUrl,
      });
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});



// Ajouter un favoris dans la BDD
router.put('/favorites', (req, res) => {
  const { token, obj_id } = req.body

  if (!token) {
    return res.json({ result: false, error: 'Token requis' })
  } else if (!obj_id) {
    return res.json({ result: false, error: 'Place Id requis' })
  }

  User.findOne({ token }).then(data => {

    if (data.favorites.length === 0) {
      User.updateOne(
        { token },
        { $push: { favorites: obj_id } } //Push du nouveau favoris dans le tableau favorites si rien dans la BDD
      ).then(() => {
        res.json({ result: true, message: 'Favori ajouté avec succès' })
      })
    } else {
      // Vérification si le favori n'est pas dejà ajouté
      User.find({token: token, favorites: obj_id}).then(infos => {
        console.log(infos)
        if (infos.length === 0){
          User.updateOne(
            {token},
            { $push: {favorites: obj_id}}
          ).then((object) => {
            console.log(object)
            res.json({ result: true, message: 'Favori ajouté avec succès'})
          })
        } else {
          // Si favori deja dans la BDD, le supprimer
          User.updateOne(
            {token},
            {$pull : {favorites: obj_id}}
          ).then((object) => {
            console.log(object)
            res.json({result: false, message: 'Favori supprimé'})
          })
        }
      })
    }
  })
});

router.get('/favorites', (req, res) => {
  const {token} = req.body
  User.findOne({token}).then(data => 

    res.json({favorites: data.favorites})
  )
})

module.exports = router;
