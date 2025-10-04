// import React, { useEffect, useState, useRef } from "react";
// import { useParams, useLocation, useNavigate } from "react-router-dom";
// import { useSocket } from "../contexts/SocketContext";
// import CanvasBoard from "../components/CanvasBoard";
// import Chat from "../components/Chat";
// import Scoreboard from "../components/Scoreboard";

// /* Top bar with timer and start button */
// function TopBar({ timerText, isHost, onStart }) {
//   return (
//     <div id="top-bar" className="top-bar">
//       <div className="top-left">
//         <strong id="game-title">Pictionary</strong>
//         <div className="muted">Timer: {timerText}</div>
//       </div>
//       <div className="top-right">
//         {isHost ? <button onClick={onStart}>Start Game</button> : <div className="muted">Waiting for host</div>}
//       </div>
//     </div>
//   );
// }

// export default function Game({ pushToast }) {
//   const socket = useSocket();
//   const { pin } = useParams();
//   const location = useLocation();
//   const navigate = useNavigate();
//   const initialName = (location.state && location.state.name) || "";
//   const [name, setName] = useState(initialName);
//   const [connectedPlayers, setConnectedPlayers] = useState([]);
//   const [isHost, setIsHost] = useState(false);
//   const [timerText, setTimerText] = useState("--");
//   const [scores, setScores] = useState({});
//   const [isDrawer, setIsDrawer] = useState(false);
//   const [drawerName, setDrawerName] = useState(null);
//   const [currentWord, setCurrentWord] = useState(null);
//   const [round, setRound] = useState({ current: 0, totalRounds: 0 });

//   const nameRef = useRef(name);
//   nameRef.current = name;

//   // join if we have name/pin, else redirect back
//   useEffect(() => {
//     if (!pin) return navigate("/", { replace: true });
//     if (!name) {
//       // ask for name (simple prompt fallback)
//       const nm = prompt("Enter your display name:");
//       if (!nm) return navigate("/", { replace: true });
//       setName(nm.slice(0, 30));
//       socket.emit("joinGame", { pin, name: nm.slice(0, 30) }, (res) => {
//         if (!res.ok) { alert(res.message || "Failed to join"); navigate("/", { replace: true }); }
//         else pushToast(`Joined ${pin}`);
//       });
//     } else {
//       socket.emit("joinGame", { pin, name }, (res) => {
//         if (!res.ok) { alert(res.message || "Failed to join"); navigate("/", { replace: true }); }
//       });
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [pin]);

//   useEffect(() => {
//     // socket listeners
//     socket.on("lobbyUpdate", (data) => {
//       setConnectedPlayers(data.players || []);
//       setIsHost(Boolean(data.host === nameRef.current));
//     });

//     socket.on("gameStarted", () => pushToast("Game started"));
//     socket.on("roundStarted", (data) => {
//       setIsDrawer(false);
//       setDrawerName(data.drawerName);
//       setRound({ current: data.round, totalRounds: data.totalRounds || 0 });
//       // time is handled inside Canvas via startTimer event also, but we show text here
//       setTimerText(`${Math.ceil((data.roundDurationMs || 0) / 1000)}s`);
//       pushToast(`Round ${data.round} started — drawer: ${data.drawerName}`);
//     });

//     socket.on("wordToDraw", (data) => {
//       setIsDrawer(true);
//       setCurrentWord(data.word);
//       pushToast("You are the drawer — your word is shown below (not in chat).");
//     });

//     socket.on("roundEnded", (data) => {
//       setCurrentWord(null);
//       setIsDrawer(false);
//       setScores(data.scores || {});
//       pushToast(`Round ended. Word: ${data.word}`);
//     });

//     socket.on("scoreboard", (data) => setScores(data.scores || {}));
//     socket.on("gameOver", (data) => {
//       setScores(data.scores || {});
//       pushToast("Game over");
//     });

//     socket.on("systemMessage", (data) => pushToast(String(data.message || "System event")));

//     socket.on("timerTick", (data) => {
//       // optional server-driven ticks
//       if (data && typeof data.remainingMs === "number") {
//         setTimerText(`${Math.ceil(data.remainingMs / 1000)}s`);
//       }
//     });

//     socket.on("disconnect", () => pushToast("Disconnected from server", 3000));

//     return () => {
//       socket.off("lobbyUpdate");
//       socket.off("gameStarted");
//       socket.off("roundStarted");
//       socket.off("wordToDraw");
//       socket.off("roundEnded");
//       socket.off("scoreboard");
//       socket.off("gameOver");
//       socket.off("systemMessage");
//       socket.off("timerTick");
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [socket]);

//   const handleStart = () => {
//     socket.emit("startGame", {}, (res) => {
//       if (!res.ok) alert(res.message || "Failed to start");
//     });
//   };

//   return (
//     <div className="game-screen">
//       <TopBar timerText={timerText} isHost={isHost} onStart={handleStart} />
//       <div className="game-body">
//         <CanvasBoard
//           pin={pin}
//           name={name}
//           isDrawer={isDrawer}
//           currentWord={currentWord}
//           socket={socket}
//           pushToast={pushToast}
//         />

//         <aside className="sidebar">
//           <div className="word-card">
//             {isDrawer ? (
//               <>
//                 <div className="muted">You are drawing:</div>
//                 <div className="big-word">{currentWord || "—"}</div>
//               </>
//             ) : (
//               <>
//                 <div className="muted">Drawer:</div>
//                 <div>{drawerName || "—"}</div>
//               </>
//             )}
//           </div>

//           <Scoreboard scores={scores} drawerName={drawerName} />
//           <Chat socket={socket} name={name} />
//         </aside>
//       </div>
//     </div>
//   );
// }
