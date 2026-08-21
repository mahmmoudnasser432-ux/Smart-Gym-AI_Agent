const buildOpenAiUrl = () => {
    const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
};

const canUseLlm = () => Boolean(process.env.OPENAI_API_KEY);

const completeJson = async ({ systemPrompt, userPrompt }) => {
    if (!canUseLlm()) {
        return null;
    }

    const response = await fetch(buildOpenAiUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.AI_MODEL || 'gpt-4.1-mini',
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI provider request failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('AI provider returned empty content');
    }

    return JSON.parse(content);
};

module.exports = {
    canUseLlm,
    completeJson
};
