import { useState, useEffect } from 'react';
import { Reservation, DEFAULT_OPERATORS } from './types';

export function useAppStore() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [operators, setOperators] = useState<string[]>(DEFAULT_OPERATORS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedReservations = localStorage.getItem('reservations');
    const storedOperators = localStorage.getItem('operators');

    if (storedReservations) {
      try {
        setReservations(JSON.parse(storedReservations));
      } catch (e) {
        console.error("Failed to parse reservations", e);
      }
    }

    if (storedOperators) {
      try {
        setOperators(JSON.parse(storedOperators));
      } catch (e) {
        console.error("Failed to parse operators", e);
      }
    } else {
      setOperators(DEFAULT_OPERATORS);
    }
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('reservations', JSON.stringify(reservations));
    }
  }, [reservations, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('operators', JSON.stringify(operators));
    }
  }, [operators, isLoaded]);

  const addReservation = (res: Omit<Reservation, 'id' | 'createdAt'>) => {
    const newRes: Reservation = {
      ...res,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setReservations(prev => [...prev, newRes]);
  };

  const updateReservation = (id: string, updates: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteReservation = (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
  };

  const togglePaidStatus = (id: string) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, isPaid: !r.isPaid } : r));
  };

  const addOperator = (operator: string) => {
    if (!operators.includes(operator.toUpperCase())) {
      setOperators(prev => [...prev, operator.toUpperCase()]);
    }
  };

  const deleteOperator = (operator: string) => {
    setOperators(prev => prev.filter(op => op !== operator));
  };

  return {
    reservations,
    operators,
    addReservation,
    updateReservation,
    deleteReservation,
    togglePaidStatus,
    addOperator,
    deleteOperator,
    isLoaded
  };
}
