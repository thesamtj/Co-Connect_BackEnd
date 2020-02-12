const functions = require("firebase-functions");
const app = require("express")();
const { getAllScreams, postOneScream } = require("./handlers/screams");
const { signup, login } = require("./handlers/users");
const FBAuth = require("./util/fbAuth");

// Get screams
app.get("/screams", getAllScreams);
// Post one scream
app.post("/scream", FBAuth, postOneScream);

// sign up route
app.post("/signup", signup);
// login route
app.post("/login", login);

// https://baseurls.com/api/
exports.api = functions.region("europe-west1").https.onRequest(app);
