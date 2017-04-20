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

#include "spk.h"

int main(int argc, char* argv[]) {
  // A stand-alone SPK binary is not shipped in the release but is sometimes useful.

  // TODO(cleanup): Couldn't use KJ_MAIN() because SpkMain is not exposed in the header; have to
  //   call a factory function. Refactor to fix.

  kj::TopLevelProcessContext context(argv[0]);
  auto mainObject = sandstorm::getSpkMain(context);
  return kj::runMainAndExit(context, mainObject->getMain(), argc, argv);
}
