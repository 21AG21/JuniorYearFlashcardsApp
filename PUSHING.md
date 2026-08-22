# Deploying

The app lives on Vercel:

Every push to `main` deploys — the GitHub integration builds nothing, serves
this folder statically, and runs `api/state.js` as the account API on the
same origin (https://myfleshcards.vercel.app). Push with `git push` as usual.
