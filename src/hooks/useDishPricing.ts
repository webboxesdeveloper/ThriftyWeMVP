import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { DishPricing } from '@/services/api';

export const useDishPricing = (dishId: string | undefined, userPlz: string | null) => {
  const [pricing, setPricing] = useState<DishPricing | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dishId) return;

    const fetchPricing = async () => {
      setLoading(true);
      try {
        const result = await api.getDishPricing(dishId, userPlz || undefined);
        setPricing(result);
      } catch (error) {
        console.error('Error fetching dish pricing:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, [dishId, userPlz]);

  return { pricing, loading };
};
