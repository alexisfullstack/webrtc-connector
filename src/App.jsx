import React, { useEffect, useMemo, useState } from 'react'
import PokemonCard from './components/PokemonCard.jsx'
import VotePanel from './components/VotePanel.jsx'
import { getPokemon, getTwoRandom } from './api/pokeapi.js'
import { BrowserSocket } from './sync/BrowserSocket.js'
import { v4 as uuidv4 } from 'uuid';
import { keyHashHex } from './utils/key.js'

const DEFAULT_BATTLE = { left: 'bulbasaur', right: 'pikachu' }

export default function App() {
  const [battle, setBattle] = useState(DEFAULT_BATTLE)
  const [left, setLeft] = useState(null)
  const [right, setRight] = useState(null)

  const [roomKey, setRoomKey] = useState("pbr-123456");
  const [room, setRoom] = useState("");

  const [ballots] = useState(() => new Map()) // voterId -> 'left'|'right'
  const [votes, setVotes] = useState({ left: 0, right: 0 })
  const [hasVoted, setHasVoted] = useState(false)
  const [voterId] = useState(uuidv4())

  const [socket] = useState(() => new BrowserSocket())
  const [offerB64, setOfferB64] = useState('')
  const [answerB64, setAnswerB64] = useState('')
  const [incomingHostCode, setIncomingHostCode] = useState('')
      const [role, setRole] = useState('host')
  const [incomingGuestCode, setIncomingGuestCode] = useState('')
  const [warning, setWarning] = useState('')

  const battleId = useMemo(() => `${battle.left}::${battle.right}`, [battle])

  useEffect(() => {
    let active = true
    Promise.all([getPokemon(battle.left), getPokemon(battle.right)])
      .then(([a, b]) => {
        if (!active) return
        setLeft(a); setRight(b)
        ballots.clear(); setVotes({ left: 0, right: 0 }); setHasVoted(false)
      })
    return () => { active = false }
  }, [battleId])

  // WebSocket-like handlers (gated by room hash)
  useEffect(() => {
    socket.onmessage = (ev) => {
      try {
        const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : JSON.parse(ev.data)
        if (msg.room !== room) return // ignore other rooms
        if (msg.battleId !== battleId) return

        if (msg.type === 'vote') {
          if (!ballots.has(msg.voterId)) {
            ballots.set(msg.voterId, msg.side)
            recalc()
          }
        } else if (msg.type === 'sync') {
          for (const [id, side] of Object.entries(msg.ballots)) {
            if (!ballots.has(id)) ballots.set(id, side)
          }
          recalc()
        } else if (msg.type === 'reset') {
          ballots.clear(); recalc()
        }
      } catch {}
    }
    socket.onopen = () => {
      // help late joiners
      if (ballots.size > 0) {
        socket.send({ type: 'sync', room, battleId, ballots: Object.fromEntries(ballots.entries()) })
      }
    }
  }, [socket, room, battleId])

  useEffect(() => {
    let active = true;
    (async () => {
      setRoom("");
      try {
        const fp = await keyHashHex(roomKey.trim());
        if (active) setRoom(fp);
      } catch {
        if (active) setRoom("");
      }
    })();
    return () => { active = false };
  }, [roomKey]);

  function recalc() {
    let l = 0, r = 0
    for (const v of ballots.values()) v === 'left' ? l++ : r++
    setVotes({ left: l, right: r })
  }

  function handleVote(side) {
    if (hasVoted) return
    if (!ballots.has(voterId)) {
      ballots.set(voterId, side)
      setHasVoted(true)
      recalc()
      socket.send({ type: 'vote', voterId, side, battleId, room })
      setTimeout(() => socket.send({ type: 'sync', battleId, room, ballots: Object.fromEntries(ballots.entries()) }), 50)
    }
  }

  async function newBattle() {
    const [a, b] = await getTwoRandom()
    setBattle({ left: a.name, right: b.name })
  }

  // Manual signaling payload helpers (with room hash for verification)
  function encode(obj) { return btoa(JSON.stringify({ ...obj, room })) }
  function decode(b64) { return JSON.parse(atob(b64)) }

  return (
    <div className="container">
      <div className="title">Pokémon Battle Royale</div>
      <div className="subtitle">
        100% client-only. WebRTC DataChannel with manual room key and code exchange.
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <PokemonCard pokemon={left} isWinner={votes.left >= votes.right && (votes.left + votes.right) > 0} />
        <PokemonCard pokemon={right} isWinner={votes.right >= votes.left && (votes.left + votes.right) > 0} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <VotePanel left={left} right={right} disabled={hasVoted} onVote={handleVote} />

        <div className="row" style={{ marginTop: 16 }}>
          <div style={{ flex: 1, marginRight: 8 }}>
            <div className="row">
              <b>{left ? capitalize(left.name) : '—'}</b>
              <span>{votes.left} vote(s)</span>
            </div>
            <div className="progress"><div style={{ width: ((votes.left/(votes.left+votes.right||1))*100).toFixed(0)+'%' }} /></div>
          </div>
          <div style={{ flex: 1, marginLeft: 8 }}>
            <div className="row">
              <b>{right ? capitalize(right.name) : '—'}</b>
              <span>{votes.right} vote(s)</span>
            </div>
            <div className="progress"><div style={{ width: ((votes.right/(votes.left+votes.right||1))*100).toFixed(0)+'%' }} /></div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: 'center', gap: 8 }}>
          <button className="btn" onClick={newBattle}>New Battle (random)</button>
          <button className="btn btn-danger" onClick={() => { ballots.clear(); recalc(); socket.send({ type: 'reset', battleId, room })}}>Reset results</button>
        </div>
      </div>

      <>
<div className="card">
  <div className="title">Peer Connection (Manual Room Key)</div>
  <div className="subtitle">Both users enter the same room key, then use the section below based on their role.</div>

  <label>Room Key (both sides must enter the same)</label>
  <input type="text" value={roomKey} onChange={(e) => setRoomKey(e.target.value)} placeholder="e.g., pbr-123456" />
  <div className="row" style={{ marginTop: 8 }}>
    <span className="stat">Room fingerprint:</span>
    <b>{room}</b>
  </div>

  <div className="row" style={{ gap: 8, marginTop: 12 }}>
    <button className={'btn ' + (role==='host' ? 'btn-primary' : '')} onClick={()=>setRole('host')}>Host</button>
    <button className={'btn ' + (role==='guest' ? 'btn-success' : '')} onClick={()=>setRole('guest')}>Guest</button>
  </div>

  {role==='host' && (
    <div style={{ marginTop: 12 }}>
      <div className="subtitle">Host: generate the code and share it with the guest, then paste the guest's code.</div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={async () => {
          const sdp = await socket.createOffer()
          setOfferB64(encode({ type: 'offer', sdp }))
        }}>Create Host Code</button>
        <button className="btn" onClick={async () => {
          if (!incomingGuestCode) return
          try {
            const payload = decode(incomingGuestCode)
            if (payload.room !== room || payload.type !== 'answer') {
              setWarning('Room key mismatch or invalid guest code')
              return
            }
            await socket.acceptAnswer(payload.sdp)
            setWarning('')
          } catch { setWarning('Invalid guest code') }
        }}>Accept Guest Code</button>
      </div>

      <label>Host Code (share this with the guest)</label>
      <textarea value={offerB64} onChange={(e) => setOfferB64(e.target.value)} placeholder="Click 'Create Host Code' to generate..." />

      <label>Paste Guest Code (answer from guest)</label>
      <textarea value={incomingGuestCode} onChange={(e) => setIncomingGuestCode(e.target.value)} placeholder="Paste guest code here..." />
    </div>
  )}

  {role==='guest' && (
    <div style={{ marginTop: 12 }}>
      <div className="subtitle">Guest: paste the host code, create your code, and share it back.</div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-success" onClick={async () => {
          if (!incomingHostCode) return
          try {
            const payload = decode(incomingHostCode)
            if (payload.room !== room || payload.type !== 'offer') {
              setWarning('Room key mismatch or invalid host code')
              return
            }
            const ans = await socket.createAnswerFromOffer(payload.sdp)
            setAnswerB64(encode({ type: 'answer', sdp: ans }))
            setWarning('')
          } catch { setWarning('Invalid host code') }
        }}>Create Guest Code</button>
      </div>

      <label>Paste Host Code</label>
      <textarea value={incomingHostCode} onChange={(e) => setIncomingHostCode(e.target.value)} placeholder="Paste host code here..." />

      <label>Guest Code (share this back to the host)</label>
      <textarea value={answerB64} onChange={(e) => setAnswerB64(e.target.value)} placeholder="Click 'Create Guest Code' after pasting host code..." />
    </div>
  )}
  {warning && <div className="warning">{warning}</div>}
</div>
</></div>
  )
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
