var express = require("express");
var router = express.Router();
const Place = require('../models/place');

const MongoURL = process.env.MongoURL;

router.get('/', (req, res) => {
    Place.find()
    .then(data => {
      res.json({places: data})
    })
  });


module.exports = router;
