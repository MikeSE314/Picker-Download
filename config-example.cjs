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

// This file contains the configuration options for this sample app.

let config = {}



///////////////////////////////
// CHANGE THESE oAuth VALUES //
///////////////////////////////

// The OAuth client ID from the Google Developers console.
config.oAuthClientID = 'FILL ME';

// The OAuth client secret from the Google Developers console.
config.oAuthclientSecret = 'FILL ME';

// A browser secret to store the session
// only need to update this before pushing to production
config.session_secret = 'PICKER_API_SESSION_SECRET'



///////////////////////////////
// OPTIONAL values to change //
///////////////////////////////

// The callback to use for OAuth requests. This is the URL where the app is
// running. For testing and running it locally, use 127.0.0.1.
config.oAuthCallbackUrl = 'http://localhost:8080/auth/google/callback';

// The port where the app should listen for requests.
config.port = 8080;

// The scopes to request.
config.scopes = [
  "profile",
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
];



// Use config-test.cjs instead of config.cjs if you'd like to 
// ignore config-test.cjs in source control, so it does not
// accidentally get checked in.
try {
  // Don't check config-test.cjs into source control
  config = require("./config-test.cjs").config
} catch (e) {
  // no override
}

// yo!
config.download_directory = "FILL ME";
config.https = false;


exports.config = config



