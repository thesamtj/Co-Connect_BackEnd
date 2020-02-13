const functions = require("firebase-functions");
const app = require("express")();
const { getAllScreams, postOneScream } = require("./handlers/screams");
const { signup, login, uploadImage, addUserDetails } = require("./handlers/users");
const FBAuth = require("./util/fbAuth");

// Scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, postOneScream);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);


// Users routes
app.post("/signup", signup);
app.post("/login", login);


// https://baseurls.com/api/
exports.api = functions.region("europe-west1").https.onRequest(app);
