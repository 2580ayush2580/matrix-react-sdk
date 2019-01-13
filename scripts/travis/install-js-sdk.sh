#!/bin/bash

set -ev

reactsdk=$(pwd)

pushd "$HOME/build"
$reactsdk/scripts/fetchdep.sh matrix-org matrix-js-sdk
cd matrix-js-sdk
npm install
popd
