import { Connection } from "@solana/web3.js";
import { COOKIE_RPC_URL, COOKIE_WSS_URL } from "./config";

let _conn: Connection | null = null;

/** Singleton Connection to Cookie Chain. Use everywhere — never `new Connection` inline. */
export function getConnection(): Connection {
  if (!_conn) {
    _conn = new Connection(COOKIE_RPC_URL, {
      commitment: "confirmed",
      wsEndpoint: COOKIE_WSS_URL,
    });
  }
  return _conn;
}
