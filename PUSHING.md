# Deploying

The app lives on Cloudflare, not GitHub Pages:

```
npx wrangler deploy
```

https://cards.betteraeries.workers.dev — app and account API on one origin.
GitHub is just the code host; push with `git push` as usual.
