import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";

export default function Chat({ name, pushToast }) {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const onChat = (d) => {
      const from = d?.from ?? "Anonymous";
      const txt = String(d?.message ?? "");
      setMessages((m) => [...m, { from, text: txt }].slice(-300));
      if (d?.system) pushToast?.(txt);
      setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 10);
    };
    socket.on("chatMessage", onChat);
    return () => {
      socket.off("chatMessage", onChat);
    };
  }, [socket, pushToast]);

  function sendMessage() {
  const raw = inputRef.current?.value ?? "";
  let text = String(raw).trim().slice(0, 300);

  // Strip zero-width and invisible unicode
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");

  if (!text) return;
  socket?.emit("chatMessage", { message: text });
  inputRef.current.value = "";
}


  return (
    <div className="chatbox card">
      <div className="chat-header">Chat</div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className="chat-line">
            <strong className="chat-from">{m.from}: </strong>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          ref={inputRef}
          placeholder="Type a guess or message (Enter to send)"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
