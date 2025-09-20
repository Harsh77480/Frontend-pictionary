import React from "react";

export default function Scoreboard({ scores = {}, drawerName }) {
  const entries = Object.entries(scores).sort((a, b) => (b[1] || 0) - (a[1] || 0));

  return (
    <div className="scoreboard card">
      <h3>Scoreboard</h3>
      <table className="score-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">No scores yet</td>
            </tr>
          ) : (
            entries.map(([name, score]) => (
              <tr key={name} className={name === drawerName ? "drawer" : ""}>
                <td>{name}</td>
                <td>{score}</td>
                <td>{name === drawerName ? "Drawer" : "Guesser"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
