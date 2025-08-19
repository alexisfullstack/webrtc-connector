import React from "react";

export default function VotePanel({ left, right, disabled, onVote }) {
  return (
    <div className="grid">
      <button
        className="btn btn-primary"
        disabled={disabled || !left}
        onClick={() => onVote("left")}
      >
        {left ? `Vote: ${capitalize(left.name)}` : "..."}
      </button>
      <button
        className="btn btn-success"
        disabled={disabled || !right}
        onClick={() => onVote("right")}
      >
        {right ? `Vote: ${capitalize(right.name)}` : "..."}
      </button>
    </div>
  );
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
