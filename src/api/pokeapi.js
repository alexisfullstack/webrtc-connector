const API = "https://pokeapi.co/api/v2/pokemon";

export async function getPokemon(nameOrId) {
  const res = await fetch(`${API}/${nameOrId}`);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch ${nameOrId}: ${res.status}`);
  }
  
  const data = await res.json();
  
  return {
    id: data.id,
    name: data.name,
    sprite:
      data.sprites.other?.["official-artwork"]?.front_default ||
      data.sprites.front_default,
    weight: data.weight,
    height: data.height,
    base_experience: data.base_experience,
  };
}

export async function getTwoRandom() {
  const a = 1 + Math.floor(Math.random() * 151);
  let b = 1 + Math.floor(Math.random() * 151);
  
  while (b === a) {
    b = 1 + Math.floor(Math.random() * 151);
  }

  const [one, two] = await Promise.all([getPokemon(a), getPokemon(b)]);
  
  return [one, two];
}
