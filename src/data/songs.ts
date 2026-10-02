import type { BidSong, RaceTheme, Song } from "../types";

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

export const RACE_POINTS = 10;
export const BID_POINTS = 20;
export const BID_START = 10;
export const FINAL_SECONDS = 30;

// 8 tiles, laid out in two columns
export const RACE_THEMES: RaceTheme[] = [
  { title: "Барна карта", song: PINA_COLADA },
  { title: "На куражі" },
  { title: "Дорогоцінне каміння", song: EMERALD_SKY },
  { title: "Ані стоячи, ані лежачи" },
  { title: "Зроби голосніше", song: TURN_IT_UP },
  { title: "Дівчата таких люблять" },
  { title: "З Новим роком", song: HAPPIEST_YEAR },
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
