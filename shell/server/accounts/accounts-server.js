// Thurly - Personal Cloud Sandbox
// Copyright (c) 2015 Thurly Development Group, Inc. and contributors
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

import { Accounts } from "meteor/accounts-base";
import { fetchPicture, userPictureUrl } from "/imports/server/accounts/picture.js";

const Crypto = Npm.require("crypto");
const Future = Npm.require("fibers/future");

const ValidHandle = Match.Where(function (handle) {
  check(handle, String);
  return !!handle.match(/^[a-z_][a-z0-9_]*$/);
});

Accounts.onCreateUser(function (options, user) {
  if (user.loginIdentities) {
    // it's an account
    check(user, { _id: String,
                  createdAt: Date,
                  isAdmin: Match.Optional(Boolean),
                  hasCompletedSignup: Match.Optional(Boolean),
                  signupKey: Match.Optional(String),
                  signupNote: Match.Optional(String),
                  signupEmail: Match.Optional(String),
                  expires: Match.Optional(Date),
                  appDemoId: Match.Optional(String),
                  loginIdentities: [{ id: String }],
                  nonloginIdentities: [{ id: String }], });

    if (globalDb.isReferralEnabled()) {
      user.experiments = user.experiments || {};
      user.experiments = {
        freeGrainLimit: Math.random() < 0.1 ? 100 : "control",
      };
      if (!("expires" in user)) {
        globalDb.sendReferralProgramNotification(user._id);
      }
    }

    globalDb.preinstallAppsForUser(user._id);

    return user;
  }

  if (globalDb.getOrganizationDisallowGuests() &&
      !globalDb.isIdentityInOrganization(user)) {
    throw new Meteor.Error(400, "User not in organization.");
  }

  // Check profile.
  if (options.profile) {
    // TODO(cleanup): This check also appears in accounts-ui-methods.js.
    check(options.profile, Match.ObjectIncluding({
      name: Match.OneOf(null, Match.Optional(String)),
      handle: Match.Optional(ValidHandle),
      pronoun: Match.Optional(Match.OneOf("male", "female", "neutral", "robot")),
    }));
  }

  check(options.unverifiedEmail, Match.Optional(String));

  if (options.unverifiedEmail) {
    user.unverifiedEmail = options.unverifiedEmail;
  }

  user.profile = _.pick(options.profile || {}, "name", "handle", "pronoun");

  // Try downloading avatar.
  const url = userPictureUrl(user);
  if (url) {
    const assetId = fetchPicture(globalDb, url);
    if (assetId) {
      user.profile.picture = assetId;
    }
  }

  let serviceUserId;
  if (user.services && user.services.dev) {
    check(user.services.dev, { name: String, isAdmin: Boolean, hasCompletedSignup: Boolean });
    serviceUserId = user.services.dev.name;
    user.profile.service = "dev";
  } else if ("expires" in user) {
    serviceUserId = user._id;
    user.profile.service = "demo";
  } else if (user.services && user.services.email) {
    check(user.services.email, {
      email: String,
      tokens: [
        {
          digest: String,
          algorithm: String,
          createdAt: Date,
          secureBox: Match.Optional({
            version: Number,
            salt: String,
            iv: String,
            boxedValue: String,
          }),
        },
      ],
    });
    serviceUserId = user.services.email.email;
    user.profile.service = "email";
  } else if (user.services && "google" in user.services) {
    serviceUserId = user.services.google.id;
    user.profile.service = "google";
  } else if (user.services && "github" in user.services) {
    serviceUserId = user.services.github.id;
    user.profile.service = "github";
  } else if (user.services && "ldap" in user.services) {
    serviceUserId = user.services.ldap.id;
    user.profile.service = "ldap";
  } else if (user.services && "saml" in user.services) {
    serviceUserId = user.services.saml.id;
    user.profile.service = "saml";
  } else {
    throw new Meteor.Error(400, "user does not have a recognized identity provider: " +
                           JSON.stringify(user));
  }

  user._id = Crypto.createHash("sha256")
    .update(user.profile.service + ":" + serviceUserId).digest("hex");

  return user;
});

Accounts.validateLoginAttempt(function (attempt) {
  if (!attempt.allowed) {
    return false;
  }

  const db = attempt.connection.sandstormDb;
  const user = attempt.user;

  if (user.suspended && user.suspended.admin) {
    throw new Meteor.Error(403, "User has been suspended. Please contact the administrator " +
      "of this server if you believe this to be in error.");
  }

  if (user.loginIdentities) {
    // it's an account
    if (db.getOrganizationDisallowGuests() &&
        !db.isUserInOrganization(user)) {
      throw new Meteor.Error(403, "User not in organization.");
    }

    db.updateUserQuota(user); // This is a no-op if settings aren't enabled
  } else {
    if (db.getOrganizationDisallowGuests() &&
        !db.isIdentityInOrganization(user)) {
      throw new Meteor.Error(403, "User not in organization.");
    }
  }

  return true;
});
