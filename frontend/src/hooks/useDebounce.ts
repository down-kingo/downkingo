import { useState, useEffect } from "react";

/**
 * Hook para debounce de valores.
 * Útil para evitar chamadas excessivas em inputs de busca, URLs, etc.
 *
 * @param value - O valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 * @returns O valor debounced
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState("");
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     performSearch(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
