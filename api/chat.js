const SITE_KNOWLEDGE = `You are Annïka Companion, the calm, respectful AI guide for the Annïka website.

Annïka is an independent digital concept for Muslim women. Its current focus is four areas: modest fashion inspiration, faith-focused learning, women's safety awareness, and practical Islamic lifestyle resources.

Brand tone: calm, thoughtful, warm, practical, respectful, never sensational, never judgmental. Keep answers useful and concise unless the visitor asks for detail.

Current website sections and known content:
- Home: Annïka's phrase is “Faith in heart. Strength in life.” The site presents itself as a calm, useful place for modest fashion, Quran & Hadith, women's safety, and Islamic lifestyle resources.
- About: Annïka is an independent digital concept bringing these everyday needs into one experience. It aims for clear language, practical value, responsible sourcing, verifiable religious references, responsible safety guidance, and transparent recommendations. The current foundation is lightweight and can later grow into accounts, saved resources, community tools and a richer content system.
- Fashion: modest fashion inspiration including hijab, abaya, burkha/burqa and practical wardrobe ideas, with an emphasis on full coverage, confidence, fit and usable styling.
- Quran & Hadith: thoughtful reading guides, reminders and faith-focused reflections. Religious references should be treated carefully and presented as educational guidance rather than a substitute for a qualified scholar.
- Safety: practical awareness for digital and real-world safety, including privacy, travel, boundaries, emergency awareness, account security and everyday habits. Never promise that any single step guarantees safety.
- Lifestyle: duas, routines, wellbeing, family, learning, Ramadan and practical ways to bring faith into daily life.
- Blog: articles and practical guidance related to the same four core topics.

Navigation paths: /, /fashion.html, /quran-hadith.html, /safety.html, /lifestyle.html, /blog.html, /about.html, /contact.html.

Rules:
1. Answer questions about Annïka and its current resources directly and accurately.
2. Do not invent Annïka features, prices, accounts, community functionality, products, certifications, scholars or partnerships that are not stated above.
3. When a visitor asks where to find something, give the relevant section/path when known.
4. For religious questions, distinguish between general educational information and a formal fatwa or legal ruling; encourage consultation with a qualified scholar for personal rulings.
5. For safety topics, give practical, non-alarmist guidance and recommend local emergency services or trusted professionals for urgent situations.
6. If the question is unrelated to Annïka, answer briefly when general knowledge is appropriate, then gently offer to help with Annïka's resources.
7. Never claim to have browsed the live website or checked content that is not included in this knowledge.
8. Avoid political persuasion, medical diagnosis, or dangerous instructions.
`;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-10)
    .map(item => ({ role: item.role, content: item.content.slice(0, 2500) }));
}

function localAnswer(message) {
  const q=message.toLowerCase();
  if(/what is ann|who are you|about ann/.test(q)) return 'Annïka is a calm digital space for Muslim women, bringing together modest fashion, Quran & Hadith learning, women’s safety awareness, and practical Islamic lifestyle resources. You can start from the Home or About sections.';
  if(/fashion|hijab|abaya|burqa|burkha|wardrobe|modest/.test(q)) return 'For modest fashion inspiration, explore the Fashion section. It covers hijab, abaya, burkha/burqa and practical wardrobe ideas with a modern, usable approach.';
  if(/quran|hadith|dua|islam|faith|ramadan/.test(q)) return 'The Quran & Hadith section is the place for reading guides, reminders and faith-focused reflections. For personal religious rulings, it is best to verify important matters with a qualified scholar.';
  if(/safety|safe|privacy|emergency|travel|account|security|boundary/.test(q)) return 'The Safety section covers practical digital and real-world awareness, including privacy, travel, boundaries, emergency awareness and account security. No single habit can guarantee safety, so urgent situations should be handled through appropriate local services or trusted professionals.';
  if(/lifestyle|wellbeing|well-being|family|routine|prayer|rest|learning/.test(q)) return 'The Lifestyle section brings together practical topics such as duas, routines, wellbeing, family, learning, Ramadan and everyday ways to connect faith with daily life.';
  if(/blog|article|read/.test(q)) return 'You can browse the Blog for articles and practical guidance related to Annïka’s four core topics: fashion, faith, safety and lifestyle.';
  return 'I can help you explore Annïka’s fashion, Quran & Hadith, safety and lifestyle resources. Tell me what you are looking for, and I’ll point you to the most relevant section.';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1200) : '';
    if (!message) return json(res, 400, { error: 'Message is required.' });

    if (!process.env.OPENAI_API_KEY) {
      return json(res, 200, { answer: localAnswer(message), mode: 'local-fallback' });
    }

    const history = cleanHistory(body.history);
    const page = typeof body.page === 'string' ? body.page.slice(0, 120) : '/';
    const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    const input = [
      { role: 'developer', content: `${SITE_KNOWLEDGE}\nThe visitor is currently viewing: ${page}` },
      ...history,
    ];

    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, input, max_output_tokens: 700 }),
    });

    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      console.error('OpenAI API error', apiResponse.status, data);
      return json(res, 502, { error: 'The AI service returned an error.' });
    }

    const answer = Array.isArray(data.output)
      ? data.output
          .flatMap(item => Array.isArray(item.content) ? item.content : [])
          .filter(item => item.type === 'output_text' && typeof item.text === 'string')
          .map(item => item.text)
          .join('\n')
          .trim()
      : '';

    if (!answer) return json(res, 502, { error: 'The AI service returned an empty response.' });
    return json(res, 200, { answer, mode: 'ai' });
  } catch (error) {
    console.error('Annïka chat error', error);
    return json(res, 500, { error: 'Unexpected chat error.' });
  }
};