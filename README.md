# Kahan gaya paisa?

A voice helpline for the most common question in Indian payments: *the UPI payment failed, so where did my money go?*

A caller taps the mic and asks in Kannada, Hindi, Tamil or any of the languages Saaras understands. The agent works out which language she's speaking, checks a sample passbook, and answers out loud in the same language, with what happened and the date the money is due back.

Live demo: https://kahan-gaya-paisa.vercel.app

## Why

- UPI ran about 802 million payments a day in September 2026 ([NPCI via StartupTalky](https://startuptalky.com/upi-transactions-september-2026/)).
- 0.7–0.8% fail for technical reasons ([NPCI CEO, Nov 2024](https://inc42.com/buzz/technical-glitches-on-upi-have-fallen-below-1)). That's millions a day.
- Internet and mobile banking was Canara Bank's top complaint category in FY26, with 1,52,157 complaints ([disclosure](https://www.canarabank.bank.in/documents/d/guest/disclosure-20of-20complaints-202025-26)).
- 10.6% of Indians speak English at all (Census 2011).
- NPCI's BHIM MyUPI assistant now takes complaints by chat in five languages ([YourStory](https://yourstory.com/2026/09/bhim-myupi-9-upi-services-ai-assistant)). Voice, and the other languages, are still open.

## Second demo: Hear every call

https://kahan-gaya-paisa.vercel.app/calls/

From 1 January 2027, RBI's recovery directions require every loan recovery call to be recorded, kept six months, and the borrower told. This audits those calls.

1. Sample calls are scripts voiced by **Bulbul v3** in two voices, so there's real audio.
2. The call is split at pauses; each piece is transcribed by **Saaras v4** in parallel, giving per-turn timestamps.
3. Each piece's voice pitch is grouped into two voices, a light stand-in for diarization that tells the model who's speaking.
4. **Sarvam-105B** checks seven rules: calling hours, recording notice, agent identity, threats, third-party pressure, misleading claims, and backing off during emergencies. It quotes where each failure happens and pulls out any promise to pay.

Files: `api/audit.js`, `src/calls/`.

## How a turn works

1. **Saaras v4** transcribes the caller with `language_code: unknown`, so it detects the language itself. `keyterms` bias it toward payments words like UPI, UTR and ARN.
2. **Sarvam-105B** matches the complaint to a passbook transaction and writes a short spoken answer, using only the passbook. It never asks for OTP, PIN or CVV, and hands disputes to a human.
3. **Bulbul v3** reads the answer back in the language Saaras heard. v3 is used over v4 Flash because it also covers Malayalam and Odia.

Each call is timed on the server and shown on the page.

## Run it

```
npm install
npm run dev        # page only; the API needs Vercel
vercel dev         # page + API locally
```

Set `SARVAM_API_KEY` (from https://dashboard.sarvam.ai) as an environment variable in Vercel. The key never reaches the browser.

- `src/App.jsx`: the page
- `src/rb/`: interface pieces adapted from [React Bits](https://reactbits.dev) (MIT + Commons Clause): Voice Pill, Thought Line, Status Mark, Text Type, Counter, Rotating Text
- `src/recorder.js`: records the caller and converts to 16 kHz mono WAV in the browser
- `api/turn.js`: one support turn, STT → LLM → TTS, as a Vercel function in Mumbai (`bom1`)
- `legacy-v1.html`: the first version, kept for reference

## Notes

Saathi Bank is fictional and the passbook is sample data. Reversal dates follow RBI's [turnaround-time rules for failed transactions](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693): T+5 days for a failed UPI payment to a merchant, T+1 for a transfer to a person, with ₹100 a day owed after that.

Built by Nivedita Prabhu.
