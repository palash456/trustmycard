#!/bin/sh
set -eu

# Safe size trims for Next.js standalone output — does not remove runtime code.
find . -type f -name '*.map' -delete
