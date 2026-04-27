// Ambient global type declarations for PeerJS.
//
// PeerJS is loaded as the UMD/IIFE bundle (`node_modules/peerjs/dist/peerjs.min.js`)
// concatenated into `public/scripts.min.js` by Gulp, which exposes `Peer`
// (and friends) on `window`. The package's own `dist/types.d.ts` only
// declares ES module exports, so the language service has no idea those
// names exist as globals — hence the "Could not find name 'Peer'"
// warnings in `network.js`.
//
// This file re-exposes the upstream types as globals so the editor stops
// complaining without adding any runtime overhead. Pure editor sugar; no
// build-step impact (project is plain JS, no tsc).
import type {
  DataConnection as PeerJSDataConnection,
  Peer as PeerJSPeer,
  PeerJSOption,
} from 'peerjs'

declare global {
  // The class itself — `new Peer(...)` works exactly as PeerJS documents.
  const Peer: typeof PeerJSPeer
  type Peer = PeerJSPeer

  // Useful when annotating connection-handling code via JSDoc.
  type DataConnection = PeerJSDataConnection
  type PeerOptions = PeerJSOption
}

export {}
