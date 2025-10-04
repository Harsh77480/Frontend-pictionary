import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "./contexts/SocketContext";
import CanvasBoard from "./components/CanvasBoard";
import Chat from "./components/Chat";
import Scoreboard from "./components/Scoreboard";
import Toasts from "./components/Toasts";
import Modal from "./components/Modal";
import ReCAPTCHA from "react-google-recaptcha"; // Import the reCAPTCHA component

/**
 * App.jsx
 * - Handles lobby <> game flow
 * - Centralizes server-level socket handlers for non-drawing events
 * - Small, secure helpers (sanitize)
 */

function sanitizeName(s) {
  return String(s || "").trim().slice(0, 30);
}

export default function App() {
  const socket = useSocket();

  // lobby / game screens
  const [screen, setScreen] = useState("lobby"); // 'lobby' | 'game'
  const [name, setName] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [currentPin, setCurrentPin] = useState(null);
  const [currentName, setCurrentName] = useState(null);
  const [recaptchaValue, setRecaptchaValue] = useState(null);

  // game state derived from server
  const [isDrawer, setIsDrawer] = useState(false);
  const [drawerName, setDrawerName] = useState(null);
  const [currentWord, setCurrentWord] = useState(null);
  const [scores, setScores] = useState({});
  const [timerText, setTimerText] = useState("--");
  const [connected, setConnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // UI helpers
  const [toasts, setToasts] = useState([]);
  const pushToast = useCallback((text, ttl = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }, []);
  const removeToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Game over modal
  const [gameOverData, setGameOverData] = useState(null);

  // wire up generic socket listeners (non-drawing)
  useEffect(() => {
    if (!socket) return;
    const s = socket;

    
    const onConnect = () => {pushToast("Connected");setConnected(true);}
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => pushToast("Connection error", 5000);

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);

    s.on("lobbyUpdate", (data) => {
      // validate server payload shape safely
      const players = Array.isArray(data?.players) ? data.players : [];
      const host = data?.host ?? null;
      pushToast(`Players: ${players.join(", ")}${host ? " | Host: " + host : ""}`);
    });

    s.on("gameStarted", () => {pushToast("Game started"),setGameStarted(true)});

    s.on("roundStarted", (data) => {
  setIsDrawer(false);
  setCurrentWord(null);
  setDrawerName(data?.drawerName ?? null);

  const dur = Number(data?.roundDurationMs) || 60000; // default 60s
  let secs = Math.ceil(dur / 1000);
  setTimerText(`${secs}s`);

  // clear any previous interval
  if (window._roundTimer) clearInterval(window._roundTimer);

  // start countdown
  window._roundTimer = setInterval(() => {
    secs -= 1;
    if (secs <= 0) {
      setTimerText("0s");
      clearInterval(window._roundTimer);
      window._roundTimer = null;
    } else {
      setTimerText(`${secs}s`);
    }
  }, 1000);

  pushToast(`Round ${data?.round ?? "?"} started — drawer: ${data?.drawerName ?? "?"}`);
});


    s.on("wordToDraw", (data) => {
      // show word to drawer (not in chat)
      setIsDrawer(true);
      setCurrentWord(String(data?.word ?? ""));
      pushToast("You are the drawer — word shown");
    });

    s.on("roundEnded", (data) => {
  setCurrentWord(null);
  setIsDrawer(false);
  setScores(data?.scores ?? {});
  setTimerText("--");
  if (window._roundTimer) {
    clearInterval(window._roundTimer);
    window._roundTimer = null;
  }
  pushToast(`Round ended. Word: ${data?.word ?? "?"}`);
});

    s.on("scoreboard", (data) => setScores(data?.scores ?? {}));

    s.on("gameOver", (data) => {
      const scoreboard = data?.scores ?? {};
      setScores(scoreboard);
      setTimerText("--");
  if (window._roundTimer) {
    clearInterval(window._roundTimer);
    window._roundTimer = null;
  }
      // compute winner(s)
      let best = -Infinity;
      let winners = [];
      for (const [n, sc] of Object.entries(scoreboard)) {
        const num = Number(sc) || 0;
        if (num > best) { best = num; winners = [n]; }
        else if (num === best) winners.push(n);
      }
      setGameOverData({ winners, scores: scoreboard });
      pushToast("Game over");
    });

    s.on("errorMessage", (d) => pushToast(String(d?.message ?? "Error from server"), 5000));

    return () => {
      s.off("connect", onConnect);
      s.off("connect_error", onConnectError);
      s.off("lobbyUpdate");
      s.off("gameStarted");
      s.off("roundStarted");
      s.off("wordToDraw");
      s.off("roundEnded");
      s.off("scoreboard");
      s.off("gameOver");
      s.off("errorMessage");
    };
  }, [socket, pushToast]);

  // lobby actions
  const createGame = useCallback(() => {
  const nm = sanitizeName(name);
  if (!nm) return alert("Enter a name");
  if (!socket) return alert("Socket not ready");
  if (!recaptchaValue) return alert("Please complete the reCAPTCHA");

  socket.emit("createGame", { recaptchaToken: recaptchaValue }, (res) => {
    if (!res?.ok) return alert(res?.message || "Create failed");
    socket.emit("joinGame", { pin: res.pin, name: nm }, (jr) => {
      if (!jr?.ok) return alert(jr?.message || "Join failed");
      setCurrentPin(res.pin);
      setCurrentName(jr.name ?? nm);
      setScreen("game");
      pushToast(`Created and joined ${res.pin}`);
    });
  });
}, [socket, name, recaptchaValue, pushToast]);

  const joinGame = useCallback(() => {
  const nm = sanitizeName(name);
  const pin = String(pinInput || "").trim();
  if (!nm || !pin) return alert("Enter name and PIN");
  if (!socket) return alert("Socket not ready");
  if (!recaptchaValue) return alert("Please complete the reCAPTCHA");

  socket.emit("joinGame", { pin, name: nm, recaptchaToken: recaptchaValue }, (res) => {
    if (!res?.ok) return alert(res?.message || "Join failed");
    setCurrentPin(pin);
    setCurrentName(res.name ?? nm);
    setScreen("game");
    pushToast(`Joined ${pin}`);
  });
}, [socket, name, pinInput, recaptchaValue, pushToast]);

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit("startGame", {}, (res) => {
      if (!res?.ok) alert(res?.message || "Failed to start");
    });
  }, [socket]);

  // compute winner label for modal
  const winnerLabel = useMemo(() => {
    if (!gameOverData) return null;
    if (!gameOverData.winners || gameOverData.winners.length === 0) return "No winner";
    if (gameOverData.winners.length === 1) return gameOverData.winners[0];
    return gameOverData.winners.join(", ");
  }, [gameOverData]);

  if (!connected) {
  return (
    <div className="loading-screen">
      <h1>Pictionary 🎨</h1>
      <p>Connecting to game server...</p>
    </div>
  );
  }
  return (
    <div className="app-root">
      <header className="app-header">
        {/* <h1 className="animated-title">Pictionary 🎨</h1> */}
        <h1 className="animated-title">
  {"Pictionary".split("").map((ch, i) => (
    <span key={i} style={{ animationDelay: `${i * 0.1}s` }}>
      {ch}
    </span>
  ))}
</h1> 

        <div className="meta">Timer: <strong>{timerText}</strong></div>
      </header>

      

      {screen === "lobby" && (
      <main className="lobby card">
        <h2>Lobby</h2>
        <div className="join-row">
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        {/* <div className="actions"> */}
          <button onClick={createGame}>Create Game</button>
        </div>

        <div className="join-row">
          <input placeholder="Game PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value)} />
          <button onClick={joinGame}>Join Game</button>
        </div>

        {/* Add the reCAPTCHA widget here */}
        <div className="actions">
        <ReCAPTCHA
          hl="en"
          sitekey={import.meta.env.VITE_SITE_KEY} // Replace with your Google reCAPTCHA site key
          onChange={(value) => setRecaptchaValue(value)} // Handle recaptcha response
        />
        </div>

        {/* 🎯 Simple 3-step guide */}
<div className="lobby-guide">
  <h3>How to Play</h3>
  <ol>
    <li>Create a game to get a game code.</li>
    <li>Share the code with your friends.</li>
    <li>Join with that code and start playing!</li>
  </ol>
</div>

      </main>
      )}

      {screen === "game" && (
        <main className="game-grid">
          <section className="canvas-card">
            <div className="game-top">
              <div className="game-title">Game <strong>{currentPin}</strong> — You are <strong>{currentName}</strong></div>
              <div>
               { gameStarted ? <></> : <button onClick={startGame} > <h5> Start Game (host) </h5></button> } 
              </div>
            </div>

            <div className="word-row">
              {isDrawer ? <div className="word-card">Your word: <span className="word">{currentWord || "—"}</span></div>
                        : <div className="muted">Drawer: {drawerName || "—"}</div>}
            </div>

            <CanvasBoard isDrawer={isDrawer} pushToast={pushToast} />
          </section>

          <aside className="sidebar">
            <Scoreboard scores={scores} drawerName={drawerName} />
            <Chat name={currentName} pushToast={pushToast} />
          </aside>
        </main>
      )}

      <Toasts toasts={toasts} removeToast={removeToast} />

      <Modal open={!!gameOverData} onClose={() => setGameOverData(null)}>
        <h2>Game Over 🎉</h2>
        <p>Winner: <strong>{winnerLabel}</strong></p>
        <h4>Final scores</h4>
        <ul className="modal-scores">
          {gameOverData && Object.entries(gameOverData.scores).map(([n, s]) => <li key={n}>{n}: {s}</li>)}
        </ul>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setGameOverData(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
