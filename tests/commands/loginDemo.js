// Thurly - Personal Cloud Sandbox
// Copyright (c) 2014 Thurly Development Group, Inc. and contributors
// All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

var utils = require('../utils'),
    short_wait = utils.short_wait,
    medium_wait = utils.medium_wait;

exports.command = function(callback) {
  var ret = this
    .url(this.launchUrl + "/demo")
    .execute('window.Meteor.logout()')
    .pause(short_wait)
    .waitForElementVisible(".demo-startup-modal .start", medium_wait)
    .click(".demo-startup-modal .start")
    .url(this.launch_url + "/apps")
    .waitForElementVisible('.app-list', medium_wait)
    .resizeWindow(utils.default_width, utils.default_height);

  this.sandstormAccount = 'demo';
  if (typeof callback === "function") {
    return ret.status(callback);
  } else {
    return ret;
  }
};
