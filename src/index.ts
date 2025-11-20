import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3002;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3';

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'neuro-runner', mode: 'inference' });
});

// Chat endpoint - forwards to Ollama
app.post('/chat', async (req, res) => {
    try {
        const { content, model } = req.body;
        console.log(`[RUNNER] Processing request for model ${model || DEFAULT_MODEL}`);

        // Forward to Ollama
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                messages: [{ role: 'user', content }],
                stream: false // Disable streaming for now to keep it simple
            })
        });

        if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text();
            console.error(`[RUNNER] Ollama error: ${errorText}`);
            return res.status(502).json({ error: 'Ollama inference failed', detail: errorText });
        }

        const data = await ollamaRes.json() as any;

        // Transform Ollama response to our format
        const response = {
            sender: 'ai',
            content: data.message?.content || 'No response generated',
            model: data.model,
            timestamp: Date.now(),
            metrics: {
                eval_duration: data.eval_duration,
                prompt_eval_count: data.prompt_eval_count
            }
        };

        console.log(`[RUNNER] Generated response in ${data.total_duration / 1000000}ms`);
        res.json(response);

    } catch (error: any) {
        console.error('[RUNNER] Internal error:', error);
        // Fallback for when Ollama is not running/reachable
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'AI Engine Unavailable',
                detail: 'Could not connect to local Ollama instance. Is it running?'
            });
        }
        res.status(500).json({ error: 'Internal runner error', detail: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`NeuroSwarm Runner (AI Bridge) listening on port ${PORT}`);
    console.log(`Connected to AI Engine at ${OLLAMA_URL}`);
});