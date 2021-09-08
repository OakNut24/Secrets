//jshint esversion:6
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


//The session settings
//app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: process.env.CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {} //secrue = If we want to access the site over HTTP - Need to set it to {} if we want to redirect after successfuly registering 
}))


app.use(passport.initialize()); //Start using passport for authentication 
app.use(passport.session()); //Using passport to manage our session 



mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy()); //Create a local login strategy

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id, username: profile.id }, function(err, user) { //We are adding the username to store the profle.id as well because the MongoDB by default sets the username field as unique.Therefore, if we won't set it as profile.id it will be set as null and we won't be able to save multiple accounts.
            return cb(err, user);
        });
    }
));




app.get("/", function(req, res) {
    res.render("home");
});


//Redirect the user to the Google Sign In menu
app.get("/auth/google",
    passport.authenticate('google', { scope: ['profile'] })
);


//After login successfuly to Google -> Check if the user is registered
app.get("/auth/google/secrets",
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

app.get("/login", function(req, res) {
    res.render("login");
});
app.get("/logout", function(req, res) {
    req.logout(); //PassportJS functions - It logs out the user
    res.redirect("/");
});




app.get("/register", function(req, res) {
    res.render("register");
});
app.get("/secrets", function(req, res) {
    User.find({ "secret": { $ne: null } }, function(err, foundUsers) { //Get all the users with secret NotEquel to null
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) { //If the foundUsers not equal to null
                res.render("secrets", { usersWithSecrets: foundUsers }); //Send all the users with secrets to the secrets.ejs
            } else {
                console.log("No secrets found");
            }
        }
    });
});

app.route("/submit")
    .get(function(req, res) {
        if (req.isAuthenticated()) {
            res.render("submit");
        } else {
            res.redirect("/login");
        }
    })
    .post(function(req, res) {
        const submittedSecret = req.body.secret; //Gets the input text named "secret"
        console.log(req.user); //The PassportJS make sure that with every GET/POST request the req had the current user details.
        User.findById(req.user.id, function(err, foundUser) { //Find the user by id
            if (err) {
                console.log(err); //Show an error if user not found - Meaning he is logged in but does not exsit in the database
            } else {
                if (foundUser) { // If the user exist and found in the database
                    foundUser.secret = submittedSecret; //Set the found user's secert to the new one 
                    foundUser.save(function() { //Save the new secret and only redirect when the save is finished
                        res.redirect("/secrets");
                    })
                }
            }
        })

    });




app.post("/register", function(req, res) {

    User.register({ username: req.body.username }, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            response.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("secrets");
            });
        }
    });



});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) { //A method inside PassportJS which handles the login of the user - It reauires the exact User object we created
        if (err) { //The same names !!! 
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(err) { //When arriving here it means that PassportJS has checked if the user with this credentials exist  
                if (err) {
                    console.log(err);
                } else {
                    res.redirect("secrets");
                }
            });
        }
    })

});



app.listen("3000", function() {
    console.log("Port 3000");
});