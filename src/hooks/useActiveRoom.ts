import { useState, useEffect } from 'react';

const STORAGE_KEY = 'eu_garanto_active_room';

interface ActiveRoom {
  roomId: string;
  roomCode: string;
}

export function useActiveRoom() {
  const [activeRoom, setActiveRoomState] = useState<ActiveRoom | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveRoom = (room: ActiveRoom | null) => {
    if (room) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setActiveRoomState(room);
  };

  return { activeRoom, setActiveRoom };
}
