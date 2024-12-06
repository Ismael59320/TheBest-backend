var express = require("express");
var router = express.Router();
const Placie = require('../models/placie');

const MongoURL = process.env.MongoURL;

router.get('/', (req, res) => {
    Placie.find()
    .then(data => {
      res.json({placies: data})
    })
  });


module.exports = router;
