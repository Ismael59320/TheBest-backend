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
router.put("/favorites", (req, res) => {
  const { token, obj_id } = req.body;

  if (!token) {
    return res.json({ result: false, error: "Token requis" });
  } else if (!obj_id) {
    return res.json({ result: false, error: "Place Id requis" });
  }

  User.findOne({ token }).then((data) => {
    if (data.favorites.length === 0) {
      User.updateOne(
        { token },
        { $push: { favorites: obj_id } } //Push du nouveau favoris dans le tableau favorites si rien dans la BDD
      ).then(() => {
        res.json({ result: true, message: "Favori ajouté avec succès" });
      });
    } else {
      // Vérification si le favori n'est pas dejà ajouté
      User.find({ token: token, favorites: obj_id })
        .then((infos) => {
          console.log(infos);
          if (infos.length === 0) {
            User.updateOne({ token }, { $push: { favorites: obj_id } }).then(
              (object) => {
                console.log(object);
                res.json({
                  result: true,
                  message: "Favori ajouté avec succès",
                });
              }
            );
          } else {
            // Si favori deja dans la BDD, le supprimer
            User.updateOne({ token }, { $pull: { favorites: obj_id } }).then(
              (object) => {
                console.log(object);
                res.json({ result: false, message: "Favori supprimé" });
              }
            );
          }
        })
        .catch((e) => res.json({ error: String(e) }));
    }
  });
});

router.get("/favorites", (req, res) => {
  const { token } = req.body;
  User.findOne({ token }).then((data) =>
    res.json({ favorites: data.favorites })
  );
});

router.put("/favorites", (req, res) => {
  const infos = {
    token: "4nr5k20YHjYiWqqq_62WaTy827s_Byvh",
    obj_id: "6759c36641a7d64d06dac3ab",
  };
  res.json({ result: true, message: "Favori ajouté avec succès" });
});

//route pour supprimer le compte
// router.delete("/delete", (req, res) => {
//   console.log("Requête reçue :", req.body);
//   const { Token } = req.body;
//   if (!Token) {
//     return res.status(400).json({ result: false, error: "Token manquant" });
//   }

//   User.deleteOne({ Token: Token })
//     .then(deleteDoc => {
//       // Vérifier si l'utilisateur a bien été supprimé
//       if (deleteDoc.deletedCount > 0) {
//         // L'utilisateur a été supprimé, retourner une réponse
//         res.json({ result: true, message: "Utilisateur supprimé avec succès" });
//       } else {
//         res.status(404).json({ result: false, error: "Utilisateur non trouvé" });
//       }
//     })
// });
// router.delete("/", (req, res) => {
//   User.deleteOne({
//     const token = req.body.token;
//     User.deleteOne({ token: token });
//   }).then(deletedDoc => {
//     if (deletedDoc.deletedCount > 0) {
//       // document successfully deleted
//        User.find().then(data => {
//         res.json({ result: true, weather: data });
//       });
//     } else {
//       res.json({ result: false, error: "user supprimer" });
//     }
//   });
// });

router.get("/all", (req, res) => {
  User.find()  // Trouver tous les utilisateurs dans la base de données
    .then(users => {
      res.json({
        result: true,
        users: users,  // Renvoie la liste des utilisateurs
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ result: false, error: "Erreur serveur" });
    });
});

router.delete("/delete", (req, res) => {
  const token = req.body.token || null;  // Assurez-vous que le token est pris de façon plus explicite
  console.log("Token reçu : ", token);  // Affichez le token pour vérifier si c'est bien récupéré

  if (!token) {
    return res.status(400).json({ result: false, error: "Token manquant" });
  }

  User.deleteOne({ token: token })  // Supprimer l'utilisateur par son token
    .then(deleteDoc => {
      if (deleteDoc.deletedCount > 0) {
        res.json({ result: true, message: "Utilisateur supprimé avec succès" });
      } else {
        res.status(404).json({ result: false, error: "Utilisateur non trouvé" });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ result: false, error: "Erreur serveur" });
    });
});


module.exports = router;
