import { useState, useRef, useEffect } from "react";
import { api } from "../utils/api";

export default function Chatbot() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat]       = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading, open]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMsg = message.trim();
    setChat(prev => [...prev, { sender: "user", text: userMsg }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/chatbot/chat", { message: userMsg });
      setChat(prev => [...prev, { sender: "bot", text: res.data.reply }]);
    } catch (err) {
      const serverReply =
        err?.response?.data?.reply ||
        err?.response?.data?.error?.message ||
        "Something went wrong. Please try again.";
      setChat(prev => [...prev, { sender: "bot", text: serverReply }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle AI chat"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all ring-4 ring-emerald-900/30"
      >
        {open ? (
          // X icon
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Chat bubble icon
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-80 sm:w-96 flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-700/40 border border-emerald-600/40 flex items-center justify-center text-emerald-400 text-sm">
                🤖
              </div>
              <div>
                <div className="text-sm font-bold text-white">Vedalaya AI</div>
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  Online
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 h-72 overflow-y-auto px-4 py-4 space-y-3 bg-slate-900/80">
            {chat.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-700/20 border border-emerald-600/30 flex items-center justify-center text-2xl">
                  🤖
                </div>
                <p className="text-slate-400 text-sm">Hi! I'm Vedalaya AI.<br />Ask me anything about the platform.</p>
              </div>
            )}

            {chat.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-emerald-700/30 border border-emerald-600/30 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0">
                    🤖
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm max-w-[78%] leading-relaxed whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-emerald-700 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-emerald-700/30 border border-emerald-600/30 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0">
                  🤖
                </div>
                <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-slate-800 border-t border-slate-700 flex gap-2 items-end">
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask something…"
              disabled={loading}
              className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-400 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !message.trim()}
              className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center transition-all shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>

        </div>
      )}
    </>
  );
}
