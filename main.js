/* Chess replayer component
----------------------------------------------------------------------------- */
import {Chess} from './dependencies/chess.mjs/src/Chess.js';
import {Chessboard, FEN, COLOR} from
  './dependencies/cm-chessboard/src/Chessboard.js';

// Constants you can change
const ANIMATION_DURATION = 250;
const PLAYBACK_INTERVAL = 500; // Waiting time between animations
const ICONS_PATH = 'icons.svg';

const pgnInputView = document.getElementById('pgn-input-view');
const replayerView = document.getElementById('replayer-view');
const pgnInput = document.getElementById('pgn-input');
const pgnError = document.getElementById('pgn-error');
const loadPgnButton = document.getElementById('load-pgn');
const newPgnButton = document.getElementById('new-pgn');
const nightModeToggle = document.getElementById('night-mode-toggle');
const nightModeMoon = document.getElementById('night-mode-moon');
const nightModeSun = document.getElementById('night-mode-sun');
const NIGHT_MODE_STORAGE_KEY = 'nightMode';

let chessReplayer;
let startingPositionOnly;
let chessReplayerBoard;

let chessReplayerControls = null;
let firstButton = null;
let prevButton = null;
let playButton = null;
let nextButton = null;
let lastButton = null;

// Generate UI through JavaScript
function createUI() {
  chessReplayer = document.querySelector('.chess-replayer');
  startingPositionOnly = chessReplayer.hasAttribute('data-start');
  chessReplayer.replaceChildren();

  // Create board element
  chessReplayerBoard = document.createElement('div');
  chessReplayerBoard.classList.add('chess-replayer-board');
  chessReplayer.append(chessReplayerBoard);

  // Only create controls if not in start-only mode
  if (startingPositionOnly) return;

  chessReplayerControls = document.createElement('div');
  chessReplayerControls.className = 'chess-replayer-controls';

  const className = 'chess-replayer-button';

  firstButton = createIconButton({
    iconName: 'backward-fast',
    ariaLabel: 'First',
    viewBox: '0 0 512 512',
    className: className
  });

  prevButton = createIconButton({
    iconName: 'backward-step',
    ariaLabel: 'Previous',
    viewBox: '0 0 320 512',
    className: className
  });

  playButton = createIconButton({
    iconName: 'play',
    ariaLabel: 'Play/pause',
    viewBox: '0 0 384 512',
    className: className
  });

  nextButton = createIconButton({
    iconName: 'forward-step',
    ariaLabel: 'Next',
    viewBox: '0 0 320 512',
    className: className
  });

  lastButton = createIconButton({
    iconName: 'forward-fast',
    ariaLabel: 'Last',
    viewBox: '0 0 512 512',
    className: className
  });

  chessReplayerControls.append(firstButton);
  chessReplayerControls.append(prevButton);
  chessReplayerControls.append(playButton);
  chessReplayerControls.append(nextButton);
  chessReplayerControls.append(lastButton);

  chessReplayer.append(chessReplayerControls);
}

// Create and return a button containing an SVG icon
function createIconButton({
  iconName,
  ariaLabel,
  viewBox = '0 0 512 512',
  className
}) {
  // Create button element
  const button = document.createElement('button');

  // Set attributes
  button.type = 'button';
  button.ariaLabel = ariaLabel;
  if (className) button.className = className;

  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  // Set attributes
  svg.setAttribute('viewBox', viewBox);
  svg.ariaHidden = 'true';

  // Create the `<use>` element
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');

  // Set the attribute
  use.setAttribute('href', `${ICONS_PATH}#${iconName}`);

  // Assemble the elements
  svg.append(use);
  button.append(svg);

  return button;
}

// Add event listeners for navigation
function addNavigation() {
  // Only if not in start-only mode
  if (startingPositionOnly) return;

  firstButton.addEventListener('click', showFirstMove);
  prevButton.addEventListener('click', showPreviousMove);
  playButton.addEventListener('click', togglePlayPause);
  nextButton.addEventListener('click', showNextMove);
  lastButton.addEventListener('click', showLastMove);
}

// Add keyboard navigation
function addKeyboardNavigation() {
  // Only if not in start-only mode
  if (startingPositionOnly) return;

  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(event) {
  if (replayerView.hidden) return;

  // Ignore if typing in an input field
  if (event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA') {
    return;
  }

  switch(event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      showPreviousMove();
      break;
    case 'ArrowRight':
      event.preventDefault();
      showNextMove();
      break;
    case 'Home':
      event.preventDefault();
      showFirstMove();
      break;
    case 'End':
      event.preventDefault();
      showLastMove();
      break;
    case ' ':
      event.preventDefault();
      togglePlayPause();
      break;
  }
}

function showInputView() {
  pausePlayback();
  replayerView.hidden = true;
  pgnInputView.hidden = false;
  pgnInput.focus();
}

function showReplayerView() {
  pgnInputView.hidden = true;
  replayerView.hidden = false;
}

function showPgnError(message) {
  pgnError.textContent = message;
  pgnError.hidden = false;
}

function clearPgnError() {
  pgnError.textContent = '';
  pgnError.hidden = true;
}

function setNightMode(enabled) {
  document.body.classList.toggle('nightMode', enabled);
  nightModeToggle.setAttribute('aria-pressed', String(enabled));
  nightModeToggle.setAttribute(
    'aria-label', enabled ? 'Disable night mode' : 'Enable night mode');
  nightModeMoon.hidden = enabled;
  nightModeSun.hidden = !enabled;
  localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
}

function initNightMode() {
  setNightMode(localStorage.getItem(NIGHT_MODE_STORAGE_KEY) === '1');
  nightModeToggle.addEventListener('click', () => {
    setNightMode(!document.body.classList.contains('nightMode'));
  });
}

let gameHistory = null;
let moveTimestamps = null; // Think times in deciseconds, one per half-move

// Extract Chess.com-style [%timestamp N] annotations from PGN text.
// N is think time in deciseconds (tenths of a second).
function extractMoveTimestamps(pgnText) {
  const timestamps = [];
  const regex = /\[%timestamp\s+(\d+)\]/g;
  let match;
  while ((match = regex.exec(pgnText)) !== null) {
    timestamps.push(Number(match[1]));
  }
  return timestamps.length > 0 ? timestamps : null;
}

// Delay in ms before showing the move at gameHistory[moveIndex].
function getDelayBeforeMove(moveIndex) {
  if (moveTimestamps && moveIndex > 0) {
    const timestamp = moveTimestamps[moveIndex - 1];
    if (timestamp != null) {
      return timestamp * 100; // deciseconds to milliseconds
    }
  }
  return playbackInterval;
}

// Parse PGN text, get move history and starting position
function parsePGN(pgnText) {
  const chess = new Chess();
  moveTimestamps = extractMoveTimestamps(pgnText);

  try {
    chess.load_pgn(pgnText);

    const pgnData = {};
    // Check for custom starting position
    const headers = chess.header();
    pgnData.startingPosition = headers.FEN;

    if (pgnData.startingPosition) {
      // Set orientation based on whose turn it is
      pgnData.boardOrientation =
        getOrientationFromFEN(pgnData.startingPosition);
    } else {
      pgnData.startingPosition = FEN.start;
      pgnData.boardOrientation = COLOR.white;
    }

    // Store game history for navigation only if controls are shown
    if (!startingPositionOnly) {
      gameHistory = [];
      // Our game history is going to consist of all positions in the game
      gameHistory.push(pgnData.startingPosition);

      const moveHistory = chess.history();
      chess.load(pgnData.startingPosition);
      // Play through all moves and store positions
      moveHistory.forEach(move => {
        chess.move(move);
        gameHistory.push(chess.fen());
      });
    }

    return pgnData;
  } catch (error) {
    console.error('Error parsing PGN:', error);
    return null;
  }
}

// Determine board orientation from FEN string
function getOrientationFromFEN(fen) {
  // FEN format: position activeColor castling enPassant halfmove fullmove
  const fenParts = fen.split(' ');
  const activeColor = fenParts[1];

  // Show board from perspective of player who moves first
  return activeColor === 'w' ? COLOR.white : COLOR.black;
}

let chessboard = null;

// Initialize the chessboard
function initializeBoard(position, orientation) {
  if (chessboard) {
    chessboard.destroy();
  }

  chessboard = new Chessboard(chessReplayerBoard, {
    assetsUrl: './dependencies/cm-chessboard/assets/',
    position: position,
    orientation: orientation,
    style: {
      cssClass: 'default-contrast',
      pieces: {file: 'pieces/staunty.svg'},
      animationDuration: ANIMATION_DURATION,
    },
  });

  if (!startingPositionOnly) updateButtonStates();
}

let currentMoveIndex = 0;
let isPlaying = false;

// Update button states based on current position
function updateButtonStates() {
  const atStart = currentMoveIndex === 0;
  const atEnd = currentMoveIndex === gameHistory.length - 1;

  if (isPlaying) {
    // During playback, disable all other buttons
    firstButton.disabled = true;
    prevButton.disabled = true;
    nextButton.disabled = true;
    lastButton.disabled = true;
    updateButtonState(playButton, 'pause', '0 0 320 512');
  } else {
    firstButton.disabled = atStart;
    prevButton.disabled = atStart;
    nextButton.disabled = atEnd;
    lastButton.disabled = atEnd;
    updateButtonState(playButton, 'play', '0 0 384 512');
  }
}

// Update button icon
function updateButtonState(button, iconName, viewBox = '0 0 512 512') {
  const svg = button.querySelector('svg');
  if (svg) svg.setAttribute('viewBox', viewBox);

  const use = svg.querySelector('use');
  if (use) use.setAttribute('href', `${ICONS_PATH}#${iconName}`);
}

// Show next move
function showNextMove() {
  if (currentMoveIndex < gameHistory.length - 1) {
    currentMoveIndex++;
    // animation = true
    chessboard.setPosition(gameHistory[currentMoveIndex], true);
    updateButtonStates();
  }
}

// Show previous move
function showPreviousMove() {
  if (currentMoveIndex > 0) {
    currentMoveIndex--;
    chessboard.setPosition(gameHistory[currentMoveIndex], true);
    updateButtonStates();
  }
}

// Show last move
function showLastMove() {
  if (currentMoveIndex < gameHistory.length - 1) {
    currentMoveIndex = gameHistory.length - 1;
    chessboard.setPosition(gameHistory[currentMoveIndex], true);
    updateButtonStates();
  }
}

// Show first move (starting position)
function showFirstMove() {
  if (currentMoveIndex > 0) {
    currentMoveIndex = 0;
    chessboard.setPosition(gameHistory[currentMoveIndex], true);
    updateButtonStates();
  }
}

// Toggle play/pause
function togglePlayPause() {
  if (isPlaying) pausePlayback();
  else startPlayback();
}

const playbackInterval = PLAYBACK_INTERVAL + ANIMATION_DURATION;
let playbackTimeout = null; // Timer ID returned by setTimeout()

// Start automatic playback
function startPlayback() {
  isPlaying = true;

  // If at the end, start from beginning
  if (currentMoveIndex >= gameHistory.length - 1) {
    currentMoveIndex = 0;
    chessboard.setPosition(gameHistory[currentMoveIndex], true);
    updateButtonStates();
    playbackTimeout = setTimeout(playNextMove, getDelayBeforeMove(1));
  } else {
    playbackTimeout = setTimeout(
      playNextMove, getDelayBeforeMove(currentMoveIndex + 1));
  }
}

// Play a single move, schedule the next one or automatically pause
function playNextMove() {
  currentMoveIndex++;
  chessboard.setPosition(gameHistory[currentMoveIndex], true);
  updateButtonStates();

  if (currentMoveIndex < gameHistory.length - 1) {
    playbackTimeout = setTimeout(
      playNextMove, getDelayBeforeMove(currentMoveIndex + 1));
  } else {
    setTimeout(() => {
      isPlaying = false;
      updateButtonStates();
    }, ANIMATION_DURATION);
  }
}

// Pause playback manually
function pausePlayback() {
  isPlaying = false;

  // The playback was manually interrupted, so there is a scheduled timeout
  clearTimeout(playbackTimeout);
  playbackTimeout = null;

  if (chessboard && !startingPositionOnly) updateButtonStates();
}

function loadGame(pgnText) {
  clearPgnError();
  pausePlayback();
  currentMoveIndex = 0;

  const pgnData = parsePGN(pgnText);
  if (!pgnData) {
    showPgnError('Could not parse the PGN. Check the format and try again.');
    return;
  }

  initializeBoard(pgnData.startingPosition, pgnData.boardOrientation);
  showReplayerView();
}

function handleLoadPgn() {
  const pgnText = pgnInput.value.trim();
  if (!pgnText) {
    showPgnError('Paste a PGN before loading.');
    pgnInput.focus();
    return;
  }

  loadGame(pgnText);
}

createUI();
addNavigation();
addKeyboardNavigation();
initNightMode();

loadPgnButton.addEventListener('click', handleLoadPgn);
newPgnButton.addEventListener('click', showInputView);

pgnInput.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    handleLoadPgn();
  }
});
