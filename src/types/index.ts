export type GamePhase = "setup" | "title" | "round-start" | "race" | "bid" | "final" | "standings" | "game-end";

// race: all players, first to buzz names the song; the top two advance
// bid: the two remaining players bid down how few notes they need (notes are played live)
// final: the winner alone, 30 seconds for 7 songs
export type RoundId = "race" | "bid" | "final";

export const PLAYER_COUNT = 4;

export const DEFAULT_PLAYER_NAMES: string[] = Array.from({ length: PLAYER_COUNT }, (_, i) => `Гравець ${i + 1}`);

export const ROUND_TITLES: Record<RoundId, { label: string; name: string }> = {
  race: { label: "Раунд 1", name: "Наввипередки" },
  bid: { label: "Раунд 2", name: "10 нот" },
  final: { label: "Фінал", name: "7 мелодій за 30 секунд" },
};

export interface Song {
  name: string;
  artist: string;
  minus?: string; // instrumental the players guess from
  plus?: string; // full track, played once the answer is revealed
}

export interface RaceTheme {
  title: string;
  song?: Song; // tiles without a song are shown locked
}

export interface BidSong {
  clue: string; // the host reads it before the bidding starts
  song: Song;
}

export interface RoundPlayer {
  index: number; // into GameState.playerNames / scores
  name: string;
}

export interface FinalResult {
  guessed: number;
  total: number;
  outcome: "won" | "wrong" | "timeout";
}

export interface GameState {
  phase: GamePhase;
  round: RoundId;
  playerNames: string[]; // entered on the setup screen, defaults when left blank
  active: number[]; // indices into playerNames of who plays the current round
  scores: number[]; // per player, for the current round only; reset when a round starts
  finalResult: FinalResult | null;
}
