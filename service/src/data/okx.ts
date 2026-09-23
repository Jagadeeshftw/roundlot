import { cache } from "./cache.js";

// OKX public spot market data (no API key). Server-side only: the browser
// can't rely on CORS or on reaching www.okx.com from every network. Hosts are
// tried in order; all serve the same global xStock books.
const HOSTS = ["https://www.okx.com", "https://my.okx.com", "https://us.okx.com", "https://eea.okx.com"];
const TIMEOUT_MS = 4_000;

let preferredHost = 0;

async function okxGet<T>(path: string): Promise<{ data: T; host: string }> {
  let lastErr: unknown;
  for (let i = 0; i < HOSTS.length; i++) {
    const idx = (preferredHost + i) % HOSTS.length;
    const host = HOSTS[idx]!;
    try {
      const res = await fetch(`${host}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { code: string; msg: string; data: T };
      if (body.code !== "0") throw new Error(`OKX ${body.code} ${body.msg}`);
      preferredHost = idx;
      return { data: body.data, host };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`OKX market data unavailable: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export interface OkxMarket {
  instId: string;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  spreadBps: number;
  ts: string;
  host: string;
}

export function getMarket(instId: string): Promise<OkxMarket> {
  return cache.get(`okx:books:${instId}`, 2_000, async () => {
    const [{ data, host }, ticker] = await Promise.all([
      okxGet<{ asks: string[][]; bids: string[][]; ts: string }[]>(`/api/v5/market/books?instId=${instId}&sz=1`),
      okxGet<{ last: string }[]>(`/api/v5/market/ticker?instId=${instId}`),
    ]);
    const book = data[0];
    const ask = Number(book?.asks[0]?.[0]);
    const bid = Number(book?.bids[0]?.[0]);
    if (!book || !(ask > 0) || !(bid > 0)) throw new Error(`OKX returned an empty book for ${instId}`);
    const mid = (ask + bid) / 2;
    return {
      instId,
      bid,
      ask,
      mid,
      last: Number(ticker.data[0]?.last),
      spreadBps: ((ask - bid) / mid) * 1e4,
      ts: new Date(Number(book.ts)).toISOString(),
      host,
    };
  });
}

export interface OkxInstrument {
  instId: string;
  state: string; // live | suspend | preopen | rebase | ...
  minSz: string;
  lotSz: string;
  tickSz: string;
}

export function getInstrument(instId: string): Promise<OkxInstrument> {
  return cache.get(`okx:inst:${instId}`, 60_000, async () => {
    const { data } = await okxGet<OkxInstrument[]>(`/api/v5/public/instruments?instType=SPOT&instId=${instId}`);
    const inst = data[0];
    if (!inst) throw new Error(`OKX instrument ${instId} not found`);
    return { instId: inst.instId, state: inst.state, minSz: inst.minSz, lotSz: inst.lotSz, tickSz: inst.tickSz };
  });
}
