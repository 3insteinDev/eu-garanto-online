import { useState } from 'react';

export function usePlayerId(): string {
  const [id] = useState(() => {
    const stored = localStorage.getItem('eu_garanto_player_id');
    if (stored) return stored;
    const newId = `player_${crypto.randomUUID().slice(0, 12)}`;
    localStorage.setItem('eu_garanto_player_id', newId);
    return newId;
  });
  return id;
}

export function usePlayerName(): [string, (name: string) => void] {
  const [name, setNameState] = useState(() => {
    return localStorage.getItem('eu_garanto_player_name') || '';
  });

  const setName = (n: string) => {
    localStorage.setItem('eu_garanto_player_name', n);
    setNameState(n);
  };

  return [name, setName];
}
