export type GamePhase =
  | "setup"
  | "title"
  | "round-start"
  | "quiz"
  | "race"
  | "bid"
  | "final"
  | "standings"
  | "game-end";

// each round sends one player home: 4 -> 3 -> 2 -> 1
// quiz: all four pick the song out of three options on their phones; the top three advance
// race: first to buzz names the song; the top two advance
// bid: the two remaining players bid down how few notes they need (notes are played live)
// final: the winner alone, against the clock
export type RoundId = "quiz" | "race" | "bid" | "final";

export const PLAYER_COUNT = 4;

export const DEFAULT_PLAYER_NAMES: string[] = Array.from({ length: PLAYER_COUNT }, (_, i) => `Гравець ${i + 1}`);

export const ROUND_ORDER: RoundId[] = ["quiz", "race", "bid", "final"];

// how many players are still in when the round begins
export const ROUND_PLAYERS: Record<RoundId, number> = { quiz: 4, race: 3, bid: 2, final: 1 };

export const ROUND_TITLES: Record<RoundId, { label: string; name: string }> = {
  quiz: { label: "Розминка", name: "Три варіанти" },
  race: { label: "Раунд 1", name: "Наввипередки" },
  bid: { label: "Раунд 2", name: "10 нот" },
  final: { label: "Фінал", name: "Сім мелодій" },
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

export interface QuizSong {
  song: Song;
  options: string[]; // shown on the phones and on screen
  correct: number; // index into options
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
  scores: number[]; // per player; quiz points stay in the quiz, race points carry over into the bid round
  roundStartScores: number[]; // scores as the current round began, restored when the round is replayed
  finalResult: FinalResult | null;
}
