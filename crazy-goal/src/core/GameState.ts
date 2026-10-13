/**
 * menu    title card over the live arena
 * ready   ball is on its spot, waiting for a drag
 * aiming  the player is pulling back
 * flight  the ball is loose
 * goal    scored: celebration and score card
 * missed  the ball died somewhere else: a beat of feedback, then straight back to ready
 * replay  duel only: watching the opponent's recorded shot at your goal
 */
export type GameState = 'menu' | 'ready' | 'aiming' | 'flight' | 'goal' | 'missed' | 'replay';
