require('dotenv').config();
var express = require('express');
var app = express(); 
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const placieRouter = require('./routes/placie');
require('./models/connection');
const mongoose = require('mongoose');
const googleAPIRouter = require('./routes/API_GOOGLE');

const cors = require('cors');
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', googleAPIRouter); 
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/placies', placieRouter);

module.exports = app;