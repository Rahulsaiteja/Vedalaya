import { useState } from "react";
import { api } from "../utils/api";

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const newChat = [...chat, { sender: "user", text: message }];
    setChat(newChat);
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/chatbot/chat", { message });

      setChat([
        ...newChat,
        { sender: "bot", text: res.data.reply }
      ]);
    } catch (err) {
      console.error(err);
      const serverReply =
        err?.response?.data?.reply ||
        err?.response?.data?.error?.message ||
        err?.message;
      setChat([
        ...newChat,
        { sender: "bot", text: serverReply || "Error connecting to chatbot" }
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      {/* 🔵 Floating Button */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          fontSize: "24px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
          zIndex: 1000
        }}
      >
        💬
      </div>

      {/* 💬 Chat Window */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: "320px",
            height: "420px",
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1000
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              padding: "10px",
              fontWeight: "bold"
            }}
          >
            Vedalaya AI 🤖
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "10px",
              overflowY: "auto",
              backgroundColor: "#f1f5f9"
            }}
          >
            {chat.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.sender === "user" ? "flex-end" : "flex-start",
                  marginBottom: "8px"
                }}
              >
                <div
                  style={{
                    backgroundColor:
                      msg.sender === "user" ? "#2563eb" : "#e5e7eb",
                    color: msg.sender === "user" ? "white" : "black",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    maxWidth: "70%"
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ fontSize: "12px", color: "gray" }}>
                Bot is typing...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: "flex", borderTop: "1px solid #ddd" }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask something..."
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                outline: "none"
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                padding: "10px 15px",
                cursor: "pointer"
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}