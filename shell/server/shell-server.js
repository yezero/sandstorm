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

// Set up browser policy.
//
// Note that by default (when the browser-policy package is added), Content-Security-Policy will
// already be set to same-origin-only for everything except XHR and WebSocket. Eval is disabled,
// but inline script are enabled.
//
// TODO(security): Consider disallowing inline scripts. Currently this forces Meteor to do an
//   extra round trip on startup to fetch server settings. That seems like something that could
//   be fixed in Meteor (e.g. embed the settings as JSON text rather than script). Startup time
//   is incredibly important, and Meteor's templating system (which we use to render all our
//   HTML) already does a good job of protecting us from script injection, so right now I think
//   we should favor avoiding the round trip.
//
// TODO(someday): Detect when an app tries to navigate off-site using CSP's violation reporting
//   feature. Ask the user whether they want to open the link in a new tab. This is an annoying
//   prompt, but if we just open the tab directly then apps can trivially leak by opening tabs
//   with encoded URLs to an evil server. Although, this attack would be very detectable to the
//   user, so maybe it's not a big deal...

import { inMeteor } from "/imports/server/async-helpers.js";

BrowserPolicy.framing.disallow();  // Disallow framing of the UI.
Meteor.startup(() => {
  const frameSetter = () => {
    BrowserPolicy.content.disallowFrame(); // This clears all the old rules
    BrowserPolicy.content.allowFrameOrigin(getWildcardOrigin());
    const billingPromptUrl = globalDb.getBillingPromptUrl();
    if (billingPromptUrl) {
      BrowserPolicy.content.allowFrameOrigin(billingPromptUrl);
    }
  };

  frameSetter(); // Call once on startup
  globalDb.collections.settings.find({ _id: "billingPromptUrl" }).observe({
    added: frameSetter,
    changed: frameSetter,
    removed: frameSetter,
  });
});

// Allow anything to be loaded from the static asset host.
import { staticAssetHost } from "/imports/server/constants.js";
BrowserPolicy.content.allowImageOrigin(staticAssetHost);
BrowserPolicy.content.allowScriptOrigin(staticAssetHost);
BrowserPolicy.content.allowFontOrigin(staticAssetHost);
BrowserPolicy.content.allowConnectOrigin(staticAssetHost);
BrowserPolicy.content.allowConnectOrigin("wss:");
BrowserPolicy.content.allowConnectOrigin("ws:");

Meteor.publish("grainsMenu", function () {
  if (this.userId) {
    if (globalDb.isQuotaEnabled()) {
      // Hack: Fire off an asynchronous update to the user's storage usage whenever they open the
      //   front page.
      // TODO(someday): Implement the ability to reactively subscribe to storage usage from the
      //   back-end?
      const userId = this.userId;
      globalBackend.cap().getUserStorageUsage(userId).then(function (results) {
        inMeteor(function () {
          Meteor.users.update(userId, { $set: { storageUsage: parseInt(results.size) } });
        });
      }).catch(function (err) {
        if (err.kjType === "unimplemented") {
          // Compute based on sum of grain sizes instead.
          let total = 0;
          Grains.find({ userId: userId }, { fields: { size: 1 } })
              .forEach(grain => total += (grain.size || 0));
          Meteor.users.update(userId, { $set: { storageUsage: total } });
        } else {
          console.error(err.stack);
        }
      });
    }

    const identityIds = SandstormDb.getUserIdentityIds(globalDb.getUser(this.userId));
    return [
      UserActions.find({ userId: this.userId }),
      Grains.find({ userId: this.userId }),
      ApiTokens.find({ "owner.user.identityId": { $in: identityIds } }),
    ];
  } else {
    return [];
  }
});

Meteor.publish("sessions", function (sessionId) {
  // sessionId itself should be secret enough, but they are also not meant to be shared, so as
  // a backup we only publish the session to its owner. Note that `userId` can be null if the
  // user is not logged in or is using incognito mode.
  check(sessionId, String);

  // We exclude powerboxRequest because the client already has the descriptor list in packed
  // format, and the parsed format can be kind of large.
  return Sessions.find({ _id: sessionId, $or: [{ userId: this.userId }, { userId: null }] },
      { fields: { powerboxRequest: 0 } });
});

Meteor.publish("devPackages", function () {
  return DevPackages.find();
});

Meteor.publish("hasUsers", function () {
  // Publish pseudo-collection which tells the client if there are any users at all.
  //
  // TODO(cleanup):  This seems overcomplicated.  Does Meteor have a better way?
  const cursor = Meteor.users.find();
  if (cursor.count() > 0) {
    this.added("hasUsers", "hasUsers", { hasUsers: true });
  } else {
    let handle = cursor.observeChanges({
      added: (id) => {
        this.added("hasUsers", "hasUsers", { hasUsers: true });
        handle.stop();
        handle = null;
      },
    });
    this.onStop(function () {
      if (handle) handle.stop();
    });
  }

  this.ready();
});

Meteor.publish("referralInfoPseudo", function () {
  // This publishes a pseudo-collection called referralInfo whose documents have the following
  // form:
  //
  // - id: (String) same as the User._id of an identity this user has referred
  // - name: (String) the profile.name from that identity
  // - completed: (Boolean) if this referral is complete

  //  If the user is not logged in, then we have no referralInfo.
  if (!this.userId) {
    return [];
  }

  // Implementation note:
  //
  // This pseudo-collection is populated very differently for (1) the completed: false case versus
  // the (2) completed: true case.

  // Case 1. Publish information about not-yet-complete referrals.
  const notCompletedReferralIdentitiesCursor = Meteor.users.find({
    referredBy: this.userId,
    "profile.name": { $exists: true },
  }, {
    fields: {
      _id: 1,
      referredBy: 1,
      "profile.name": 1,
    },
  });
  const notCompletedReferralIdentitiesHandle = notCompletedReferralIdentitiesCursor.observeChanges({
    // The added function gets called with the id of Bob when Alice refers Bob.
    added: (id, fields) => {
      this.added("referralInfo", id, { name: fields.profile.name, completed: false });
    },
    // The removed function gets called when Bob is no longer an uncompleted referral.  Note that
    // this will get more complicated once we support sending completed referrals to the client.
    removed: (id) => {
      this.removed("referralInfo", id);
    },
    // The modified function gets called when Bob's profile.name changed.
    modified: (id, fields) => {
      this.modified("referralInfo", id, { name: fields.profile.name, completed: false });
    },
  });

  // Case 2. Handle completed referrals.
  //
  // - Do a query for the current list of completed identities.
  //
  // - Every time we see a new such identity, we create a query that watches that one identity in
  //   case its profile.name changes.
  //
  // - Also watch the first query, since the list of completed identities might change.
  const handleForProfileNameByIdentityId = {};
  const stopWatchingAllIdentities = () => {
    Object.keys(handleForProfileNameByIdentityId).forEach((identityId) => {
      stopWatchingIdentity(identityId);
    });
  };

  const stopWatchingIdentity = (identityId) => {
    const handleForProfileName = handleForProfileNameByIdentityId[identityId];
    if (handleForProfileName) {
      this.removed("referralInfo", identityId);
      handleForProfileName.stop();
      // delete is safe because we iterate across `Object.keys()` which returns a copy.
      delete handleForProfileNameByIdentityId[identityId];
    }
  };

  const watchIdentityAndPublishReferralSuccess = (identityId) => {
    let handleForProfileName = handleForProfileNameByIdentityId[identityId];
    if (handleForProfileName) {
      return;
    }

    handleForProfileName = Meteor.users.find({
      _id: identityId,
    }, {
      fields: {
        "profile.name": 1,
      },
    }).observeChanges({
      added: (id, fields) => {
        this.added("referralInfo", id, { name: fields.profile.name, completed: true });
      },

      changed: (id, fields) => {
        this.changed("referralInfo", id, { name: fields.profile.name, completed: true });
      },

      removed: (id) => {
        stopWatchingIdentity(id);
      },
    });

    handleForProfileNameByIdentityId[identityId] = handleForProfileName;
  };

  const completedIdentityIdsHandle = Meteor.users.find({
    _id: this.userId,
    referredIdentityIds: { $exists: true },
  }, {
    fields: {
      referredIdentityIds: true,
    },
  }).observeChanges({
    // `added` gets called when a user gets their first completed referral.
    added: (id, fields) => {
      for (let i = 0; i < fields.referredIdentityIds.length; i++) {
        // Unconditionally mark these as successful referrals and start watching.
        watchIdentityAndPublishReferralSuccess(
          fields.referredIdentityIds[i]);
      }
    },
    // `changed` gets called when a user adds/removes referredIdentityIds, usually when a
    // referral becomes complete.
    changed: (id, fields) => {
      // Two major tasks.
      //
      // 1. Look for identityIds to unsubscribe from & send removed notices to the client.
      //
      // 2. Look for identityIds to subscribe to.

      // Task 1. Unsubscribe where needed.
      const referredIdentityIdsAsObject = {};
      fields.referredIdentityIds.forEach((i) => { referredIdentityIdsAsObject[i] = true; });

      Object.keys(handleForProfileNameByIdentityId).forEach((identityId) => {
        // If the handle doesn't show up in the new list of referredIdentityIds, then remove
        // info from the client & stop it on the server & make it null.
        const handleForProfileName = handleForProfileNameByIdentityId[identityId];
        if (referredIdentityIdsAsObject.hasOwnProperty(identityId)) {
          stopWatchingIdentity(identityId);
        }
      });

      // Task 2. Subscribe where needed.
      for (let i = 0; i < fields.referredIdentityIds.length; i++) {
        // The watch... function will avoid double-creating subscriptions, so this is safe.
        watchIdentityAndPublishReferralSuccess(fields.referredIdentityIds[i]);
      }
    },
    // `removed` gets called when a User suddenly has no referredIdentityIds.
    removed: () => {
      // Remove all data from client; stop all handles.
      stopWatchingAllIdentities();
    },
  });

  // With cases 1 and 2 handled, register a cleanup function, then declare victory.
  this.onStop(() => {
    stopWatchingAllIdentities();
    notCompletedReferralIdentitiesHandle.stop();
    completedIdentityIdsHandle.stop();
  });

  this.ready();
});

Meteor.publish("backers", function () {
  const backers = Assets.getText("backers.txt");
  let anonCount = 0;
  let counter = 0;

  backers.split("\n").forEach((name) => {
    name = name.trim();
    if (name === "") {
      ++anonCount;
    } else {
      this.added("backers", counter++, { name: name });
    }
  });

  // Text file ends in \n but that shouldn't count.
  --anonCount;

  this.added("backers", "anonymous", { count: anonCount - 1 });

  this.ready();
});
