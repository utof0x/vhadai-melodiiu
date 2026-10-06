import type { Peer } from 'peerjs'
import { PLAYER_COUNT } from './types'

// The game is the host of a buzz-in room: players' phones open the buzz-in page,
// join by the room code and act as buzzers. The message format below is the one
// that page speaks (see ../buzz-in/index.html), extended with `locked`.
const ROOM_PREFIX = 'buzzin-'
const CODE_CHARS = '0123456789' // digits only, to match what the buzz-in page accepts
const CODE_LENGTH = 3
const MAX_ID_ATTEMPTS = 5
const NAME_MAX = 20
const HEARTBEAT_MS = 3000 // how often every phone is re-sent the state, as a sign of life
const PHONE_STALE_MS = 12000 // a phone that pings and then goes quiet this long is treated as gone
const SAVED_CODE_KEY = 'vhadai-room-code'
const SAVED_CODE_ATTEMPTS = 4 // after a reload the old id can stay taken for a moment
const SAVED_CODE_RETRY_MS = 1500

export const BUZZER_URL = 'utof0x.github.io/buzz-in'

// connecting: waiting for the PeerJS broker; open: phones can join; failed: keyboard only
type RoomStatus = 'connecting' | 'open' | 'failed'

// lobby: buttons disabled; armed: first tap wins; buzzed: someone is answering;
// choice: every phone picks one of the options; reveal: the right option and who scored
type BuzzStatus = 'lobby' | 'armed' | 'buzzed' | 'choice' | 'reveal'

// point: right and in time; late: right but the last to answer; wrong; none: never answered
export type ChoiceResult = 'point' | 'late' | 'wrong' | 'none'

export interface BuzzerSnapshot {
  code: string | null
  status: RoomStatus
  names: string[] // per player slot, '' while nobody has typed or joined
  phones: boolean[] // per player slot, whether a phone is connected right now
}

// the one thing the room needs from a connection, so the logic runs without PeerJS in tests
export interface PhoneLink {
  peerId: string
  send: (msg: unknown) => void
  close?: () => void
}

interface Phone {
  link: PhoneLink
  name: string
  joinedAt: number
  slot: number
  deviceId: string | null // stays the same when the phone reconnects under a new peer id
  lastSeen: number
  pings: boolean // older buzz-in pages never ping, so their silence means nothing
}

function genCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}

function loadSavedCode() {
  try {
    const code = localStorage.getItem(SAVED_CODE_KEY)
    return code && /^\d+$/.test(code) && code.length === CODE_LENGTH ? code : null
  } catch {
    return null
  }
}

function saveCode(code: string) {
  try {
    localStorage.setItem(SAVED_CODE_KEY, code)
  } catch {
    // private mode: the code just won't survive a reload
  }
}

function sameName(a: string | null, b: string) {
  return a !== null && a.trim().toLowerCase() === b.toLowerCase()
}

export class BuzzerRoom {
  private connectStarted = false
  private attempts = 0
  private code: string | null = null
  private status: RoomStatus = 'connecting'

  private names: string[] = Array.from({ length: PLAYER_COUNT }, () => '')
  private phoneNames: (string | null)[] = Array.from({ length: PLAYER_COUNT }, () => null) // what each slot's phone typed
  private phones = new Map<string, Phone>() // connected phones by peer id
  private setupOpen = true

  private buzzStatus: BuzzStatus = 'lobby'
  private roundId = 0
  private winner: number | null = null
  private locked: number[] = [] // slots that already missed the current song
  private active: number[] = Array.from({ length: PLAYER_COUNT }, (_, i) => i) // slots still in the game
  private options: string[] = []
  private answers = new Map<number, number>() // slot -> picked option, for the choice on screen
  private correct: number | null = null
  private results = new Map<number, ChoiceResult>()

  private listeners = new Set<() => void>()
  private buzzListeners = new Set<(slot: number) => void>()
  private answerListeners = new Set<(slot: number, option: number) => void>()
  private snapshot: BuzzerSnapshot = this.buildSnapshot()

  // ── React store ──────────────────────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  onBuzz(listener: (slot: number) => void) {
    this.buzzListeners.add(listener)
    return () => {
      this.buzzListeners.delete(listener)
    }
  }

  onAnswer(listener: (slot: number, option: number) => void) {
    this.answerListeners.add(listener)
    return () => {
      this.answerListeners.delete(listener)
    }
  }

  private buildSnapshot(): BuzzerSnapshot {
    return {
      code: this.code,
      status: this.status,
      names: [...this.names],
      phones: this.names.map((_, slot) => this.phoneAt(slot) !== undefined),
    }
  }

  private emit() {
    this.snapshot = this.buildSnapshot()
    for (const listener of this.listeners) listener()
  }

  private phoneAt(slot: number) {
    for (const phone of this.phones.values()) if (phone.slot === slot) return phone
    return undefined
  }

  // ── Setup ────────────────────────────────────────────
  setName(slot: number, name: string) {
    this.names[slot] = name.slice(0, NAME_MAX)
    this.emit()
    this.broadcast()
  }

  // while the setup screen is up a joining phone names its slot; afterwards
  // the names are fixed and a phone only attaches to one
  setSetupOpen(open: boolean) {
    this.setupOpen = open
  }

  // players knocked out in earlier rounds keep their phone connected, but it no longer does anything
  setActive(slots: number[]) {
    this.active = [...slots]
    this.broadcast()
  }

  // ── Phones ───────────────────────────────────────────
  join(link: PhoneLink, rawName: unknown, rawDeviceId?: unknown) {
    const name = String(rawName ?? '').trim().slice(0, NAME_MAX) || 'Хтось'
    const deviceId = typeof rawDeviceId === 'string' && rawDeviceId ? rawDeviceId : null
    this.phones.delete(link.peerId)
    // the same phone coming back before we noticed it had dropped: its old connection is dead weight
    for (const [peerId, phone] of this.phones) {
      if (deviceId !== null && phone.deviceId === deviceId) {
        this.phones.delete(peerId)
        phone.link.close?.()
      }
    }

    const free = this.names.map((_, slot) => slot).filter((slot) => !this.phoneAt(slot))
    // a returning player gets their old slot back; a new one takes an unnamed slot first
    const slot =
      free.find((s) => sameName(this.names[s], name) || sameName(this.phoneNames[s], name)) ??
      free.find((s) => this.names[s].trim() === '') ??
      free[0]

    if (slot === undefined) {
      link.send({ type: 'rejected', reason: 'full' })
      return
    }

    this.phones.set(link.peerId, { link, name, joinedAt: Date.now(), slot, deviceId, lastSeen: Date.now(), pings: false })
    this.phoneNames[slot] = name
    if (this.setupOpen) this.names[slot] = name
    this.emit()
    this.broadcast()
  }

  leave(peerId: string) {
    if (!this.phones.delete(peerId)) return
    this.emit()
    this.broadcast()
  }

  // any message proves the phone is there; only a ping proves it will keep saying so
  seen(peerId: string, isPing: boolean, now = Date.now()) {
    const phone = this.phones.get(peerId)
    if (!phone) return
    phone.lastSeen = now
    if (isPing) phone.pings = true
  }

  // run on a timer: forgets phones that went silent (a dropped connection often never reports
  // itself closed) and re-sends the state so the phones can tell the game is still there
  heartbeat(now = Date.now()) {
    let dropped = false
    for (const [peerId, phone] of this.phones) {
      if (!phone.pings || now - phone.lastSeen <= PHONE_STALE_MS) continue
      this.phones.delete(peerId)
      phone.link.close?.()
      dropped = true
    }
    if (dropped) this.emit()
    this.broadcast()
  }

  buzz(peerId: string, roundId: unknown) {
    const phone = this.phones.get(peerId)
    if (!phone || this.buzzStatus !== 'armed' || roundId !== this.roundId) return
    if (this.locked.includes(phone.slot) || !this.active.includes(phone.slot)) return
    // flip to `buzzed` right here so a second tap can't also get through before React reacts
    this.buzzStatus = 'buzzed'
    this.winner = phone.slot
    this.broadcast()
    for (const listener of this.buzzListeners) listener(phone.slot)
  }

  answer(peerId: string, roundId: unknown, option: unknown) {
    const phone = this.phones.get(peerId)
    if (!phone || this.buzzStatus !== 'choice' || roundId !== this.roundId) return
    if (!this.active.includes(phone.slot) || this.answers.has(phone.slot)) return
    if (typeof option !== 'number' || !Number.isInteger(option) || option < 0 || option >= this.options.length) return
    // recorded right here so a second tap can't change the pick before React reacts
    this.answers.set(phone.slot, option)
    this.broadcast()
    for (const listener of this.answerListeners) listener(phone.slot, option)
  }

  // ── Driven by the round on screen ────────────────────
  arm(lockedSlots: number[]) {
    const sameLocked = lockedSlots.length === this.locked.length && lockedSlots.every((s) => this.locked.includes(s))
    if (this.buzzStatus === 'armed' && sameLocked) return
    this.buzzStatus = 'armed'
    this.roundId += 1 // a new id re-enables the buttons of phones that tapped too late last time
    this.winner = null
    this.locked = [...lockedSlots]
    this.broadcast()
  }

  showBuzzed(slot: number) {
    if (this.buzzStatus === 'buzzed' && this.winner === slot) return
    this.buzzStatus = 'buzzed'
    this.winner = slot
    this.broadcast()
  }

  // puts the options on every active phone; `answers` (slot -> option) is the round's own
  // record, which also carries picks the host entered from the keyboard
  showChoice(options: string[], answers: Map<number, number>) {
    const fresh = this.buzzStatus !== 'choice' || this.options !== options
    const sameAnswers = answers.size === this.answers.size && [...answers].every(([s, o]) => this.answers.get(s) === o)
    if (!fresh && sameAnswers) return
    if (fresh) this.roundId += 1
    this.buzzStatus = 'choice'
    this.winner = null
    this.locked = []
    this.options = options
    this.answers = new Map(answers)
    this.correct = null
    this.results = new Map()
    this.broadcast()
  }

  showChoiceResult(options: string[], answers: Map<number, number>, correct: number, results: Map<number, ChoiceResult>) {
    if (this.buzzStatus === 'reveal' && this.options === options) return
    this.buzzStatus = 'reveal'
    this.options = options
    this.answers = new Map(answers)
    this.correct = correct
    this.results = new Map(results)
    this.broadcast()
  }

  idle() {
    if (this.buzzStatus === 'lobby') return
    this.buzzStatus = 'lobby'
    this.winner = null
    this.locked = []
    this.options = []
    this.answers = new Map()
    this.correct = null
    this.results = new Map()
    this.broadcast()
  }

  private displayName(phone: Phone) {
    return this.names[phone.slot].trim() || phone.name
  }

  private broadcast() {
    const phones = [...this.phones.values()]
    const winner = this.winner === null ? undefined : this.phoneAt(this.winner)
    const payload = {
      type: 'state',
      hb: true, // tells the phone this host keeps sending, so silence means the link is dead
      game: {
        status: this.buzzStatus,
        roundId: this.roundId,
        count: 0,
        // a buzz taken from the keyboard has no phone behind it, but still isn't anybody else's win
        winnerId: this.winner === null ? null : (winner?.link.peerId ?? 'host'),
        winnerName: this.winner === null ? null : winner ? this.displayName(winner) : this.names[this.winner] || null,
      },
      players: phones.map((p) => ({ id: p.link.peerId, name: this.displayName(p), joinedAt: p.joinedAt })),
      rest: [],
      locked: phones.filter((p) => this.locked.includes(p.slot)).map((p) => p.link.peerId),
      out: phones.filter((p) => !this.active.includes(p.slot)).map((p) => p.link.peerId),
      options: this.options,
      answers: Object.fromEntries(
        phones.filter((p) => this.answers.has(p.slot)).map((p) => [p.link.peerId, this.answers.get(p.slot)]),
      ),
      correct: this.correct,
      results: Object.fromEntries(phones.map((p) => [p.link.peerId, this.results.get(p.slot) ?? 'none'])),
    }
    for (const phone of phones) {
      try {
        phone.link.send(payload)
      } catch {
        // a phone that dropped mid-send is cleaned up by its close event
      }
    }
  }

  // ── PeerJS wiring ────────────────────────────────────
  // safe to call more than once; the room lives as long as the page
  connect() {
    if (this.connectStarted) return
    this.connectStarted = true
    import('peerjs')
      .then(({ Peer }) => {
        this.createPeer(Peer)
        setInterval(() => this.heartbeat(), HEARTBEAT_MS)
      })
      .catch(() => {
        this.status = 'failed'
        this.emit()
      })
  }

  private createPeer(PeerCtor: typeof Peer) {
    this.attempts += 1
    // a reloaded page first asks for its previous code, so phones that are
    // already retrying that room find it again without anyone retyping
    const saved = this.attempts <= SAVED_CODE_ATTEMPTS ? loadSavedCode() : null
    const code = saved ?? genCode()
    const peer = new PeerCtor(ROOM_PREFIX + code, { debug: 0 })

    peer.on('open', () => {
      this.code = code
      this.status = 'open'
      saveCode(code)
      this.emit()
    })

    peer.on('connection', (conn) => {
      const link: PhoneLink = { peerId: conn.peer, send: (msg) => conn.send(msg), close: () => conn.close() }
      conn.on('open', () => {
        conn.on('data', (msg) => {
          if (typeof msg !== 'object' || msg === null) return
          const { type, name, roundId, option } = msg as Record<string, unknown>
          this.seen(conn.peer, type === 'ping')
          if (type === 'join') this.join(link, name, (msg as Record<string, unknown>).deviceId)
          else if (type === 'buzz') this.buzz(conn.peer, roundId)
          else if (type === 'answer') this.answer(conn.peer, roundId, option)
        })
        conn.on('close', () => this.leave(conn.peer))
      })
    })

    // the broker drops idle sockets; phones already connected keep working,
    // but new ones can only find the room once we are back
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect()
    })

    peer.on('error', (err) => {
      if (this.status === 'open') return
      if (err.type === 'unavailable-id' && this.attempts < SAVED_CODE_ATTEMPTS + MAX_ID_ATTEMPTS) {
        peer.destroy()
        // the saved code is worth waiting for; a random one can be replaced at once
        if (saved) setTimeout(() => this.createPeer(PeerCtor), SAVED_CODE_RETRY_MS)
        else this.createPeer(PeerCtor)
        return
      }
      this.status = 'failed'
      this.emit()
    })
  }
}

export const buzzerRoom = new BuzzerRoom()
