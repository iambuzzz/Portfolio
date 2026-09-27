import { useRef, useState, useEffect, useCallback } from "react";
import { useAudioContext } from "~/context/AudioContext";
import { useStore } from "~/stores";
import { transcribeAudio, getGroqChatCompletion } from "~/utils/groq";
import { profile } from "~/data/profile";
import { SIRI_FALLBACK } from "~/data/siri";
import { localAnswer } from "~/data/siriLocal";
import { useMusicStore } from "~/stores/music";
import { searchSongs } from "~/utils/saavn";

type SiriPhase = "idle" | "recording" | "processing" | "speaking" | "error";

/** Replies are shown in a small bubble and read aloud: strip any markdown. */
const toPlainText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-*•]\s+/gm, "") // bullets
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, "$1$2") // italics
    .replace(/[*#]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

/** Extra cleanup for the voice only: don't read out URLs, dashes or emoji. */
const toSpeech = (text: string) =>
  text
    .replace(/https?:\/\/\S+/g, "the link")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/[·|]/g, ", ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Chrome stops long utterances after ~15s, so speak sentence by sentence.
// Split only where punctuation is followed by a space, so "Next.js" stays whole.
const toSentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);

//  Check browser SpeechRecognition support 
const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function Siri({ closeSiri }: { closeSiri?: () => void }) {
  const [phase, setPhase] = useState<SiriPhase>("idle");
  const [responseText, setResponseText] = useState("");
  const [inputText, setInputText] = useState("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const vadLoopRef = useRef<number | null>(null);

  // Always use Whisper (MediaRecorder + Groq API) — works in all browsers.
  // The native SpeechRecognition API is Chrome/Edge-only, so we skip it.
  // Free, instant browser speech recognition where available (Chrome, Edge,
  // Safari); Groq Whisper via our proxy elsewhere, or if the browser's fails.
  const [useBrowserSTT, setUseBrowserSTT] = useState<boolean>(!!SpeechRecognitionAPI);

  // Store & audio context (use controls.play/pause to keep state in sync with TopBar)
  const { controls } = useAudioContext();
  // Read the store lazily inside handlers so Siri doesn't re-render on every change.

  // Preload voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => window.speechSynthesis.getVoices());
  }, []);

  //  Play siri.mp3 activation sound 
  const playSiriSound = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const siriAudio = document.getElementById("siri-audio") as HTMLAudioElement | null;
      if (siriAudio) {
        siriAudio.volume = 0.8;
        siriAudio.currentTime = 0;
        siriAudio.play().then(() => {
          // Wait for the sound to finish (or 1.5s max)
          const timeout = setTimeout(resolve, 1500);
          siriAudio.onended = () => {
            clearTimeout(timeout);
            siriAudio.onended = null;
            resolve();
          };
        }).catch((err) => {
          // console.error("Siri sound play error:", err);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }, []);

  //  DOM helpers 
  const openAppById = useCallback((id: string) => {
    window.dispatchEvent(new CustomEvent("app:open", { detail: id }));
  }, []);

  const closeAppById = useCallback((id: string) => {
    window.dispatchEvent(new CustomEvent("app:close", { detail: id }));
  }, []);

  //  Download resume 
  const downloadResume = useCallback(() => {
    // console.log("[Tool]  Triggering resume download");
    const link = document.createElement("a");
    link.href = profile.resume;
    link.download = profile.resumeFileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  //  Tool executor 
  const executeTool = useCallback(async (name: string, args: any): Promise<string> => {
    // console.log(`[Tool]  Executing: ${name}`, args);

    switch (name) {
      case "toggle_dark_mode": {
        useStore.getState().toggleDark();
        const nowDark = useStore.getState().dark;
        // console.log(`[Tool]  Dark mode: ${nowDark}`);
        return nowDark ? "Switched to dark mode." : "Switched to light mode.";
      }

      case "play_music": {
        // "Play <song>": search JioSaavn and play the best match.
        const query = typeof args?.query === "string" ? args.query.trim() : "";
        if (query) {
          try {
            const tracks = await searchSongs(query);
            if (!tracks.length) return `I couldn't find "${query}".`;
            useMusicStore.getState().playQueue(tracks, 0);
            openAppById("spotify");
            return `Playing ${tracks[0].title} by ${tracks[0].artist}.`;
          } catch {
            return "The music service isn't responding right now.";
          }
        }
        // Resume the current song, or open Spotify if nothing is queued yet.
        if (useMusicStore.getState().queue.length) {
          controls.play();
          return "Playing music now.";
        }
        openAppById("spotify");
        return "Opening Spotify — search for any song!";
      }

      case "pause_music": {
        try {
          controls.pause();
          // console.log("[Tool]  Music paused (synced with controls)");
        } catch (err) {
          // console.error("[Tool]  Pause failed:", err);
        }
        return "Music paused.";
      }

      case "set_volume": {
        const v = Math.max(0, Math.min(100, Number(args?.level) || 50));
        useStore.getState().setVolume(v);
        controls.volume(v / 100);
        // console.log(`[Tool]  Volume: ${v}%`);
        return `Volume set to ${v}%.`;
      }

      case "set_brightness": {
        const b = Math.max(1, Math.min(100, Number(args?.level) || 50));
        useStore.getState().setBrightness(b);
        // console.log(`[Tool]  Brightness: ${b}%`);
        return `Brightness set to ${b}%.`;
      }

      case "toggle_wifi":
        useStore.getState().toggleWIFI();
        // console.log("[Tool]  WiFi toggled");
        return "Wi-Fi toggled.";

      case "toggle_bluetooth":
        useStore.getState().toggleBluetooth();
        // console.log("[Tool]  Bluetooth toggled");
        return "Bluetooth toggled.";

      case "open_app":
        openAppById((args?.app_id || "").toLowerCase());
        return `Opening ${args?.app_id}.`;

      case "close_app":
        closeAppById((args?.app_id || "").toLowerCase());
        return `Closing ${args?.app_id}.`;

      case "get_current_time": {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        // console.log(`[Tool]  Time: ${time}`);
        return `It is ${time} on ${date}.`;
      }

      case "download_resume":
        downloadResume();
        return `Here's ${profile.firstName}'s résumé — the download should start right away!`;

      case "toggle_fullscreen": {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            return "Going full screen! Enjoy the immersive view.";
          } else {
            if (document.exitFullscreen) {
              await document.exitFullscreen();
              return "Exited full screen mode. Back to normal!";
            }
          }
        } catch (err) {
          // console.error("[Tool] Fullscreen toggle failed:", err);
          return "Hmm, couldn't toggle full screen mode right now.";
        }
        return "Full screen mode toggled!";
      }

      case "open_launchpad": {
        window.dispatchEvent(new CustomEvent("siri:openLaunchpad"));
        return `Opening the Launchpad — here are ${profile.firstName}'s projects!`;
      }


      default:
        // console.warn(`[Tool]  Unknown tool: ${name}`);
        return "Done.";
    }
  }, [controls, openAppById, closeAppById, downloadResume]);

  //  Listening lifecycle 
  // Bumped whenever listening is cancelled (typed question, close), so late
  // results/errors from the mic can't overwrite the current answer.
  const listenIdRef = useRef(0);

  const cancelListening = useCallback(() => {
    listenIdRef.current++;
    if (vadLoopRef.current) {
      cancelAnimationFrame(vadLoopRef.current);
      vadLoopRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch { /* not started */ }
    recognitionRef.current = null;
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
      try { rec.stop(); } catch { /* already stopped */ }
    }
  }, []);

  //  TTS 
  // Bumped on every new reply / stop, so callbacks from cancelled speech are ignored.
  const speechIdRef = useRef(0);

  const stopSpeaking = useCallback(() => {
    speechIdRef.current++;
    window.speechSynthesis.cancel();
    setPhase((p) => (p === "speaking" ? "idle" : p));
  }, []);

  const speakText = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const id = ++speechIdRef.current;
    const parts = toSentences(toSpeech(text));
    if (!text || !parts.length) { setPhase("idle"); return; }
    setPhase("speaking");

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      || voices.find((v) => v.lang.startsWith("en-US"))
      || voices.find((v) => v.lang.startsWith("en"))
      || voices[0];

    const done = () => {
      if (speechIdRef.current === id) setPhase("idle");
    };
    parts.forEach((part, i) => {
      const utt = new SpeechSynthesisUtterance(part);
      if (voice) utt.voice = voice;
      utt.rate = 1.0;
      utt.pitch = 1.1;
      if (i === parts.length - 1) utt.onend = done;
      utt.onerror = done;
      window.speechSynthesis.speak(utt);
    });
  }, []);

  const close = useCallback(() => {
    cancelListening();
    stopSpeaking();
    if (closeSiri) closeSiri(); else closeAppById("siri");
  }, [cancelListening, stopSpeaking, closeSiri, closeAppById]);

  // Never keep talking after Siri is closed; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      speechIdRef.current++;
      window.speechSynthesis.cancel();
    };
  }, [close]);

  //  Groq LLM Agent 
  const executeAgent = useCallback(async (userText: string) => {
    try {
      // The system prompt and tools are added server-side (api/siri/chat.ts).
      const data = await getGroqChatCompletion(userText);
      const msg = data.choices[0].message;
      // console.log("[Agent] LLM response:", JSON.stringify(msg, null, 2));

      let reply = msg.content || "";
      let toolCalls = msg.tool_calls || [];

      //  Handle Gemma-style raw text tool tags 
      // Gemma often outputs tools as <function=tool_name>{"args": "..."}</function> instead of proper JSON tool calls
      const gemmaToolRegex = /<function=([^>]+)>(.*?)<\/function>/g;
      let match;
      while ((match = gemmaToolRegex.exec(reply)) !== null) {
        const toolName = match[1];
        const toolArgsStr = match[2];
        let args = {};
        try { if (toolArgsStr) args = JSON.parse(toolArgsStr); } catch (e) { /* */ }

        // Add to our execution list
        toolCalls.push({
          id: `gemma-${Date.now()}`,
          type: "function",
          function: { name: toolName, arguments: JSON.stringify(args) }
        });
      }

      // Clean the raw tags from the text so Siri doesn't speak "less than function equals..."
      reply = reply.replace(/<function=[^>]+>.*?<\/function>/g, "").trim();

      if (toolCalls && toolCalls.length > 0) {
        // console.log(`[Agent] ${toolCalls.length} tool call(s)`);
        const results: string[] = [];
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch (_e) { /* */ }
          const result = await executeTool(tc.function.name, args);
          results.push(result);
        }
        if (!reply) reply = results.join(" ");
      }

      if (!reply || !reply.trim()) {
        reply = SIRI_FALLBACK;
      }

      reply = toPlainText(reply) || SIRI_FALLBACK;
      setResponseText(reply);
      speakText(reply);
    } catch {
      // AI unavailable (no key, rate limit, offline): answer locally.
      const local = localAnswer(userText);
      let msg = SIRI_FALLBACK;
      if (local) {
        const toolResult = local.tool ? await executeTool(local.tool.name, local.tool.args ?? {}) : "";
        msg = local.reply || toolResult;
      }
      setResponseText(msg);
      speakText(msg);
    }
  }, [executeTool, speakText]);

  //  Handle text input 
  const handleTextInput = useCallback(async (text: string) => {
    const cleaned = (text || "").trim();
    if (!cleaned) return;
    cancelListening();
    window.speechSynthesis.cancel();
    setResponseText(`You typed: "${cleaned}"`);
    setPhase("processing");
    await executeAgent(cleaned);
    setInputText("");
  }, [executeAgent, cancelListening]);

  //  Handle transcribed text 
  const handleTranscription = useCallback(async (text: string) => {
    const cleaned = (text || "").trim();
    // console.log(`[STT] Transcription: "${cleaned}"`);
    if (!cleaned) {
      setResponseText("I didn't catch that. Please try again.");
      setPhase("idle");
      return;
    }
    setResponseText(`You said: "${cleaned}"`);
    setPhase("processing");
    await executeAgent(cleaned);
  }, [executeAgent]);

  //  Browser SpeechRecognition 
  const startBrowserSTT = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    const lid = ++listenIdRef.current;
    const live = () => lid === listenIdRef.current;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      if (!live()) return;
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      // console.log(`[BrowserSTT] Result: "${transcript}" (confidence: ${confidence})`);
      setPhase("processing");
      handleTranscription(transcript);
    };

    recognition.onspeechend = () => {
      // console.log("[BrowserSTT] Speech ended");
      recognition.stop();
    };

    recognition.onerror = (event: any) => {
      if (!live()) return;
      // console.error("[BrowserSTT] Error:", event.error);
      if (event.error === "no-speech") {
        setResponseText("I didn't hear anything. Please try again.");
      } else if (["network", "service-not-allowed", "language-not-supported"].includes(event.error)) {
        setUseBrowserSTT(false);
        setResponseText("Tap Siri again to talk, or type your question below.");
      } else if (event.error === "not-allowed") {
        setResponseText("Microphone access denied — you can type your question below.");
      } else {
        setResponseText("Speech recognition error. Please try again.");
      }
      setPhase("idle");
    };

    recognition.onend = () => {
      if (!live()) return;
      setPhase((prev) => prev === "recording" ? "idle" : prev);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setPhase("recording");
    setResponseText("");
    // console.log("[BrowserSTT]  Listening...");
  }, [handleTranscription]);

  const stopBrowserSTT = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // console.log("[BrowserSTT]  Stopped");
    }
  }, []);

  //  Whisper fallback 
  const startWhisperSTT = useCallback(async () => {
    const lid = ++listenIdRef.current;
    const live = () => lid === listenIdRef.current;
    try {
      setResponseText("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!live()) return;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setPhase("processing");
        if (blob.size < 1000) {
          setResponseText("I didn't catch that.");
          setPhase("idle");
          return;
        }
        try {
          const text = await transcribeAudio(blob);
          if (live()) await handleTranscription(text);
        } catch (err: any) {
          if (!live()) return;
          setResponseText(
            /\b503\b/.test(String(err?.message))
              ? "Voice isn't set up here yet — type your question below instead."
              : "I couldn't make that out. Try again, or type your question below."
          );
          setPhase("error");
        }
      };

      // --- Voice Activity Detection (VAD) ---
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceStart = Date.now();
      const SILENCE_THRESHOLD = 5; // Low volume threshold (out of 255)
      const SILENCE_DURATION = 2000; // Stop after 2 seconds of silence

      const checkAudioLevel = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > SILENCE_THRESHOLD) {
          // User is speaking, reset silence timer
          silenceStart = Date.now();
        } else {
          // User is quiet, check if we've been quiet long enough
          if (Date.now() - silenceStart > SILENCE_DURATION) {
            // Stop recording!
            // console.log("[Whisper] Auto-stopping due to silence");
            stopWhisperSTT();
            return; // stop loop
          }
        }

        vadLoopRef.current = requestAnimationFrame(checkAudioLevel);
      };

      vadLoopRef.current = requestAnimationFrame(checkAudioLevel);
      // --- End VAD ---

      recorder.start(250);
      recordStartTimeRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      // console.log("[Whisper]  Recording...");
    } catch {
      if (!live()) return;
      setResponseText("Microphone access denied — you can type your question below.");
      setPhase("error");
    }
  }, [handleTranscription]);

  const stopWhisperSTT = useCallback(() => {
    // Stop VAD loop
    if (vadLoopRef.current) {
      cancelAnimationFrame(vadLoopRef.current);
      vadLoopRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const elapsed = Date.now() - recordStartTimeRef.current;
    if (elapsed < 1500) {
      setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 1500 - elapsed);
    } else {
      recorder.stop();
    }
  }, []);

  //  Auto-start on mount 
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // When Siri is opened from the dock, start listening.
      if (phase === "idle") {
        handleClick();
      }
    }

    return () => {
      // Stop the mic when Siri closes.
      cancelListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //  Click handler: play siri.mp3, then start listening 
  const handleClick = useCallback(async () => {
    if (phase === "speaking") {
      stopSpeaking();
    } else if (phase === "recording") {
      // Stop recording
      if (useBrowserSTT) stopBrowserSTT();
      else stopWhisperSTT();
    } else if (phase === "idle" || phase === "error") {

      // Play Siri activation sound, then start listening
      setResponseText("");
      setPhase("recording");
      const lid = listenIdRef.current;
      await playSiriSound();
      // Typed a question (or closed Siri) while the chime was playing.
      if (lid !== listenIdRef.current) return;

      if (useBrowserSTT) startBrowserSTT();
      else await startWhisperSTT();
    }
  }, [phase, useBrowserSTT, startBrowserSTT, stopBrowserSTT, startWhisperSTT, stopWhisperSTT, playSiriSound, stopSpeaking]);

  //  Display 
  let statusText = "";
  if (phase === "recording") statusText = "Listening...";
  else if (phase === "processing") statusText = "Thinking...";
  // While speaking, keep the answer on screen so it can be read along.
  else if (phase === "speaking" && !responseText) statusText = "Speaking...";

  let boxText = responseText;
  if (!boxText && phase === "idle") {
    boxText = `Tap the orb and speak, or type a question — try "What has ${profile.firstName} built?"`;
  }

  const isTypingMode = inputText.length > 0;
  const isAuraActive = phase === "speaking" || phase === "processing" || phase === "recording";

  return (
    <div className="flex items-start justify-end gap-4 relative pointer-events-auto group mt-4 mr-4">
      <audio id="siri-audio" src="/music/siri.mp3" preload="auto" className="hidden" />
      <style>{`
        @keyframes siri-aura-pulse {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        .siri-aura {
          animation: siri-aura-pulse 2s ease-in-out infinite;
        }
        .siri-glass-panel {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(50px) saturate(180%);
          -webkit-backdrop-filter: blur(50px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 0.5px rgba(255, 255, 255, 0.5);
        }
        .dark .siri-glass-panel {
          background: rgba(35, 35, 35, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Box Text (Siri's Response as a Large Glass Panel) */}
      <div
        className={`siri-glass-panel relative z-20 flex flex-col justify-center px-6 py-5 w-[320px] min-h-[120px] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${boxText || statusText ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
          }`}
      >
        {/* Header: title, Stop (while speaking) and the one Close button */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <img src="/img/icons/siri.png" className="w-full h-full object-cover" alt="" />
          </div>
          <span className="text-[13px] font-semibold text-black/60 dark:text-white/60 tracking-wide uppercase">
            Siri
          </span>
          <div className="ml-auto flex items-center gap-2">
            {phase === "speaking" && (
              <button
                onClick={(e) => { e.stopPropagation(); stopSpeaking(); }}
                aria-label="Stop speaking"
                className="flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold bg-black/10 hover:bg-black/15 dark:bg-white/15 dark:hover:bg-white/25 text-black/80 dark:text-white"
              >
                <span className="i-ph:stop-fill" style={{ width: 11, height: 11 }} />
                Stop
              </button>
            )}
            <button
              className="w-6 h-6 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-black/50 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); close(); }}
              aria-label="Close Siri"
              title="Close (Esc)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div
          className="text-black/90 dark:text-white text-[16px] leading-relaxed font-medium tracking-tight font-sans drop-shadow-sm"
        >
          {statusText ? (
             <span className="opacity-60 text-[16px] font-normal">{statusText}</span>
          ) : (
            boxText
          )}
        </div>

        {/* Type to Siri — for visitors who don't want to use the mic */}
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleTextInput(inputText);
          }}
        >
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              // Keep desktop shortcuts out of the text box, but let Esc close Siri.
              e.stopPropagation();
              if (e.key === "Escape") close();
            }}
            placeholder="Ask Siri…"
            aria-label="Ask Siri"
            className="w-full rounded-xl px-3 py-2 text-[14px] outline-none bg-black/5 dark:bg-white/10 text-black/90 dark:text-white placeholder-black/40 dark:placeholder-white/40"
          />
        </form>

      </div>

      {/* The Orb Container */}
      <div className="relative w-[180px] h-[180px] flex items-center justify-center flex-shrink-0">

        {/* Environmental FX Aura underneath the orb */}
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-0">
          <div
            className={`w-[140px] h-[140px] rounded-full mix-blend-screen transition-all duration-700 blur-[20px] ${isAuraActive ? 'siri-aura' : 'opacity-0 scale-90'}`}
            style={{
              background: "radial-gradient(circle at 40% 40%, rgba(60,220,255,0.8) 0%, rgba(200,50,255,0.7) 35%, rgba(255,0,150,0.4) 70%, rgba(0,0,0,0) 100%)",
              boxShadow: "0 0 50px 20px rgba(255, 0, 150, 0.4), inset 0 0 20px 10px rgba(60,220,255,0.5)"
            }}
          />
        </div>

        {/* The Core: Transparent Audio-Reactive Orb */}
        <div
          className="relative z-10 flex justify-center items-center w-[130px] h-[130px] rounded-full cursor-pointer transform hover:scale-105 active:scale-95 transition-transform duration-300"
          onClick={handleClick}
          title={phase === "speaking" ? "Tap to stop" : phase === "recording" ? "Tap to stop listening" : "Tap to speak"}
        >
          {/* Specifically removed white backdrop behind the video */}

          <video
            src="/img/ui/siri2.webm"
            autoPlay
            loop
            muted
            playsInline
            className={`relative z-10 h-[130px] w-[130px] object-contain transition-opacity duration-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${phase === 'idle' ? 'opacity-80' : 'opacity-100'}`}
          />
        </div>

      </div>
    </div>
  );
}
