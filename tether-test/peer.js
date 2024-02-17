
/**
 * P2P Auction 
 * Author: Yogi Saputro
 * 
 * In this setting, the one that opens (and closes) auction will be called seller.
 * The ones that bid will be called bidder.
 * peer.js is an instance that can be both server (the seller) and client (the bidder).
 * As per requirement of using Hyperswarm RPC instead of Hyperswarm that 
 */

'use strict'

const RPC = require('@hyperswarm/rpc')
const DHT = require('hyperdht')
const Hypercore = require('hypercore')
const Hyperbee = require('hyperbee')
const crypto = require('crypto')

const main = async () => {
  const bootstrapPublicKey = Buffer.from(process.argv[2], 'hex')
  if (!bootstrapPublicKey) {
    console.error('RPC bootstrap public key is required as argument.')
    process.exit(1)
  }

  // hyperbee db
  // randomized client hyperbee db to simulate multiple peers
  const hcore = new Hypercore(`./db/rpc-client-${Math.floor(Math.random() * 99999)}`)
  const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
  await hbee.ready()

  // Bootstrap still need DHT
  let dhtSeed = (await hbee.get('dht-seed-bootstrap'))?.value
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32)
    await hbee.put('dht-seed-bootstrap', dhtSeed)
  }

  const dht = new DHT({
    port: 40001 + Math.floor(Math.random() * 9999),
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }] // note boostrap points to dht that is started via cli
  })
  await dht.ready();
  
  // bootstrapRPC is for obtaining list of peer public keys, peerRPC is to actually connect to them
  const bootstrapRPC = new RPC({ dht });
  const peerRPC = new RPC({ dht });
  
  // the ideal implementation is using Hypercore or Hyperbee.
  // due to issue of storing array and manipulating it, right now still using normal array
  // drawback: non-persistent
  const connectedPeers = [];
  
  const peerServer = peerRPC.createServer();
  await peerServer.listen();
  const registerSuccess = await bootstrapRPC.request(bootstrapPublicKey, 'register', peerServer.publicKey.toString('hex'));
  if (!registerSuccess) {
    console.error("Failed to register peer. Exiting...")
    await peerServer.close();
    await peerRPC.destroy();
    await dht.destroy();
    process.exit(1);
  }

  // this will give the list of peers that can be iterated through.
  connectedPeers = await bootstrapRPC.request(bootstrapPublicKey, 'peers');

  // here, input is using CLI and assumes 3 types of input: sell, bid, and close
  // expected format: [sell/bid/close]-[peer public key]-[optional: item description]
  // current limitation: one public key can only sell one at a time. 
  // This can be improved by storing transaction data to Hyperbee or Hypercore 
  process.stdin.on('data', d => {
    const inputData = d.toString().split("-")
    switch (inputData[0].toLowerCase()) {
      case "sell":
        
        break;
      case "bid":
        
        break;
      case "close":

        break;
      default:
        break;
    }
  })

  peerServer.respond('notify', async (rawMessage) => {
    console.log(rawMessage.toString('utf-8'));
  })

  // closing connection
  // await rpc.destroy()
  // await dht.destroy()
}

main().catch(console.error)
