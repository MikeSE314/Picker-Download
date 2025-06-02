// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

import bodyParser from 'body-parser';
import express from 'express';
import fetch from 'node-fetch';
import http from 'http';

import passport from 'passport';
import { Strategy } from 'passport-google-oauth2'

import persist from 'node-persist';
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import ejs from 'ejs';
import stream from 'stream';
import { v4 as uuidv4 } from 'uuid';

import path from 'path';
import promisify from 'util';
import fs from 'fs';
import sqlite3 from 'sqlite3';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mkdir = promisify.promisify(fs.mkdir);
const writeFile = promisify.promisify(fs.writeFile);

import { auth } from './auth.js';
import { config } from './config.cjs';


if (config.oAuthClientID == "ADD YOUR CLIENT ID" || config.oAuthclientSecret == "ADD YOUR CLIENT SECRET") {
  throw new Error('Add your oAuthClientID and oAuthclientSecret in config.cjs');
}


import { fileURLToPath } from 'url';

const app = express();
const fileStore = sessionFileStore(session);
const server = http.Server(app);
import axios from 'axios'


// Use the EJS template engine
app.set('view engine', 'ejs');
app.engine('ejs', ejs.__express);

// Disable browser-side caching for demo purposes.
app.disable('etag');

const sessionCache = persist.create({
  dir: 'persist-session/',
  ttl: 1740000,  // 29 minutes
});
sessionCache.init();


// // optional: use a media items cache to save local copies of shown images
// //           need to set and retrieve images from this cache to use
// const mediaItemsCache = persist.create({
//   dir: 'persist-media-items/',
//   ttl: 3300000,  // 55 minutes
// });
// mediaItemsCache.init();


// Set up OAuth 2.0 authentication through the passport.js library.
auth(passport);

// Set up a session middleware to handle user sessions.
// NOTE: A secret is used to sign the cookie. This is just used for this sample
// app and should be changed.
const sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  store: new fileStore({}),
  secret: config.session_secret, // CHANGE THIS IN config.cjs
});

// Set up static routes for hosted libraries.
app.use(express.static('static'));
app.use('/js',
  express.static(
    fileURLToPath(
      new URL('./node_modules/jquery/dist/', import.meta.url)
    ),
  )
);

// Parse application/json request data.
app.use(bodyParser.json());

// Parse application/xwww-form-urlencoded request data.
app.use(bodyParser.urlencoded({ extended: true }));

// Enable user session handling.
app.use(sessionMiddleware);

// Set up passport and session handling.
app.use(passport.initialize());
app.use(passport.session());

// Middleware that adds the user of this session as a local variable,
// so it can be displayed on all pages when logged in.
app.use((req, res, next) => {
  res.locals.name = '-';
  if (req.user && req.user.profile && req.user.profile.name) {
    res.locals.name =
      req.user.profile.name.givenName || req.user.profile.displayName;
  }

  res.locals.avatarUrl = '';
  if (req.user && req.user.profile && req.user.profile.photos) {
    res.locals.avatarUrl = req.user.profile.photos[0].value;
  }
  next();
});



const createNewSession = async (req, res) => {
  const response = fetch("https://photospicker.googleapis.com/v1/sessions", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + req.user.token
    },
    json: true
  }).then((response) => response.json())
    .then((responseData) => {
      sessionCache.setItem(req.user.profile.id, responseData)
      res.render('pages/picker', { session: responseData });
    })
}


// GET request to the root.
// Display the login screen if the user is not logged in yet, otherwise the
// photo frame.
app.get('/', async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    // Not logged in yet.
    res.render('pages/login');
  } else {

    let session = await sessionCache.getItem(req.user.profile.id)
    if (!session) {
      createNewSession(req, res)
    } else {
      res.render('pages/picker', { session: session });
    }

  }
});


app.get('/list', async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    // Not logged in yet.
    res.render('pages/login');
  } else {

    let session = await sessionCache.getItem(req.user.profile.id)
    if (!session) {
      res.render('pages/login');
    } else {
      res.render('pages/list', { session: session });
    }

  }
});


app.get('/new_session', async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    // Not logged in yet.
    res.render('pages/login');
  } else {

    let session = await sessionCache.getItem(req.user.profile.id)
    createNewSession(req, res)

  }
});


app.get('/cloud_error', async (req, res) => {
  res.render('pages/cloud_error');
});


app.get("/get_session", async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    // Not logged in yet.
    res.send({ "auth-error": "not authenticated" })
    return
  }

  const session = await sessionCache.getItem(req.user.profile.id)
  if (!session.id) {
    res.send({ "auth-error": "not authenticated" })
    return
  }

  const session_url = "https://photospicker.googleapis.com/v1/sessions/"


  const response = fetch(session_url + session.id, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + req.user.token
    },
    json: true
  }).then((response) => response.json())
    .then((responseData) => {

      sessionCache.setItem(req.user.profile.id, responseData)
      res.send(responseData)

    })

})


app.get("/fetch_images", async (req, res) => {

  const session = await sessionCache.getItem(req.user.profile.id)

  const pageSize = 25 // user definable; default up to 100

  let itemsQuery = `sessionId=${session.id}&pageSize=${pageSize}`
  if ("pageToken" in req.query) {
    itemsQuery += `&pageToken=${req.query['pageToken']}`
  }

  const response = fetch(`https://photospicker.googleapis.com/v1/mediaItems?${itemsQuery}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + req.user.token
    },
    json: true
  }).then((response) => response.json())
    .then((responseData) => {

      downloadMediaItems(responseData.mediaItems, req.user);

      res.send({ "images": responseData })

    })

})

async function downloadMediaItems(mediaItems, user) {
  const dbPath = path.join(config.download_directory, 'downloaded.sqlite');
  await mkdir(path.dirname(dbPath), { recursive: true });

  const db = new sqlite3.Database(dbPath);
  await new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS downloaded_files (
        id TEXT PRIMARY KEY,
        status INTEGER
      )`, (err) =>
      err ? reject(err) : resolve()
    );
  });

  for (const item of mediaItems) {
    const id = item.id;

    const status = await new Promise((resolve, reject) => {
      db.get(`SELECT status FROM downloaded_files WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.status : 0);
      });
    });

    if (status === 2 || status === 1) continue;

    await new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO downloaded_files (id, status) VALUES (?, 1)`, [id], (err) =>
        err ? reject(err) : resolve()
      );
    });

    try {
      await downloadMediaFile(item.mediaFile, user, db, id);
    } catch (err) {
      console.error(`Failed to download ${item.mediaFile.filename}: ${err.message}`);
    }
  }

  db.close();
}

async function downloadMediaFile(mediaFile, user, db, id) {
  console.info("Downloading file", downloadMediaFile);
  const folder = path.join(config.download_directory, user.profile.sub);
  await mkdir(folder, { recursive: true });

  const filePath = path.join(folder, mediaFile.filename);
  const url = `${mediaFile.baseUrl}=d`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${user.token}` }
  });

  if (!res.ok) throw new Error(`Failed to download ${mediaFile.filename}: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  await writeFile(filePath, Buffer.from(buffer));

  await new Promise((resolve, reject) => {
    db.run(`UPDATE downloaded_files SET status = 2 WHERE id = ?`, [id], (err) =>
      err ? reject(err) : resolve()
    );
  });
}

app.get("/clear_incomplete", async (req, res) => {
  const dbPath = path.join(__dirname, 'downloads', 'downloaded.sqlite');
  const db = new sqlite3.Database(dbPath);
  db.run(`DELETE FROM downloaded_files WHERE status = 1`, (err) => {
    if (err) console.error('Cleanup failed:', err.message);
    db.close();
  });
  res.send('OK; <a href="http://localhost:8080/list">return to list</a>?');
});



app.post("/image", async (req, res) => {
  const baseUrl = req.body.baseUrl

  fetch(baseUrl, {
    method: 'GET',
    headers: new Headers({
      'Authorization': `Bearer ${req.user.token}`,
    }),
  }).then((response) => {

    // if response is 403 here, then baseurl could be invalid,
    // or it's been > 7 days and the baseurl is expired.

    response.arrayBuffer().then(buf => {
      const bytes = new Uint8Array(buf)

      const readStream = new stream.PassThrough();
      readStream.end(bytes);
      res.set("Content-disposition", response.headers['content-disposition']);
      res.set("Content-Type", response.headers['content-type']);
      readStream.pipe(res);
    })

  })

})




app.post("/video", async (req, res) => {
  const baseUrl = req.body.baseUrl + "=dv"

  fetch(baseUrl, {
    method: 'GET',
    headers: new Headers({
      'Authorization': `Bearer ${req.user.token}`,
    }),
  }).then((response) => {

    // if response is 403 here, then baseurl could be invalid,
    // or it's been > 7 days and the baseurl is expired.

    response.arrayBuffer().then(buf => {
      const bytes = new Uint8Array(buf)

      const readStream = new stream.PassThrough();
      readStream.end(bytes);
      res.set("Content-disposition", response.headers['content-disposition']);
      res.set("Content-Type", response.headers['content-type']);
      readStream.pipe(res);
    })

  })

})



// GET request to log out the user.
// Destroy the current session and redirect back to the log in screen.
app.get('/disconnect', async (req, res) => {
  if (req.user && req.isAuthenticated()) {
    // remove current session if it exists
    await sessionCache.removeItem(req.user.profile.id)
  }

  req.logout(function (err) {
    if (err) {
      console.log("ERROR on disconnect", err)
    } else {
      req.session.destroy();
      res.redirect('/');
    }
  });
});


const strategy = new Strategy({
  clientID: config.oAuthClientID,
  clientSecret: config.oAuthclientSecret,
  callbackURL: config.oAuthCallbackUrl,
  passReqToCallback: true
},
  function (request, accessToken, refreshToken, profile, done) {
    // Callback takes: error, user_object
    return done(null, {
      profile: profile,
      token: accessToken
    })
  }
)

passport.use("google", strategy);


app.get('/auth/google',
  passport.authenticate('google', {
    scope: config.scopes
  }
  ));

app.get('/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/'
  }));


// Start the server
server.listen(config.port, () => {
  console.log(`App listening on port ${config.port}`);
  console.log('Press Ctrl+C to quit.');
});


// Renders the given page if the user is authenticated.
// Otherwise, redirects to "/".
function renderIfAuthenticated(req, res, page) {
  if (!req.user || !req.isAuthenticated()) {
    res.redirect('/');
  } else {
    res.render(page);
  }
}

// Responds with an error status code and the encapsulated data.error.
function returnError(res, data) {
  // Return the same status code that was returned in the error or use 500
  // otherwise.
  const statusCode = data.error.status || 500;
  // Return the error.
  res.status(statusCode).send(JSON.stringify(data.error));
}

// Return the body as JSON if the request was successful, or thrown a StatusError.
async function checkStatus(response) {
  if (!response.ok) {
    // Throw a StatusError if a non-OK HTTP status was returned.
    let message = "";
    try {
      // Try to parse the response body as JSON, in case the server returned a useful response.
      message = await response.json();
    } catch (err) {
      // Ignore if no JSON payload was retrieved and use the status text instead.
    }
    throw new StatusError(response.status, response.statusText, message);
  }

  // If the HTTP status is OK, return the body as JSON.
  return await response.json();
}

// Custom error that contains a status, title and a server message.
class StatusError extends Error {
  constructor(status, title, serverMessage, ...params) {
    super(...params)
    this.status = status;
    this.statusTitle = title;
    this.serverMessage = serverMessage;
  }
}





