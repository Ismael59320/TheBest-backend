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

module.exports = router;