// Siri talks to Groq through our own serverless proxy (api/siri/*), so the
// API key never reaches the browser.

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");

    const response = await fetch("/api/siri/transcribe", { method: "POST", body: formData });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.text;
}

/** Ask Siri. The server adds the system prompt and tool definitions. */
export async function getGroqChatCompletion(text: string): Promise<any> {
    const response = await fetch("/api/siri/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat error: ${response.status} - ${errorText}`);
    }
    return response.json();
}
