var express = require("express");
var router = express.Router();
const Place = require('../models/place');
require('dotenv').config()


const MongoURL = process.env.MongoURL;
const KEY_API_APIFY = process.env.KEY_API_APIFY

router.get('/', (req, res) => {
    Place.find()
    .then(data => {
      res.json({places: data})
    })
  });





module.exports = router;
