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
        alert(`Error al cargar operadores: ${opsError.message}`);
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
        alert(`Error al cargar reservas: ${resError.message}`);
      } else if (resData) {
        setReservations(resData as Reservation[]);
      }
    } catch (error: any) {
      console.error('Unexpected error fetching data from Supabase:', error);
      alert(`Error inesperado de conexión: ${error.message || 'Desconocido'}`);
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
      alert(`Error al guardar la reserva en Supabase:\n${error.message}\n\nDetalles: ${error.details || 'N/A'}`);
      // Revert optimistic update on error
      setReservations(prev => prev.filter(r => r.id !== newRes.id));
    }
  };

  const batchAddReservations = async (newReservations: Omit<Reservation, 'id' | 'createdAt'>[]) => {
    const toInsert: Reservation[] = newReservations.map(res => ({
      ...res,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }));
    
    // Optimistic update
    setReservations(prev => [...prev, ...toInsert]);
    
    const { error } = await supabase.from('reservations').insert(toInsert);
    if (error) {
      console.error('Error batch adding reservations to Supabase:', error);
      alert(`Error al guardar las reservas importadas en Supabase:\n${error.message}`);
      // Revert optimistic update on error
      const idsToRemove = toInsert.map(r => r.id);
      setReservations(prev => prev.filter(r => !idsToRemove.includes(r.id)));
      throw error;
    }
  };

  const updateReservation = async (id: string, updates: Partial<Reservation>) => {
    const previousReservations = [...reservations];
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    
    const { error } = await supabase.from('reservations').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating reservation in Supabase:', error);
      alert(`Error al actualizar en Supabase: ${error.message}`);
      setReservations(previousReservations);
    }
  };

  const deleteReservation = async (id: string) => {
    const previousReservations = [...reservations];
    setReservations(prev => prev.filter(r => r.id !== id));
    
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) {
      console.error('Error deleting reservation in Supabase:', error);
      alert(`Error al eliminar en Supabase: ${error.message}`);
      setReservations(previousReservations);
    }
  };

  const batchDeleteReservations = async (ids: string[]) => {
    const previousReservations = [...reservations];
    setReservations(prev => prev.filter(r => !ids.includes(r.id)));
    
    const { error } = await supabase.from('reservations').delete().in('id', ids);
    if (error) {
      console.error('Error batch deleting reservations in Supabase:', error);
      alert(`Error al eliminar reservas: ${error.message}`);
      setReservations(previousReservations);
    }
  };

  const togglePaidStatus = async (id: string) => {
    const res = reservations.find(r => r.id === id);
    if (!res) return;
    
    const newStatus = !res.isPaid;
    const previousReservations = [...reservations];
    
    setReservations(prev => prev.map(r => r.id === id ? { ...r, isPaid: newStatus } : r));
    
    const { error } = await supabase.from('reservations').update({ isPaid: newStatus }).eq('id', id);
    if (error) {
      console.error('Error toggling paid status in Supabase:', error);
      alert(`Error al actualizar estado de pago: ${error.message}`);
      setReservations(previousReservations);
    }
  };

  const addOperator = async (operator: string) => {
    const upperOp = operator.toUpperCase();
    if (!operators.includes(upperOp)) {
      const previousOperators = [...operators];
      setOperators(prev => [...prev, upperOp]);
      
      const { error } = await supabase.from('operators').insert([{ name: upperOp }]);
      if (error) {
        console.error('Error adding operator to Supabase:', error);
        alert(`Error al añadir operador: ${error.message}`);
        setOperators(previousOperators);
      }
    }
  };

  const deleteOperator = async (operator: string) => {
    const previousOperators = [...operators];
    setOperators(prev => prev.filter(op => op !== operator));
    
    const { error } = await supabase.from('operators').delete().eq('name', operator);
    if (error) {
      console.error('Error deleting operator in Supabase:', error);
      alert(`Error al eliminar operador: ${error.message}`);
      setOperators(previousOperators);
    }
  };

  return {
    reservations,
    operators,
    addReservation,
    batchAddReservations,
    updateReservation,
    deleteReservation,
    batchDeleteReservations,
    togglePaidStatus,
    addOperator,
    deleteOperator,
    isLoaded
  };
}
