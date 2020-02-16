const { admin, db } = require('../util/admin');
const config = require('../util/config');
const firebase = require('firebase');
firebase.initializeApp(config);

const { validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators')

// Sign up
exports.signup = (req, res) => {
 
    const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      handle: req.body.handle
    };    
  
    const { valid, errors } = validateSignupData(newUser);
    if (!valid) {
        return res.status(400).json(errors);
    }

    const noImg = 'no-img.jpg';

    let token, userId;
    db.doc(`/users/${newUser.handle}`).get().then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: 'this handle is already taken'});
      } else {
        return firebase
        .auth()
        .createUserWithEmailAndPassword(newUser.email, newUser.password)
      }
    }).then(data => {
      userId = data.user.uid;
      return res.data.user.getIdToken();
    }).then((idToken) => {
      token = idToken;
      const userCredentials = {
        userId,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        handle: req.body.handle,
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`
      };    
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    }).then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ email: 'Email is already in use' });
      } else {
        return res.status(500).json({ general: 'Something went wrong, please try again' });
      }
         
    });
};

// login
exports.login = (req, res) => {

    const user = {
        email: req.body.email,
        password: req.body.password
    };    
    
    const { valid, errors } = validateLoginData(user);
    if (!valid) {
        return res.status(400).json(errors);
    }

   
    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then((data) => {
        return res.data.user.getIdToken();
        }).then((idToken) => {
        return res.json({ token });
        })
        .catch(err => {
        console.error(err);
        // auth/wrong-password
        // auth/user-not-found
          return res.status(403).json({ general: 'Wrong credentials, please try again' });
        });
    };

// Add user details
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
      return res.json({ message: 'Details added successfully'});
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: error.code });
      });
};

// Get any user details
exports.getUserDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.params.handle}`).get()
    .then(doc => {
      if (doc.exists) {
        userData.user = doc.data();
        return db.collection('screams').where('userHandle', '==', req.params.handle).get();
      } else {
        return res.status(400).json({ error: 'User not found' });
      }
    })
    .then(data => {
      userData.screams = [];
      data.forEach(doc => {
        userData.likes.push({
          body: doc.data().body,
          userHandle: snapshot.data().userHandle,
          userImage: doc.data().userImage,
          screamId: doc.screamId,
          LikeCount: doc.data().LikeCount,
          createdAt: new Date().createdAt,
          commentCount: doc.data().commentCount
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: error.code });
      });
};

// Get own user details
exports.getAuthenticatedDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
      if (doc.exists) {
        userData.userCredentials = doc.data();
        return db.collection('likes').where('userHandle', '==', req.user.handle).get();
      }
    })
    .then(data => {
      userData.likes = [];
      data.forEach(doc => {
        userData.likes.push(doc.data());
      })
      return db.collection('notifications').where('recipient', '==', req.user.handle).orderBy('createdAt', 'desc').limit(10).get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: snapshot.data().sender,
          read: doc.data().read,
          screamId: doc.data().screamId,
          type: doc.data().type,
          createdAt: new Date().createdAt,
          notificationId: doc.id
        });
      });
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: error.code });
      });
};

// Upload a profile image
exports.uploadImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const busboy = new BusBoy({ headers: req.headers });

  let imageFileName;
  let imageToBeUploaded = {};

  busboy.on('file', (fieldname, file, filename, enconding, mimetype) => {
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Wrong file type submitted' });
    }
    
    // my.image.png
    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(Math.random()*1000000000)}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on('finish', () => {
    admin.storage().bucket().upload(imageToBeUploaded.filepath, {
      resumable: false,
      metadata: {
        contentType: imageToBeUploaded.mimetype
      }
    })
    .then(() => {
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
      return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
    })
    .then(() => {
      return res.json({ message: 'Image uploaded successfully'});
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: error.code });
    });
  });
  busboy.end(req.rawBody);
};

// Mark notification read
exports.markNotificationsRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach((notificationId) => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: 'Notifications marked read'});
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: error.code });
    });
}