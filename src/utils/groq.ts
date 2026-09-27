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

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export async function getGroqChatCompletion(
    messages: ChatMessage[],
    tools: any[]
): Promise<any> {
    const response = await fetch("/api/siri/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, tools })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat error: ${response.status} - ${errorText}`);
    }
    return response.json();
}
