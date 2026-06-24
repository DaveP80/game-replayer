// Google Cloud Function (HTTP trigger) that proxies chess.com's live game
// callback endpoint, since that endpoint sends no CORS headers and can't be
// fetched directly from a browser.
//
// Deploy with (Node 18+ runtime):
//   gcloud functions deploy chessComProxy \
//     --gen2 \
//     --runtime=nodejs20 \
//     --region=us-east1 \
//     --source=. \
//     --entry-point=chessComProxy \
//     --trigger-http \
//     --allow-unauthenticated
//
// Then call it as:
//   https://YOUR_FUNCTION_URL?gameId=835527639924

const ALLOWED_ORIGIN = '*';
const GAME_ID_PATTERN = /^\d+$/;

exports.chessComProxy = async (req, res) => {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const gameId = req.query.gameId;
  if (!gameId || !GAME_ID_PATTERN.test(gameId)) {
    res.status(400).json({error: 'Missing or invalid "gameId" query param.'});
    return;
  }

  try {
    const chessComResponse = await fetch(
      `https://www.chess.com/callback/live/game/${gameId}`);

    if (!chessComResponse.ok) {
      res.status(chessComResponse.status).json({
        error: `chess.com responded with status ${chessComResponse.status}`,
      });
      return;
    }

    const data = await chessComResponse.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching chess.com game:', error);
    res.status(502).json({error: 'Failed to fetch game data from chess.com.'});
  }
};
