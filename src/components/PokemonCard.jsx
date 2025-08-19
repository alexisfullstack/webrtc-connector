import React from "react";

export default function PokemonCard({ pokemon, isWinner = false }) {
  if (!pokemon) {
    return null;
  }
    
  return (
    <div className={`card ${isWinner ? "winner" : ""}`}>
      <div className="pokemon">
        <img src={pokemon.sprite} alt={pokemon.name} />
        <div>
          <div className="title" style={{ textTransform: "capitalize" }}>
            {pokemon.name}
          </div>
          <div className="row">
            <span className="stat">Weight</span>
            <b>{pokemon.weight}</b>
          </div>
          <div className="row">
            <span className="stat">Height</span>
            <b>{pokemon.height}</b>
          </div>
          <div className="row">
            <span className="stat">Base XP</span>
            <b>{pokemon.base_experience}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
