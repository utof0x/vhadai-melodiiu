import type { BidSong, QuizSong, RaceTheme, Song } from "../types";

const base = import.meta.env.BASE_URL;

function track(n: number, name: string, artist: string): Song {
  return { name, artist, minus: `${base}audio/gs-${n}-minus.mp3`, plus: `${base}audio/gs-${n}-plus.mp3` };
}

// MVP placeholders: the audio is borrowed from hto-zverhu, so the same tracks
// show up in more than one round until the real song list is in
const HAPPIEST_YEAR = track(2, "Happiest Year", "Jaymes Young");
const PINA_COLADA = track(3, "Пінаколада", "Віталій Козловський");
const EMERALD_SKY = track(4, "Смарагдове небо", "Drevo");
const TURN_IT_UP = track(5, "Додай гучності", "Jerry Heil");
const VASYLYNA = track(6, "Василина", "DZIDZIO");
const STAR = track(7, "Зірочка палай", "Аня Трінчер");
const MARSHRUTKA = track(8, "Маршрутка", "Скрябін");

export const QUIZ_POINTS = 1;
export const RACE_POINTS = 10;
export const BID_POINTS = 20;
export const BID_START = 10;
export const FINAL_SECONDS = 40;

// warm-up: everyone picks one of three options on their phone
export const QUIZ_SONGS: QuizSong[] = [
  {
    song: HAPPIEST_YEAR,
    options: ["Another Love — Tom Odell", "Happiest Year — Jaymes Young", "Someone You Loved — Lewis Capaldi"],
    correct: 1,
  },
  {
    song: VASYLYNA,
    options: ["Василина — DZIDZIO", "Я і Сара — DZIDZIO", "Обійми — Океан Ельзи"],
    correct: 0,
  },
  {
    song: STAR,
    options: ["Охрана отмєна — Jerry Heil", "Плакала — KAZKA", "Зірочка палай — Аня Трінчер"],
    correct: 2,
  },
  {
    song: MARSHRUTKA,
    options: ["Старі фотографії — Скрябін", "Маршрутка — Скрябін", "Люди як кораблі — Скрябін"],
    correct: 1,
  },
  {
    song: PINA_COLADA,
    options: ["Пінаколада — Віталій Козловський", "Тримай — Христина Соловій", "Вахтерам — Бумбокс"],
    correct: 0,
  },
];

// 8 tiles, laid out in two columns
export const RACE_THEMES: RaceTheme[] = [
  { title: "Барна карта", song: PINA_COLADA },
  { title: "На куражі" },
  { title: "Дорогоцінне каміння", song: EMERALD_SKY },
  { title: "Ані стоячи, ані лежачи" },
  { title: "Зроби голосніше", song: TURN_IT_UP },
  { title: "Дівчата таких люблять" },
  { title: "З Новим роком" },
  { title: "Відчуй мене без слів" },
];

export const BID_SONGS: BidSong[] = [
  { clue: "Жіноче ім’я, яке ведучий справжнього шоу «Вгадай мелодію» виніс у назву свого хіта", song: VASYLYNA },
  { clue: "У назві цієї пісні маленьке небесне світило просять не згасати", song: STAR },
  { clue: "Пісня Скрябіна про транспорт, у якому передають за проїзд", song: MARSHRUTKA },
];

export const FINAL_SONGS: Song[] = [
  PINA_COLADA,
  MARSHRUTKA,
  TURN_IT_UP,
  VASYLYNA,
  HAPPIEST_YEAR,
  STAR,
  EMERALD_SKY,
];
