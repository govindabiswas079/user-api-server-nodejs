/*

Copyright (c) 2019 - present AppSeed.us

*/
const express = require('express');
const Joi = require('joi');
// eslint-disable-next-line new-cap
const router = express.Router();
const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const config = require('../config/keys');
const User = require('../models/user');
const ActiveSession = require('../models/activeSession');
const checkToken = require('../config/safeRoutes').checkToken;
const { smtpConf } = require('../config/config');

// Route: <HOST>:PORT/api/users/

const userSchema = Joi.object().keys({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(4).max(15).optional(),
    password: Joi.string().required()
});

router.post('/register', (req, res) => {

    // Joy Validation
    const result = userSchema.validate(req.body);
    if (result.error) {
        res.status(422).json({
            success: false,
            msg: 'Validation err: ' + result.error.details[0].message
        });
        return;
    }

    const { username, email, password } = req.body;

    User.findOne({ email: email }).then((user) => {

        if (user) {

            res.json({ success: false, msg: 'Email already exists' });

        } else {
            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(password, salt, null, (err, hash) => {
                    if (err) throw err;
                    const query = {
                        username: username,
                        email: email,
                        password: hash
                    };
                    User.create(query, function (err, user) {
                        if (err) throw err;

                        // eslint-disable-next-line max-len
                        res.json({ success: true, userID: user._id, msg: 'The user was succesfully registered' });
                    });
                });
            });
        }
    });
});

router.post('/login', (req, res) => {

    // Joy Validation
    const result = userSchema.validate(req.body);
    if (result.error) {
        res.status(422).json({
            success: false,
            msg: 'Validation err: ' + result.error.details[0].message
        });
        return;
    }

    const email = req.body.email;
    const password = req.body.password;

    User.findOne({ email: email }, (err, user) => {
        if (err) throw err;

        if (!user) {
            return res.json({ success: false, msg: 'Wrong credentials' });
        }

        bcrypt.compare(password, user.password, function (err, isMatch) {
            if (isMatch) {
                const token = jwt.sign(user, config.secret, {
                    expiresIn: 86400, // 1 week
                });

                const query = { userId: user._id, token: token };
                ActiveSession.create(query, function (err, cd) {

                    // Delete the password (hash)
                    user.password = null;
                    return res.json({
                        success: true,
                        token: token,
                        user,
                    });
                });
            } else {
                return res.json({ success: false, msg: 'Wrong credentials' });
            }
        });
    });
});

router.post('/logout', checkToken, function (req, res) {
    const token = req.body.token;
    ActiveSession.deleteMany({ token: token }, function (err, item) {
        if (err) {
            res.json({ success: false });
        }
        res.json({ success: true });
    });
});

router.post('/checkSession', checkToken, function (req, res) {
    res.json({ success: true });
});

router.post('/all', checkToken, function (req, res) {
    User.find({}, function (err, users) {
        if (err) {
            res.json({ success: false });
        }
        users = users.map(function (item) {
            const x = item;
            x.password = undefined;
            x.__v = undefined;
            return x;
        });
        res.json({ success: true, users: users });
    });
});

router.post('/edit', checkToken, function (req, res) {
    const { userID, username, email } = req.body;

    User.find({ _id: userID }).then((user) => {
        if (user.length == 1) {
            const query = { _id: user[0]._id };
            const newvalues = { $set: { username: username, email: email } };
            User.updateOne(query, newvalues, function (err, cb) {
                if (err) {
                    // eslint-disable-next-line max-len
                    res.json({ success: false, msg: 'There was an error. Please contract the administator' });
                }
                res.json({ success: true });
            });
        } else {
            res.json({ success: false });
        }
    });
});

module.exports = router;