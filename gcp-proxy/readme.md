# chess.com CORS proxy

A minimal Google Cloud Function that fetches chess.com's live game callback
endpoint server-side and returns it with CORS headers, since chess.com's
endpoint sends none and can't be called directly from a browser.

## Deploy

Requires the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and a
GCP project with the Cloud Functions and Cloud Build APIs enabled.

```sh
cd gcp-proxy
gcloud functions deploy chessComProxy \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=chessComProxy \
  --trigger-http \
  --allow-unauthenticated
```

The command prints a URL like:

```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/chessComProxy
```

## Use

```
GET https://us-central1-YOUR_PROJECT.cloudfunctions.net/chessComProxy?gameId=170527589924
```

Returns the same JSON chess.com's callback endpoint returns, with
`Access-Control-Allow-Origin: *` added.

## Wire it up to the replayer

Set `CHESS_PROXY_BASE_URL` in `main.js` to your deployed function's URL.
