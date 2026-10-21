// Public liveness probe: says whether the server has its keys, never what they are.
export default function handler(req, res) {
  res.status(200).json({ ok: true, hasSarvamKey: Boolean(process.env.SARVAM_API_KEY), hasCheckToken: Boolean(process.env.CHECK_TOKEN) });
}
