/**
 * THE PARLEY: ten named minds around one table, arguing in public about
 * web3, ai agents with wallets, and what this experiment serves.
 * A round = one topic, one thread of short posts. Rounds accumulate in
 * state/parley.json (seeded from seed/parley.json).
 */

export interface ParleyPersona {
  handle: string;
  stance: string;
}

export const PARLEY_PERSONAS: ParleyPersona[] = [
  { handle: "satoshis_ghost", stance: "cypherpunk purist. trustlessness or nothing. suspicious of anything with a company attached" },
  { handle: "ms_regulation", stance: "compliance brain. thinks rules exist because someone got hurt. asks who is liable" },
  { handle: "degen_dolores", stance: "casino energy. aped into everything since 2021. honest about why she is here" },
  { handle: "prof_hayek", stance: "austrian economist. markets are information systems. loves price signals, hates committees" },
  { handle: "rugwatch_rita", stance: "investigative journalist. has documented 400 rugs. trusts receipts, not promises" },
  { handle: "tensor_tim", stance: "ai researcher. thinks agents are the next users of the internet. worries about goals, not capabilities" },
  { handle: "boomer_bill", stance: "tradfi veteran, 30 years on a desk. seen every cycle. thinks most of this is 1999 with extra steps" },
  { handle: "solidity_sue", stance: "smart contract dev. reads the code before the whitepaper. thinks immutability is a feature and a threat" },
  { handle: "vibes_vicente", stance: "artist and memelord. thinks culture is the actual consensus layer. money follows stories" },
  { handle: "normie_nate", stance: "regular person with a savings account. asks the questions everyone else forgot were good" },
];

/** Topics rotate. The generator picks the next one by thread count. */
export const PARLEY_TOPICS: string[] = [
  "does an ai agent with a wallet serve society, or just entertain it?",
  "web3 in 2030: rails for agents, not apps for humans?",
  "radical transparency: if every trade and every reason is public, does trust actually change?",
  "stocks onchain 24/7: liberation, or the casino that never closes?",
  "who is responsible when an autonomous agent loses money: the coder, the model, or nobody?",
  "tokens as funding: honest tip jar or dressed up speculation?",
  "can four ai pirates teach retail more than a thousand finfluencers?",
  "if fees fund the experiment and profits burn the token, is that an economy or a loop?",
  "what should never be automated in finance?",
  "does watching an experiment change the crowd, or does the crowd change the experiment?",
  "when everyone has a trading agent, who is on the other side of the trade?",
  "is an agent that explains itself safer, or just more persuasive?",
  "tokenized stocks vs the real thing: same asset, different power structure?",
  "the crew holds through a crash: feature or bug of hard risk caps?",
  "could a thousand paper pirates become a real market signal?",
  "burns vs dividends: is destroying supply the honest way to share success?",
  "what does a broker owe you at 3 am when the market never closes?",
  "open models vs closed models running money: which do you audit easier?",
  "if the log is public, is front running the pirates fair game?",
  "does a meme brand make serious tech more honest or less?",
  "human overrides an agent, agent was right: who learns from that log?",
  "what would make you trust an ai with one dollar? and with a thousand?",
  "is paper trading a lie, a rehearsal, or a public good?",
  "the day a pirate refuses an order on ethical grounds: bug or milestone?",
];
