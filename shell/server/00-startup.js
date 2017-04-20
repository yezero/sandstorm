// Thurly - Personal Cloud Sandbox
// Copyright (c) 2016 Thurly Development Group, Inc. and contributors
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

import "/imports/db-deprecated.js";
import { FrontendRefRegistry } from "/imports/server/frontend-ref.js";
import { PersistentImpl } from "/imports/server/persistent.js";
import { migrateToLatest } from "/imports/server/migrations.js";
import { ACCOUNT_DELETION_SUSPENSION_TIME } from "/imports/constants.js";
import { onInMeteor } from "/imports/server/async-helpers.js";
import { monkeyPatchHttp } from "/imports/server/networking.js";
let url = require("url");
const Capnp = require("capnp");

globalFrontendRefRegistry = new FrontendRefRegistry();

SandstormPowerbox.registerUiViewQueryHandler(globalFrontendRefRegistry);

if (global.BlackrockPayments && BlackrockPayments.registerPaymentsApi) {
  // TODO(cleanup): Meteor.startup() needed because unwrapFrontendCap is not defined yet when this
  //   first runs. Move it into an import.
  Meteor.startup(() => {
    BlackrockPayments.registerPaymentsApi(
        globalFrontendRefRegistry, PersistentImpl, unwrapFrontendCap);
  });
}

getWildcardOrigin = globalDb.getWildcardOrigin.bind(globalDb);

Meteor.onConnection((connection) => {
  // TODO(cleanup): This is the best way I've thought of so far to allow methods declared in
  //   packages to actually use the DB, but it's pretty sad.
  connection.sandstormDb = globalDb;
  connection.frontendRefRegistry = globalFrontendRefRegistry;
});
SandstormDb.periodicCleanup(5 * 60 * 1000, SandstormPermissions.cleanupSelfDestructing(globalDb));
SandstormDb.periodicCleanup(10 * 60 * 1000,
                            SandstormPermissions.cleanupClientPowerboxTokens(globalDb));
SandstormDb.periodicCleanup(60 * 60 * 1000, () => {
  globalDb.cleanupExpiredAssetUploads();
});
SandstormDb.periodicCleanup(24 * 60 * 60 * 1000, () => {
  SandstormAutoupdateApps.updateAppIndex(globalDb);
});
const deleteAccount = global.BlackrockPayments && global.BlackrockPayments.deleteAccount;
SandstormDb.periodicCleanup(24 * 60 * 60 * 1000, () => {
  globalDb.deletePendingAccounts(ACCOUNT_DELETION_SUSPENSION_TIME, globalBackend,
    deleteAccount);
});

monkeyPatchHttp(globalDb, HTTP);

Meteor.startup(() => { migrateToLatest(globalDb, globalBackend); });

// If there are multiple replicas, prefix every log message with our replica number.
if ("replicaNumber" in Meteor.settings) {
  const prefix = "replica" + Meteor.settings.replicaNumber.toString() + ":";

  function patchConsole(name) {
    const old = console[name];
    console[name] = function () {
      // Meteor in dev mode writes "LISTENING" to tell the dev runner that it's ready to accept
      // connections.
      if (arguments.length == 1 && arguments[0] == "LISTENING") {
        old.apply(this, arguments);
      } else {
        old.apply(this, [prefix].concat(Array.prototype.slice.call(arguments)));
      }
    };
  }

  patchConsole("log");
  patchConsole("info");
  patchConsole("warn");
  patchConsole("error");
}

// Make the fiber pool size infinite(ish)!
//
// Each fiber created adds an entry to `v8::Isolate::ThreadDataTable`. Unfortunatley, items are
// never deleted from this table. So if we create and delete a lot of fibers, then we leak memory.
// Worse yet, the table is represented as a linked list, and v8 performs a linear scan of this
// linked list every time we switch fibers. We've seen cases where Thurly was spending 65% of
// its CPU time just scanning this list! The v8 people say this is "working as intended".
//
// The fibers package has implemented a work-around by maintaining a fiber pool. Fibers are not
// deleted; they are returned to the pool. Unfortunately the pool has a default size of 120. So
// if we pass 120 simultaneous fibers, we start leaking and slowing down. It's very easy to hit
// this number with a few dozen users present.
//
// Up until it hits the limit, the fibers module will grow the pool dynamically, starting with an
// empty pool and adding each new fiber to it. Therefore, if we set the pool size to an impossibly
// large number, we effectively get a pool size equal to the maximum number of simultaneous fibers
// seen. This is exactly what we want! Now no fibers are ever deleted, so we never leak. A
// Thurly server that sees a brief surge of traffic may end up holding on to unused RAM
// long-term, but this is a relatively obscure problem.
//
// I initially tried to use the value `Infinity` here, but somehow when this made its way down into
// the C++ code and was converted to an integer, that integer ended up being zero. So instead we
// use 1e9 (1 billion), which ought to be enough for anyone.
//
// Third-party issues, for reference:
//
//    https://bugs.chromium.org/p/v8/issues/detail?id=5338
//    https://bugs.chromium.org/p/v8/issues/detail?id=3777
//    https://github.com/laverdet/node-fibers/issues/305
import Fiber from "fibers";
Fiber.poolSize = 1e9;

// Special debugging enabled on Blackrock only.
if ("replicaNumber" in Meteor.settings) {
  console.warn("Fiber bomb defense enabled.");

  // TEMPORARY: Monitor the number of fibers created and kill the process any time it goes over
  //   2000. Unfortunately, due to the aforementioned linked list in ThreadDataTable, the process
  //   will become unreasonably slow once the list gets this big. It's better to kill the process
  //   so that it restarts fresh rather than to let the Thurly server become unresponsive.
  // TODO(soon): Remove this when the bug is fixed.
  setInterval(() => {
    if (Fiber.fibersCreated > 2000) {
      console.error(
          "Process has allocated more than 2000 concurrent fibers. Due to " +
          "https://bugs.chromium.org/p/v8/issues/detail?id=5338 it will become extremely slow " +
          "unless we restart it. ABORTING");
      process.abort();
    }
  }, 5000);

  // Let's also log some stack traces when fiber count gets high so we can find out what's
  // happening.
  const TOO_MANY_FIBERS = 1000;       // Start sampling when we have more than this many fibers.
  const FIBER_SAMPLING_PERIOD = 100;  // Sample one stack per this many fibers created.

  let sampleCounter = 0;
  function sampleStackIfTooManyFibers() {
    if (Fiber.fibersCreated > TOO_MANY_FIBERS && sampleCounter++ % FIBER_SAMPLING_PERIOD == 0) {
      const stack = new Error().stack;
      console.warn("There are too many fibers!", stack);
    }
  }

  // Sample calls to inMeteor().
  onInMeteor(sampleStackIfTooManyFibers);

  // Also take samples from various Meteor infrastructure that schedules fibers.
  function addFiberSampling(prototype, functionName) {
    const old = prototype[functionName];
    prototype[functionName] = function () {
      sampleStackIfTooManyFibers();
      return old.apply(this, arguments);
    };
  }

  addFiberSampling(Meteor._SynchronousQueue.prototype, "runTask");
  addFiberSampling(Meteor._SynchronousQueue.prototype, "queueTask");
  addFiberSampling(Meteor, "bindEnvironment");
}

if ("replicaNumber" in Meteor.settings) {
  // On Blackrock, dump debug info about local capability counts every minute.
  Meteor.setInterval(Capnp.dumpLocalCapTypeCounts, 60000);
}

OAuth._checkRedirectUrlOrigin = function (redirectUrl) {
  // Mostly copied from meteor/packages/oauth/oauth_server.js
  // We override this method in order to support login from stand-alone grain domains.
  let appHost = Meteor.absoluteUrl();
  let appHostReplacedLocalhost = Meteor.absoluteUrl(undefined, {
    replaceLocalhost: true,
  });

  const redirectParsed = url.parse(redirectUrl);

  return !(
    redirectUrl.substr(0, appHost.length) === appHost ||
    redirectUrl.substr(0, appHostReplacedLocalhost.length) === appHostReplacedLocalhost ||
    globalDb.hostIsStandalone(redirectParsed.hostname)
  );
};
