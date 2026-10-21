# Kahan gaya paisa?

A voice helpline for the most common question in Indian payments: *the UPI payment failed, so where did my money go?*

A customer taps the mic and asks in Kannada, Hindi, Tamil, English or seven other Indian languages. The agent checks a sample passbook and answers out loud, in the same language, with what happened and the date the money is due back.

Live demo: https://kahan-gaya-paisa.vercel.app

## How a turn works

1. **Saaras v3** (Sarvam speech-to-text) transcribes the caller in her own script.
2. **Sarvam-105B** matches the complaint to a transaction and writes a short spoken answer, using only the passbook. It never asks for OTP, PIN or CVV, and hands disputes to a human.
3. **Bulbul v3** (Sarvam text-to-speech) reads the answer back.

Each call is timed on the server and shown on the page.

## Run it

The API key stays on the server. Set `SARVAM_API_KEY` (from https://dashboard.sarvam.ai) as an environment variable in Vercel, then deploy:

```
vercel deploy
```

Files:

- `index.html`: the page, recording (resampled to 16 kHz mono WAV in the browser) and playback
- `api/turn.js`: one support turn, STT → LLM → TTS, as a Vercel function in the Mumbai region

## Notes

Saathi Bank is fictional and the passbook is sample data. Reversal timelines follow RBI's [turnaround-time rules for failed transactions](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693): T+1 day for UPI transfers to a person, T+5 days for UPI payments to a merchant, with ₹100 a day owed for any delay beyond that.

Built by Nivedita Prabhu.
