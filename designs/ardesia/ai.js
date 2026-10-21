// Runs the engine's search off the main thread, so dragging, animations and
// the clocks stay smooth while the AI thinks.
importScripts("game.js");

onmessage = (e) => {
  const { id, fen, level, seed } = e.data;
  postMessage({ id, move: Ardesia.bestMove(new Ardesia.Chess(fen), level, Ardesia.rng(seed)) });
};
