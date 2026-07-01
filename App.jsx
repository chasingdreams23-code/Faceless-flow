import { useState, useRef, useEffect } from "react";

const CATEGORIES = [
  { id: "motivational", label: "Motivational / Quotes", emoji: "🔥", color: "#FF6B35" },
  { id: "storytelling", label: "Storytelling / Reddit", emoji: "📖", color: "#7B2FBE" },
  { id: "educational", label: "Educational / Facts", emoji: "🧠", color: "#0EA5E9" },
];

const CONTENT_TYPES = {
  motivational: ["Morning Hype", "Mindset Shift", "Success Quote", "Discipline Talk"],
  storytelling: ["Reddit Story", "True Story", "What Would You Do?", "Confession"],
  educational: ["Did You Know?", "Life Hack", "Money Fact", "Psychology Fact"],
};

const DURATIONS = ["15s", "30s", "60s"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const VOICES = [
  { id: "default", label: "Default" },
  { id: "slow", label: "Slow & Deep" },
  { id: "fast", label: "Fast & Hype" },
  { id: "female", label: "Female" },
];

function Spinner() {
  return (
    <div style={{
      width: 24, height: 24,
      border: "3px solid rgba(255,255,255,0.2)",
      borderTop: "3px solid white",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      margin: "0 auto"
    }} />
  );
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function cleanScriptForSpeech(text) {
  return text
    .replace(/HOOK:|SCRIPT:|CTA:|HASHTAGS:/g, "")
    .replace(/#\w+/g, "")
    .replace(/\(\.\.\.+\)/g, " ")
    .replace(/\[.*?\]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function VoiceoverPlayer({ script, catColor }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("default");
  const [progress, setProgress] = useState(0);
  const [voices, setVoices] = useState([]);
  const [supported, setSupported] = useState(true);
  const uttRef = useRef(null);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const estimatedDurationRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setSupported(false);
      return;
    }
    function loadVoices() {
      try {
        const v = window.speechSynthesis.getVoices() || [];
        setVoices(v);
      } catch (e) {
        setSupported(false);
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { stopSpeech(); };
  }, []);

  useEffect(() => {
    stopSpeech();
    setProgress(0);
  }, [script]);

  function stopSpeech() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    uttRef.current = null;
  }

  function getVoiceSettings(id) {
    switch(id) {
      case "slow": return { rate: 0.75, pitch: 0.85 };
      case "fast": return { rate: 1.4, pitch: 1.1 };
      case "female": return { rate: 1.0, pitch: 1.4 };
      default: return { rate: 1.0, pitch: 1.0 };
    }
  }

  function pickVoice(id) {
    if (!voices.length) return null;
    const eng = voices.filter(v => v.lang.startsWith("en"));
    if (id === "female") {
      return eng.find(v => v.name.toLowerCase().includes("female") || v.name.includes("Samantha") || v.name.includes("Karen") || v.name.includes("Victoria")) || eng[0];
    }
    return eng.find(v => v.name.includes("Google") || v.default) || eng[0] || voices[0];
  }

  function speak() {
    if (!supported || !window.speechSynthesis) return;
    if (isPaused && uttRef.current) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      startProgressTracking();
      return;
    }

    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);

    const cleaned = cleanScriptForSpeech(script);
    const utter = new SpeechSynthesisUtterance(cleaned);
    const settings = getVoiceSettings(selectedVoice);
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    utter.volume = 1;

    const voice = pickVoice(selectedVoice);
    if (voice) utter.voice = voice;

    const wordCount = cleaned.split(" ").length;
    const wordsPerMin = 150 * settings.rate;
    estimatedDurationRef.current = (wordCount / wordsPerMin) * 60 * 1000;

    utter.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startProgressTracking();
    };
    utter.onend = () => {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    };
    utter.onerror = () => {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
      setIsPaused(false);
    };

    uttRef.current = utter;
    try {
      window.speechSynthesis.speak(utter);
    } catch (e) {
      setSupported(false);
    }
  }

  function startProgressTracking() {
    startTimeRef.current = Date.now();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / estimatedDurationRef.current) * 100, 99);
      setProgress(pct);
    }, 200);
  }

  function pause() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.pause();
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setIsPaused(true);
  }

  return (
    <div style={{
      background: "#0d0d1a",
      border: `1px solid ${catColor}44`,
      borderRadius: 14,
      padding: 18,
      marginTop: 16
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: catColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        🎙️ Voiceover Preview
      </div>

      {!supported && (
        <div style={{ padding: "14px", background: "#1a1a2e", borderRadius: 10, marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.6 }}>
            Voice preview isn't available in this browser/sandbox. Copy your script above and paste it into{" "}
            <span style={{ color: catColor, fontWeight: 600 }}>ElevenLabs</span> or your phone's text-to-speech to hear it read aloud.
          </p>
        </div>
      )}

      {supported && (
      <>
      {/* Voice selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {VOICES.map(v => (
          <button key={v.id} onClick={() => { setSelectedVoice(v.id); stopSpeech(); }} style={{
            padding: "5px 12px",
            border: `1.5px solid ${selectedVoice === v.id ? catColor : "#2a2a3a"}`,
            borderRadius: 20,
            background: selectedVoice === v.id ? catColor + "22" : "#111120",
            color: selectedVoice === v.id ? catColor : "#555",
            cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s"
          }}>{v.label}</button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, background: "#1e1e2e", borderRadius: 4, marginBottom: 14, overflow: "hidden"
      }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: `linear-gradient(90deg, ${catColor}, ${catColor}88)`,
          borderRadius: 4, transition: "width 0.2s"
        }} />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={isPlaying ? pause : speak}
          style={{
            flex: 1, padding: "11px 0", border: "none", borderRadius: 10,
            background: isPlaying ? "#2a2a3a" : `linear-gradient(135deg, ${catColor}, ${catColor}99)`,
            color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
          }}
        >
          {isPlaying ? "⏸ Pause" : isPaused ? "▶️ Resume" : "▶️ Play Voiceover"}
        </button>
        {(isPlaying || isPaused || progress > 0) && (
          <button onClick={stopSpeech} style={{
            padding: "11px 16px", border: "1px solid #2a2a3a", borderRadius: 10,
            background: "transparent", color: "#888", fontSize: 14, cursor: "pointer"
          }}>■</button>
        )}
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 11, color: "#444", textAlign: "center" }}>
        Browser TTS preview — use ElevenLabs for final audio
      </p>
      </>
      )}
    </div>
  );
}

function gradientFor(seed) {
  const palettes = [
    ["#1a1a2e", "#7B2FBE"], ["#0f1d2e", "#0EA5E9"], ["#2e1a1a", "#FF6B35"],
    ["#1a2e1f", "#10b981"], ["#2e1a2e", "#ec4899"], ["#1a1a3a", "#6366f1"]
  ];
  const idx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % palettes.length;
  return palettes[idx];
}

function StoryPlayer({ scenes, catColor }) {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const uttRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) setSupported(false);
    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => { stop(); }, [scenes]);

  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrent(0);
  }

  function playFrom(idx) {
    if (!supported || !scenes[idx]) { setIsPlaying(false); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(scenes[idx].caption);
    utter.rate = 1.0;
    utter.onend = () => {
      if (idx + 1 < scenes.length) {
        setCurrent(idx + 1);
        playFrom(idx + 1);
      } else {
        setIsPlaying(false);
      }
    };
    uttRef.current = utter;
    try { window.speechSynthesis.speak(utter); } catch (e) { setSupported(false); }
  }

  function togglePlay() {
    if (isPlaying) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playFrom(current);
    }
  }

  if (!scenes.length) return null;
  const scene = scenes[current];
  const [g1, g2] = gradientFor(scene.imageQuery || scene.caption);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        position: "relative", borderRadius: 16, overflow: "hidden",
        background: `linear-gradient(135deg, ${g1}, ${g2})`,
        aspectRatio: "9/16", maxHeight: 420,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        border: "1px solid #1e1e2e"
      }}>
        <div style={{
          position: "absolute", top: 12, left: 12, right: 12,
          display: "flex", gap: 4
        }}>
          {scenes.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i < current ? catColor : i === current ? catColor + "99" : "rgba(255,255,255,0.2)"
            }} />
          ))}
        </div>
        <div style={{
          position: "absolute", top: 24, left: 12, right: 12,
          fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600
        }}>
          🔍 {scene.imageQuery}
        </div>
        <div style={{ padding: "20px 16px 28px", textAlign: "center" }}>
          <div style={{
            display: "inline-block", background: "rgba(255,255,255,0.95)",
            color: "#111", padding: "10px 16px", borderRadius: 10,
            fontSize: 15, fontWeight: 700, lineHeight: 1.4, maxWidth: "95%"
          }}>
            {scene.caption}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button onClick={togglePlay} style={{
          flex: 1, padding: "12px 0", border: "none", borderRadius: 10,
          background: isPlaying ? "#2a2a3a" : `linear-gradient(135deg, ${catColor}, ${catColor}99)`,
          color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer"
        }}>
          {isPlaying ? "⏸ Pause" : "▶️ Play Story"}
        </button>
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} style={{
          padding: "12px 14px", border: "1px solid #2a2a3a", borderRadius: 10,
          background: "transparent", color: "#888", cursor: "pointer"
        }}>◀</button>
        <button onClick={() => setCurrent(c => Math.min(scenes.length - 1, c + 1))} disabled={current === scenes.length - 1} style={{
          padding: "12px 14px", border: "1px solid #2a2a3a", borderRadius: 10,
          background: "transparent", color: "#888", cursor: "pointer"
        }}>▶</button>
      </div>

      <p style={{ fontSize: 11, color: "#555", textAlign: "center", marginTop: 8 }}>
        Scene {current + 1} of {scenes.length} — search the query above in your photo app, drop it in, then screen-record this player
      </p>

      {!supported && (
        <p style={{ fontSize: 12, color: "#999", textAlign: "center", marginTop: 8 }}>
          Voice preview unsupported here — captions still sync as you tap through.
        </p>
      )}
    </div>
  );
}
export default function App() {
  const [tab, setTab] = useState("script");
  const [category, setCategory] = useState("motivational");
  const [contentType, setContentType] = useState("Morning Hype");
  const [duration, setDuration] = useState("30s");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendar, setCalendar] = useState(null);
  const [copied, setCopied] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [activeDays, setActiveDays] = useState([0,1,2,3,4]);
  const [storyTopic, setStoryTopic] = useState("");
  const [scenes, setScenes] = useState([]);
  const [storyLoading, setStoryLoading] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.id === category);
  const catColor = selectedCat.color;

  async function generateScript() {
    setLoading(true);
    setScript("");
    const secMap = { "15s": "~150 words", "30s": "~250 words", "60s": "~500 words" };
    const prompt = `You are a viral faceless TikTok scriptwriter. Write a ${contentType} script for a ${duration} video (${secMap[duration]}).
Category: ${selectedCat.label}
${topic ? `Topic/angle: ${topic}` : ""}

Format your response EXACTLY like this:
HOOK: [First 3 seconds — attention-grabbing opening line]
SCRIPT:
[Full script with natural pauses marked as (...)]
CTA: [Closing call to action]
HASHTAGS: [5 relevant hashtags]

Make it punchy, emotional, and optimized for faceless TikTok (no face required — voiceover style). No intro fluff, go straight to the hook.`;
    try {
      const result = await callClaude(prompt);
      setScript(result);
    } catch (e) {
      setScript("Error generating script. Please try again.");
    }
    setLoading(false);
  }

  async function generateCalendar() {
    setCalendarLoading(true);
    setCalendar(null);
    const dayNames = activeDays.map(i => DAYS[i]);
    const prompt = `Create a 1-week faceless TikTok content calendar. Respond ONLY with a valid JSON array, no markdown, no explanation.

Settings:
- Active days: ${dayNames.join(", ")}
- Posts per active day: ${postsPerDay}
- Categories to rotate: Motivational/Quotes, Reddit Storytelling, Educational Facts

Each item in the array should have:
{ "day": "Mon", "slot": 1, "category": "Motivational", "type": "Morning Hype", "topic": "short topic idea", "hook": "opening hook line", "time": "post time suggestion" }

Return only the JSON array.`;
    try {
      const result = await callClaude(prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCalendar(parsed);
    } catch (e) {
      setCalendar("error");
    }
    setCalendarLoading(false);
  }

  async function generateStory() {
    setStoryLoading(true);
    setScenes([]);
    const prompt = `Write a faceless TikTok storytelling video (Reddit-style/true story) about: "${storyTopic || "a dramatic true story"}".

Break it into 6-9 short scenes for a slideshow video. Respond ONLY with a valid JSON array, no markdown, no explanation.

Each scene: { "caption": "1-2 sentences of the story shown as on-screen caption text, max 18 words", "imageQuery": "2-4 word stock photo search query that visually matches this scene" }

Make the first scene a strong hook. Keep captions punchy and readable at a glance.`;
    try {
      const result = await callClaude(prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setScenes(parsed);
    } catch (e) {
      setScenes([]);
    }
    setStoryLoading(false);
  }
  function copyScript() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleDay(i) {
    setActiveDays(prev =>
      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort()
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0F",
      color: "#F0F0F5",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "0 0 60px 0"
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0A0A0F 0%, #1a0a2e 100%)",
        padding: "28px 20px 20px",
        borderBottom: "1px solid #1e1e2e"
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ fontSize:28 }}>🎬</span>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, letterSpacing:-0.5 }}>FacelessFlow</h1>
          </div>
          <p style={{ margin:0, fontSize:13, color:"#888", marginLeft:38 }}>
            Script, voiceover preview & content calendar
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 20px 0" }}>
        <div style={{ display:"flex", gap:8, background:"#111120", borderRadius:12, padding:4 }}>
          {["script","story","calendar"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:"10px 0", border:"none", borderRadius:9,
              cursor:"pointer", fontWeight:600, fontSize:13, transition:"all 0.2s",
              background: tab===t ? catColor : "transparent",
              color: tab===t ? "white" : "#666"
            }}>
              {t === "script" ? "✍️ Script" : t === "story" ? "🎞️ Story Mode" : "📅 Calendar"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"20px 20px 0" }}>

        {/* SCRIPT TAB */}
        {tab === "script" && (
          <div className="fade-in">
            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Category</label>
            <div style={{ display:"flex", gap:8, marginTop:8, marginBottom:16 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => { setCategory(c.id); setContentType(CONTENT_TYPES[c.id][0]); }} style={{
                  flex:1, padding:"10px 4px", border:`2px solid ${category===c.id ? c.color : "#1e1e2e"}`,
                  borderRadius:10, background: category===c.id ? c.color+"22" : "#111120",
                  color: category===c.id ? c.color : "#666", cursor:"pointer",
                  fontSize:11, fontWeight:700, transition:"all 0.2s", textAlign:"center"
                }}>
                  <div style={{ fontSize:20, marginBottom:3 }}>{c.emoji}</div>
                  {c.label.split("/")[0].trim()}
                </button>
              ))}
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Video Type</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8, marginBottom:16 }}>
              {CONTENT_TYPES[category].map(t => (
                <button key={t} onClick={() => setContentType(t)} style={{
                  padding:"7px 14px", border:`1.5px solid ${contentType===t ? catColor : "#1e1e2e"}`,
                  borderRadius:20, background: contentType===t ? catColor+"22" : "#111120",
                  color: contentType===t ? catColor : "#555", cursor:"pointer",
                  fontSize:13, fontWeight:600, transition:"all 0.2s"
                }}>{t}</button>
              ))}
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Duration</label>
            <div style={{ display:"flex", gap:8, marginTop:8, marginBottom:16 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)} style={{
                  flex:1, padding:"9px 0", border:`1.5px solid ${duration===d ? catColor : "#1e1e2e"}`,
                  borderRadius:8, background: duration===d ? catColor+"22" : "#111120",
                  color: duration===d ? catColor : "#555", cursor:"pointer",
                  fontSize:14, fontWeight:700, transition:"all 0.2s"
                }}>{d}</button>
              ))}
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Topic / Angle (optional)</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={`e.g. "waking up at 5am changed my life"`}
              style={{
                width:"100%", marginTop:8, marginBottom:16, padding:"12px 14px",
                background:"#111120", border:"1.5px solid #1e1e2e", borderRadius:10,
                color:"#F0F0F5", fontSize:14, outline:"none", fontFamily:"inherit"
              }}
            />

            <button onClick={generateScript} disabled={loading} style={{
              width:"100%", padding:"14px 0", border:"none", borderRadius:12,
              background: loading ? "#333" : `linear-gradient(135deg, ${catColor}, ${catColor}99)`,
              color:"white", fontSize:16, fontWeight:700, cursor: loading ? "default" : "pointer",
              transition:"all 0.2s", marginBottom:20
            }}>
              {loading ? <Spinner /> : "⚡ Generate Script"}
            </button>

            {script && (
              <div className="fade-in">
                <div style={{
                  background:"#111120", border:"1px solid #1e1e2e",
                  borderRadius:14, padding:20, marginBottom:4
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <span style={{ fontWeight:700, fontSize:15, color: catColor }}>Your Script</span>
                    <button onClick={copyScript} style={{
                      padding:"6px 14px", border:`1px solid ${catColor}`, borderRadius:8,
                      background:"transparent", color: catColor, cursor:"pointer", fontSize:12, fontWeight:600
                    }}>
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre style={{
                    margin:0, whiteSpace:"pre-wrap", fontSize:13, lineHeight:1.7,
                    color:"#ccc", fontFamily:"inherit"
                  }}>{script}</pre>
                </div>

                <VoiceoverPlayer script={script} catColor={catColor} />
              </div>
            )}
          </div>
        )}

        {/* STORY MODE TAB */}
        {tab === "story" && (
          <div className="fade-in">
            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>
              Story Topic
            </label>
            <input
              value={storyTopic}
              onChange={e => setStoryTopic(e.target.value)}
              placeholder={`e.g. "my coworker took credit for my work"`}
              style={{
                width:"100%", marginTop:8, marginBottom:16, padding:"12px 14px",
                background:"#111120", border:"1.5px solid #1e1e2e", borderRadius:10,
                color:"#F0F0F5", fontSize:14, outline:"none", fontFamily:"inherit"
              }}
            />

            <button onClick={generateStory} disabled={storyLoading} style={{
              width:"100%", padding:"14px 0", border:"none", borderRadius:12,
              background: storyLoading ? "#333" : "linear-gradient(135deg, #7B2FBE, #7B2FBE99)",
              color:"white", fontSize:16, fontWeight:700, cursor: storyLoading ? "default" : "pointer",
              transition:"all 0.2s", marginBottom:8
            }}>
              {storyLoading ? <Spinner /> : "🎬 Build Story Scenes"}
            </button>

            <p style={{ fontSize:12, color:"#555", textAlign:"center", margin:"0 0 16px" }}>
              Breaks your story into scenes with image search terms + synced captions
            </p>

            {scenes.length > 0 && <StoryPlayer scenes={scenes} catColor="#7B2FBE" />}
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab === "calendar" && (
          <div className="fade-in">
            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Active Days</label>
            <div style={{ display:"flex", gap:6, marginTop:8, marginBottom:16 }}>
              {DAYS.map((d,i) => (
                <button key={d} onClick={() => toggleDay(i)} style={{
                  flex:1, padding:"9px 0", border:`1.5px solid ${activeDays.includes(i) ? "#FF6B35" : "#1e1e2e"}`,
                  borderRadius:8, background: activeDays.includes(i) ? "#FF6B3522" : "#111120",
                  color: activeDays.includes(i) ? "#FF6B35" : "#555",
                  cursor:"pointer", fontSize:11, fontWeight:700, transition:"all 0.2s"
                }}>{d}</button>
              ))}
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:1 }}>Posts Per Day</label>
            <div style={{ display:"flex", gap:8, marginTop:8, marginBottom:20 }}>
              {[1,2,3].map(n => (
                <button key={n} onClick={() => setPostsPerDay(n)} style={{
                  flex:1, padding:"10px 0", border:`1.5px solid ${postsPerDay===n ? "#FF6B35" : "#1e1e2e"}`,
                  borderRadius:8, background: postsPerDay===n ? "#FF6B3522" : "#111120",
                  color: postsPerDay===n ? "#FF6B35" : "#555",
                  cursor:"pointer", fontSize:15, fontWeight:700, transition:"all 0.2s"
                }}>{n}x</button>
              ))}
            </div>

            <button onClick={generateCalendar} disabled={calendarLoading} style={{
              width:"100%", padding:"14px 0", border:"none", borderRadius:12,
              background: calendarLoading ? "#333" : "linear-gradient(135deg, #FF6B35, #7B2FBE)",
              color:"white", fontSize:16, fontWeight:700, cursor: calendarLoading ? "default" : "pointer",
              transition:"all 0.2s", marginBottom:24
            }}>
              {calendarLoading ? <Spinner /> : "📅 Generate My Week"}
            </button>

            {calendar === "error" && (
              <p style={{ color:"#f66", textAlign:"center" }}>Something went wrong. Try again.</p>
            )}

            {Array.isArray(calendar) && (
              <div className="fade-in">
                {DAYS.filter((_,i) => activeDays.includes(i)).map(day => {
                  const posts = calendar.filter(p => p.day === day);
                  if (!posts.length) return null;
                  return (
                    <div key={day} style={{ marginBottom:16 }}>
                      <div style={{
                        fontSize:12, fontWeight:700, color:"#888",
                        textTransform:"uppercase", letterSpacing:1,
                        marginBottom:8, paddingLeft:4
                      }}>{day}</div>
                      {posts.map((post, idx) => {
                        const color = idx === 0 ? "#FF6B35" : idx === 1 ? "#7B2FBE" : "#0EA5E9";
                        return (
                          <div key={idx} style={{
                            background:"#111120", border:`1px solid #1e1e2e`,
                            borderLeft: `3px solid ${color}`,
                            borderRadius:10, padding:"12px 14px", marginBottom:8
                          }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                              <span style={{ fontSize:12, fontWeight:700, color }}>{post.type || post.category}</span>
                              <span style={{ fontSize:11, color:"#555" }}>{post.time}</span>
                            </div>
                            <div style={{ fontSize:14, fontWeight:600, color:"#e0e0e0", marginBottom:4 }}>{post.topic}</div>
                            <div style={{ fontSize:12, color:"#777", fontStyle:"italic" }}>Hook: "{post.hook}"</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
