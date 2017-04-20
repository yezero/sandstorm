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

import { SANDSTORM_ALTHOME } from "/imports/server/constants.js";
import { inMeteor, promiseToFuture, waitPromise } from "/imports/server/async-helpers.js";

const Capnp = Npm.require("capnp");
const Backend = Capnp.importSystem("sandstorm/backend.capnp").Backend;
const Crypto = Npm.require("crypto");

let storageUsageUnimplemented = false;

function generateSessionId(grainId, userId, packageSalt, clientSalt) {
  const sessionParts = [grainId, clientSalt];
  if (userId) {
    sessionParts.push(userId);
  }

  if (packageSalt) {
    sessionParts.push(packageSalt);
  }

  const sessionInput = sessionParts.join(":");
  return Crypto.createHash("sha256").update(sessionInput).digest("hex");
}

const shouldRestartGrain = (error, retryCount) => {
  // Given an error thrown by an RPC call to a grain, return whether or not it makes sense to try
  // to restart the grain and retry. `retryCount` is the number of times that the request has
  // already gone through this cycle (should be zero for the first call).
  return error.kjType === "disconnected" && retryCount < 1;
};

class SandstormBackend {
  constructor(db, backendCap) {
    this._db = db;
    this._backendCap = backendCap;
  }

  cap() {
    return this._backendCap;
  }

  deleteUser(userId) {
    return waitPromise(this._backendCap.deleteUser(userId));
  }

  shutdownGrain(grainId, ownerId, keepSessions) {
    if (!keepSessions) {
      Sessions.remove({ grainId: grainId });
    }

    const grain = this._backendCap.getGrain(ownerId, grainId).supervisor;
    return grain.shutdown().then(function () {
      grain.close();
      throw new Error("expected shutdown() to throw disconnected");
    }, function (err) {

      grain.close();
      if (err.kjType !== "disconnected") {
        throw err;
      }
    });
  }

  deleteGrain(grainId, ownerId) {
    // We leave it up to the caller if they want to actually wait, but some don't so we report
    // exceptions.
    return this._backendCap.deleteGrain(ownerId, grainId).catch(function (err) {
      console.error("problem deleting grain " + grainId + ":", err.message);
      throw err;
    });
  }

  maybeRetryUseGrain(grainId, cb, retryCount, err) {
    if (shouldRestartGrain(err, retryCount)) {
      return inMeteor(() => {
        return cb(this.continueGrain(grainId).supervisor)
            .catch(this.maybeRetryUseGrain.bind(this, grainId, cb, retryCount + 1));
      });
    } else {
      throw err;
    }
  }

  useGrain(grainId, cb) {
    // This will open a grain for you, handling restarts if needed, and call the passed function with
    // the supervisor capability as the only parameter. The callback must return a promise that used
    // the supervisor, so that we can check if a disconnect error occurred, and retry if possible.
    // This function returns the same promise that your callback returns.
    //
    // This function is NOT expected to be run in a meteor context.
    return inMeteor(() => {
      return cb(this.continueGrain(grainId).supervisor)
        .catch(this.maybeRetryUseGrain.bind(this, grainId, cb, 0));
    });
  }

  continueGrain(grainId) {
    const grain = Grains.findOne(grainId);
    if (!grain) {
      throw new Meteor.Error(404, "Grain Not Found", "Grain ID: " + grainId);
    }

    // If a DevPackage with the same app ID is currently active, we let it override the installed
    // package, so that the grain runs using the dev app.
    const devPackage = DevPackages.findOne({ appId: grain.appId });
    let isDev;
    let mountProc;
    let pkg;
    if (devPackage) {
      isDev = true;
      pkg = devPackage;
      mountProc = pkg.mountProc;
    } else {
      pkg = Packages.findOne(grain.packageId);
      if (!pkg) {
        throw new Meteor.Error(500, "Grain's package not installed",
                               "Package ID: " + grain.packageId);
      }
    }

    const manifest = pkg.manifest;
    const packageId = pkg._id;

    if (!("continueCommand" in manifest)) {
      throw new Meteor.Error(500, "Package manifest defines no continueCommand.",
                             "Package ID: " + packageId);
    }

    const result = this.startGrainInternal(
        packageId, grainId, grain.userId, manifest.continueCommand, false, isDev, mountProc);
    result.packageSalt = isDev ? pkg._id : grain.packageSalt;
    return result;
  }

  startGrainInternal(packageId, grainId, ownerId, command, isNew, isDev, mountProc) {
    // Starts the grain supervisor.  Must be executed in a Meteor context.  Blocks until grain is
    // started. Returns a promise for an object containing two fields: `owner` (the ID of the owning
    // user) and `supervisor` (the supervisor capability).

    if (isUserExcessivelyOverQuota(Meteor.users.findOne(ownerId))) {
      throw new Meteor.Error(402,
                             ("Cannot start grain because owner's storage is exhausted.\n" +
                              "Please ask them to upgrade."));
    }

    // Ugly: Stay backwards-compatible with old manifests that had "executablePath" and "args" rather
    //   than just "argv".
    if ("args" in command) {
      if (!("argv" in command)) {
        command.argv = command.args;
      }

      delete command.args;
    }

    if ("executablePath" in command) {
      if (!("deprecatedExecutablePath" in command)) {
        command.deprecatedExecutablePath = command.executablePath;
      }

      delete command.executablePath;
    }

    return this._backendCap.startGrain(ownerId, grainId, packageId, command, isNew, isDev, mountProc);
  }

  updateLastActive(grainId, userId, identityId) {
    // Update the lastActive date on the grain, any relevant API tokens, and the user,
    // and also update the user's storage usage.

    let storagePromise = undefined;
    let ownerId = undefined;
    if (this._db.isQuotaEnabled() && !storageUsageUnimplemented) {
      ownerId = Grains.findOne(grainId).userId;
      storagePromise = this._backendCap.getUserStorageUsage(ownerId);
    }

    const now = new Date();
    if (Grains.update(grainId, { $set: { lastUsed: now } }) === 0) {
      // Grain must have been deleted. Ignore.
      return;
    }

    if (userId) {
      Meteor.users.update(userId, { $set: { lastActive: now } });
    }

    if (identityId) {
      Meteor.users.update({ _id: identityId }, { $set: { lastActive: now } });
      // Update any API tokens that match this user/grain pairing as well
      ApiTokens.update({ grainId: grainId, "owner.user.identityId": identityId },
                       { $set: { lastUsed: now } },
                       { multi: true });
    }

    if (storagePromise) {
      try {
        const size = parseInt(waitPromise(storagePromise).size);
        Meteor.users.update(ownerId, { $set: { storageUsage: size } });
        // TODO(security): Consider actively killing grains if the user is excessively over quota?
        //   Otherwise a constantly-active grain could consume arbitrary space without being stopped.
      } catch (err) {
        if (err.kjType === "unimplemented") {
          storageUsageUnimplemented = true;
        } else {
          console.error("error getting user storage usage:", err.stack);
        }
      }
    }
  }

  openSessionInternal(grainId, userId, identityId, title, apiToken, cachedSalt, sessionFields) {
    // Start the grain if it is not running. This is an optimization: if we didn't start it here,
    // it would start on the first request to the session host, but we'd like to get started before
    // the round trip.
    const { supervisor, packageSalt } = this.continueGrain(grainId);

    this.updateLastActive(grainId, userId, identityId);

    cachedSalt = cachedSalt || Random.id(22);
    const sessionId = generateSessionId(grainId, userId, packageSalt, cachedSalt);
    let session = Sessions.findOne({ _id: sessionId });
    if (session) {
      // TODO(someday): also do some more checks for anonymous sessions (sessions without a userId).
      if ((session.identityId && session.identityId !== identityId) ||
          (session.grainId !== grainId)) {
        const e = new Meteor.Error(500, "Duplicate SessionId");
        console.error(e);
        throw e;
      } else {
        return {
          supervisor: supervisor,
          methodResult: {
            sessionId: session._id,
            title: title,
            grainId: grainId,
            hostId: session.hostId,
            tabId: session.tabId,
            salt: cachedSalt,
          },
        };
      }
    }

    // TODO(someday): Allow caller to specify the parent session from which to inherit the tab ID, or
    //   something.

    session = {
      _id: sessionId,
      grainId: grainId,
      hostId: Crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 32),
      tabId: Crypto.createHash("sha256").update("tab:").update(sessionId).digest("hex").slice(0, 32),
      timestamp: new Date().getTime(),
      hasLoaded: false,
    };

    if (userId) {
      session.userId = userId;
    }

    if (identityId) {
      session.identityId = identityId;
    }

    if (apiToken) {
      session.hashedToken = apiToken._id;
    }

    if (sessionFields) {
      _.extend(session, sessionFields);
    }

    Sessions.insert(session);

    return {
      supervisor: supervisor,
      methodResult: {
        sessionId: session._id,
        title: title,
        grainId: grainId,
        hostId: session.hostId,
        tabId: session.tabId,
        salt: cachedSalt,
      },
    };
  }
};

export { SandstormBackend, shouldRestartGrain };
