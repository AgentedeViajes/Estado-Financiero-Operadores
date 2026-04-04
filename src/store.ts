import { useState, useEffect } from 'react';
import { Reservation, DEFAULT_OPERATORS } from './types';
import { supabase } from './lib/supabase';

export function useAppStore() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch operators
      const { data: opsData, error: opsError } = await supabase
        .from('operators')
        .select('name');
      
      if (opsError) {
        console.error("Error fetching operators:", opsError);
        // Fallback to defaults if table doesn't exist yet
        setOperators(DEFAULT_OPERATORS);
      } else if (opsData && opsData.length > 0) {
        setOperators(opsData.map(o => o.name));
      } else {
        setOperators(DEFAULT_OPERATORS);
      }

      // Fetch reservations
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('*');
        
      if (resError) {
        console.error("Error fetching reservations:", resError);
      } else if (resData) {
        setReservations(resData as Reservation[]);
      }
    } catch (error) {
      console.error('Unexpected error fetching data from Supabase:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const addReservation = async (res: Omit<Reservation, 'id' | 'createdAt'>) => {
    const newRes: Reservation = {
      ...res,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    
    // Optimistic update
    setReservations(prev => [...prev, newRes]);
    
    const { error } = await supabase.from('reservations').insert([newRes]);
    if (error) {
      console.error('Error adding reservation to Supabase:', error);
      alert('Hubo un error al guardar la reserva en la base de datos. Por favor, verifica la consola.');
    }
  };

  const updateReservation = async (id: string, updates: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    
    const { error } = await supabase.from('reservations').update(updates).eq('id', id);
    if (error) console.error('Error updating reservation in Supabase:', error);
  };

  const deleteReservation = async (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) console.error('Error deleting reservation in Supabase:', error);
  };

  const togglePaidStatus = async (id: string) => {
    const res = reservations.find(r => r.id === id);
    if (!res) return;
    
    const newStatus = !res.isPaid;
    setReservations(prev => prev.map(r => r.id === id ? { ...r, isPaid: newStatus } : r));
    
    const { error } = await supabase.from('reservations').update({ isPaid: newStatus }).eq('id', id);
    if (error) console.error('Error toggling paid status in Supabase:', error);
  };

  const addOperator = async (operator: string) => {
    const upperOp = operator.toUpperCase();
    if (!operators.includes(upperOp)) {
      setOperators(prev => [...prev, upperOp]);
      
      const { error } = await supabase.from('operators').insert([{ name: upperOp }]);
      if (error) console.error('Error adding operator to Supabase:', error);
    }
  };

  const deleteOperator = async (operator: string) => {
    setOperators(prev => prev.filter(op => op !== operator));
    
    const { error } = await supabase.from('operators').delete().eq('name', operator);
    if (error) console.error('Error deleting operator in Supabase:', error);
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
