var express = require("express");
var router = express.Router();
require("../models/connection");

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
// router.post('/favorites', (req, res) => {
//   const { token, _id} = req.body
//   User.findOne({token: req.body.token})
//   .populate('place')
//   .then (data => {
//     console.log(data)
//   })

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
// });
// });

module.exports = router;
