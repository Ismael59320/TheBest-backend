var express = require("express");
var router = express.Router();
const User = require('../models/user')
const Review = require('../models/review')

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

// router.get("/:place_id", (req,res) => {
//     const place_id = req.params.place_id
//     const review = Review.find(req.params.place_id)

//     if (review) {
//         res.json({result : true, review})
//     } else {
//         res.json({result: false})
//     }
//     // Review.find({place_id: req.body.place_id}).then((data) => {

        

//     //     const formattedReviews = data.map(review => ({
//     //         user: review.user,
//     //         place_id: review.place_id,
//     //         rating: review.rating,
//     //         username: review.username,
//     //         text: review.text,
//     //         photo: review.photo,
//     //         created: review.created
//     //     }))

//     //     res.json({result: true, formattedReviews})
//     // })
// })

router.get("/:place_id", async (req, res) => {
    try {
        const place_id = req.params.place_id;

        // Recherche des reviews correspondant au place_id
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

module.exports = router;