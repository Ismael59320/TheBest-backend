require("dotenv").config();
require("./models/connection");

var express = require("express");
var app = express();
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var usersRouter = require("./routes/users");
const placeRouter = require("./routes/place");
const googleAPIRouter = require("./routes/API_GOOGLE");

const cors = require("cors");

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", googleAPIRouter);
app.use("/users", usersRouter);
app.use("/places", placeRouter);

module.exports = app;
