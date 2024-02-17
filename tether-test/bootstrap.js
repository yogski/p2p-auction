/**
 * P2P Auction 
 * Author: Yogi Saputro
 * 
 * bootstrap.js start DHT and create RPC server for auction
 */

'use strict'

const RPC = require('@hyperswarm/rpc')
const DHT = require('hyperdht')
const Hypercore = require('hypercore')
const Hyperbee = require('hyperbee')
const crypto = require('crypto')

const main = async () => {
  // hyperbee db
  const hcore = new Hypercore('./db/rpc-server')
  const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
  await hbee.ready()

  // peers is planned using Hypercore, 
  // due to issue in handling array manipulation and handling buffer, will use array for time being
  // drawback: nonn persistent data

  let peers = []
  // let peerCore = new Hypercore('./db/peers');
  // await peerCore.ready()

  // resolved distributed hash table seed for key pair
  let dhtSeed = (await hbee.get('dht-seed'))?.value
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32)
    await hbee.put('dht-seed', dhtSeed)
  }

  // start distributed hash table, it is used for rpc service discovery
  // basically connect to P2P network by registering to DHT
  const dht = new DHT({
    port: 40001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }] // note boostrap points to dht that is started via cli
  })
  await dht.ready()

  // resolve rpc server seed for key pair
  let rpcSeed = (await hbee.get('rpc-seed'))?.value
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32)
    await hbee.put('rpc-seed', rpcSeed)
  }

  // setup rpc server
  const rpc = new RPC({ seed: rpcSeed, dht })
  const rpcServer = rpc.createServer()
  await rpcServer.listen()
  console.log('rpc bootsrap public key:', rpcServer.publicKey.toString('hex'))

  // register the public keys of new node
  // the idea is storing public keys as an array.
  // there could be native implementation in ecosystem, might be subject to improvement 
  rpcServer.respond('register', async (rawPublicKey) => {
    try {
      const publicKey = rawPublicKey.toString('hex');
      peers = [...new Set(peers.concat(publicKey))]
  
      // this one has append, but still lack the mechannism to retrieve the leatest data
      // await peerCore.append(Buffer.from(JSON.stringify(peers), 'utf-8'));
      return true;
    } catch (error) {
      return false;
    }

    // failed attempt to store using Hyperbee but had issue with buffer allocation
    // try {
    //   let peerPublicKeys = (await hbee.get('peer-public-keys'))?.value
    //   if (!peerPublicKeys) {
    //     // not found, generate and store in db
    //     const newPublicKeyArray = publicKey
    //     const newPeerPublicKeys = JSON.stringify(newPublicKeyArray)
    //     await hbee.put('peer-public-keys', );
    //     return true;
    //   } else {
        
    //     const parsedPublicKeys = JSON.parse(peerPublicKeys.toString('utf-8'))
    //     const appendPublicKeys = [...new Set(parsedPublicKeys.concat(publicKey))]
    //     const bufferPublicKeys = Buffer.from(JSON.stringify(appendPublicKeys), 'utf-8')
    //     await hbee.put('peer-public-keys', bufferPublicKeys)
    //     return true;
    //   }
    // } catch (error) {
      
    //   console.error(error);
    //   return false;
    // }
  })

  rpcServer.respond('peers', async () => {
    return peers;
  })

  // implementation about closing connection that basically reduce numbers of connected peers
  rpcServer.respond('closing', async (rawPublicKey) => {
    try {
      const publicKey = rawPublicKey.toString('hex');
      peers = peers.filter(peer => peer !== publicKey);
      return true
    } catch (error) {
      return false
    }
  })

}

main().catch(console.error)
