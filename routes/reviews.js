var express = require("express");
var router = express.Router();
const User = require('../models/user')
const Review = require('../models/review')


// Poster un avis sur un resto
router.post('/', (req, res) => {
    User.findOne({ token : req.body.token})
    .then((data) => {
        if (data) {
            const newReview = new Review ({
                user: data._id,
                place_id: req.body.place_id,
                rating: req.body.rating,
                username: data.username,
                text: req.body.text,
                photo: req.body.photo,
                created: new Date(),
            });
            newReview.save();
            res.json({result: true, newReview});
        } else {
            console.log(data)
            res.json({ result: false, error: 'echec de la publication'})
        }
    });
});


// Retrouver les avis par resto grace à sa place_id afin de les afficher sur la fiche resto
router.get("/:place_id", async (req, res) => {
    try {
        const place_id = req.params.place_id; 

        // Recherche des avis correspondant a la place_id
        const reviews = await Review.find({ place_id: place_id });

        if (reviews && reviews.length > 0) {
            res.json({ result: true, reviews });
        } else {
            res.json({ result: false, message: "Aucun avis Bester pour le moment, soyez le premier" });
        }
    } catch (error) {
        res.status(500).json({ result: false, error: "Erreur de recupération des avis" });
    }
});

router.put("/:token", async (req, res) => {
    const token = req.params.token;

    const reviews = await Review.find({ token: token});

    if (reviews && reviews.length > 0) {
        res.json({ result : true, reviews})
    } else {
        res.json ({ result : false, message: "Ce Bester n'a pas encore laissé d'avis"})
    }
})

// router.delete(":/token", async (req, res) => {
//     const token = req.params.token;

//     User.find({token: token,}).then((user) => {
//         console.log(user)
//         res.json(user)
//     })

//     // User.findOne({ token : token}).then((user) => {
//     //     console.log(user)
//     //     res.json(user)
//     // })

//     const reviews = await Review.find({ token : token});

//     // if (reviews && reviews.length > 0) {
//     //     res.json({result: true, reviews})
//     // } else {
//     //     res.json({result: false})
//     // }
// })

router.delete("/", (req, res) => {
 
    const {token, _id} = req.body;


    User.findOne({token : token})
    .then((user) => {
        Review.deleteOne({ _id: _id, user: user._id})
        .then((data) => {
            if(data){
                res.json({result: true, message: "Suppression réussie"})
            } else {
                res.json({result: false, error: "Echec de la suppression"})
            }
        })

    
    //    Review.deleteById({_id: _id})
    //     .then((reviews) => {
    //         console.log(_id)
    //         res.json(reviews)
    
    })

    // if (!token || !_id){
    //     return res.json({result: false, error: 'Token et Id requis'})
    // }

    // try {
    //     const user =  User.findOne({ token: token });

    //     if (!user){
    //         return res.json({ result: false, error: "Utilisateur non trouvé"})
    //     }


    //     const deleteReview = Review.deleteOne({ _id: _id, user: user._id})

    //     if (deleteReview.deletedCount > 0){
    //         res.json({ result: true, message: "Avis supprimé"})
    //     } else {
    //         res.json({ return: false, error: "Echec de la suppression"})
    //     }
    // } catch (error) {
    //     console.error('Erreur de Suppression')
    //     res.json({ result: false, error: "Echec de la suppression. Veuillez réessayer"})
    // }

});

module.exports = router;