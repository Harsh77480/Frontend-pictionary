import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";

export default function Lobby({ pushToast }) {
  const socket = useSocket();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);

  function sanitize(input) {
    return String(input).trim().slice(0, 30);
  }

  const createGame = async () => {
  const cleanName = sanitize(name);
  if (!cleanName) return alert("Enter your name");
  setCreating(true);
  socket.emit("createGame", (res) => {
    setCreating(false);
    if (!res.ok) return alert(res.message || "Failed to create");

    // immediately join, same as old JS
    socket.emit("joinGame", { pin: res.pin, name: cleanName }, (joinRes) => {
      if (!joinRes.ok) return alert(joinRes.message || "Failed to join");
      pushToast(`Created & joined game ${res.pin}`);
      navigate(`/game/${res.pin}`, { state: { name: joinRes.name } });
    });
  });
};


  const joinGame = () => {
    const cleanName = sanitize(name);
    const cleanPin = sanitize(pin);
    if (!cleanName || !cleanPin) return alert("Enter name and pin");
    socket.emit("joinGame", { pin: cleanPin, name: cleanName }, (res) => {
      if (!res.ok) return alert(res.message || "Failed to join");
      pushToast(`Joined game ${cleanPin}`);
      navigate(`/game/${cleanPin}`, { state: { name: res.name } });
    });
  };

  return (
    <div className="screen center-card">
      <h1>Pictionary — Lobby</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={createGame} disabled={creating}>
          {creating ? "Creating..." : "Create Game"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Game PIN"
        />
        <button onClick={joinGame}>Join Game</button>
      </div>


    </div>
  );
}
