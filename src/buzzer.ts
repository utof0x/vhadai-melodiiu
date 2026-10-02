import type { Peer } from 'peerjs'
import { PLAYER_COUNT } from './types'

// The game is the host of a buzz-in room: players' phones open the buzz-in page,
// join by the room code and act as buzzers. The message format below is the one
// that page speaks (see ../buzz-in/index.html), extended with `locked`.
const ROOM_PREFIX = 'buzzin-'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const MAX_ID_ATTEMPTS = 5
const NAME_MAX = 20

export const BUZZER_URL = 'utof0x.github.io/buzz-in'

// connecting: waiting for the PeerJS broker; open: phones can join; failed: keyboard only
type RoomStatus = 'connecting' | 'open' | 'failed'

// lobby: buttons disabled; armed: first tap wins; buzzed: someone is answering
type BuzzStatus = 'lobby' | 'armed' | 'buzzed'

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
}

interface Phone {
  link: PhoneLink
  name: string
  joinedAt: number
  slot: number
}

function genCode() {
  let out = ''
  for (let i = 0; i < 4; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
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

  private listeners = new Set<() => void>()
  private buzzListeners = new Set<(slot: number) => void>()
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

  // ── Phones ───────────────────────────────────────────
  join(link: PhoneLink, rawName: unknown) {
    const name = String(rawName ?? '').trim().slice(0, NAME_MAX) || 'Хтось'
    this.phones.delete(link.peerId)

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

    this.phones.set(link.peerId, { link, name, joinedAt: Date.now(), slot })
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

  buzz(peerId: string, roundId: unknown) {
    const phone = this.phones.get(peerId)
    if (!phone || this.buzzStatus !== 'armed' || roundId !== this.roundId) return
    if (this.locked.includes(phone.slot)) return
    // flip to `buzzed` right here so a second tap can't also get through before React reacts
    this.buzzStatus = 'buzzed'
    this.winner = phone.slot
    this.broadcast()
    for (const listener of this.buzzListeners) listener(phone.slot)
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

  idle() {
    if (this.buzzStatus === 'lobby') return
    this.buzzStatus = 'lobby'
    this.winner = null
    this.locked = []
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
      .then(({ Peer }) => this.createPeer(Peer))
      .catch(() => {
        this.status = 'failed'
        this.emit()
      })
  }

  private createPeer(PeerCtor: typeof Peer) {
    this.attempts += 1
    const code = genCode()
    const peer = new PeerCtor(ROOM_PREFIX + code, { debug: 0 })

    peer.on('open', () => {
      this.code = code
      this.status = 'open'
      this.emit()
    })

    peer.on('connection', (conn) => {
      const link: PhoneLink = { peerId: conn.peer, send: (msg) => conn.send(msg) }
      conn.on('open', () => {
        conn.on('data', (msg) => {
          if (typeof msg !== 'object' || msg === null) return
          const { type, name, roundId } = msg as { type?: unknown; name?: unknown; roundId?: unknown }
          if (type === 'join') this.join(link, name)
          else if (type === 'buzz') this.buzz(conn.peer, roundId)
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
      if (err.type === 'unavailable-id' && this.attempts < MAX_ID_ATTEMPTS) {
        peer.destroy()
        this.createPeer(PeerCtor)
        return
      }
      this.status = 'failed'
      this.emit()
    })
  }
}

export const buzzerRoom = new BuzzerRoom()
