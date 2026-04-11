import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LocationMaster {
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  desa: string;
}

interface MasterDataState {
  locations: LocationMaster[];
  isLoaded: boolean;
  addLocations: (newLocations: LocationMaster[]) => void;
  clearLocations: () => void;
  fetchMasterData: () => Promise<void>;
  findSuggestion: (type: 'provinsi'|'kabupaten'|'kecamatan'|'desa', rawValue: string, parentValue?: string) => string | null;
  resolveHierarchy: (input: { provinsi?: string, kabupaten?: string, kecamatan?: string, desa?: string }) => LocationMaster | null;
}

// Global cache to prevent freezing on large Excel files
const resolutionCache = new Map<string, LocationMaster | null>();

// Highly optimized pre-calculated search strings for acceleration
let indexedSearchStrings: string[] = [];
let lastIndexedCount = 0;

// Simple Levenshtein distance for fuzzy matching
const levenshtein = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

export const useMasterDataStore = create<MasterDataState>()(
  persist(
    (set, get) => ({
      locations: [],
      isLoaded: false,
      
      addLocations: (newLocs) => set((state) => {
        const existing = new Set(state.locations.map(l => `${l.provinsi}|${l.kabupaten}|${l.kecamatan}|${l.desa}`));
        const filtered = newLocs.filter(l => !existing.has(`${l.provinsi}|${l.kabupaten}|${l.kecamatan}|${l.desa}`));
        resolutionCache.clear();
        indexedSearchStrings = []; // invalidate
        return { locations: [...state.locations, ...filtered], isLoaded: true };
      }),
      
      clearLocations: () => {
        resolutionCache.clear();
        indexedSearchStrings = [];
        set({ locations: [], isLoaded: false });
      },
      
      fetchMasterData: async () => {
        try {
          if (get().isLoaded && get().locations.length > 0) return;
          const res = await fetch('/master_locations.json');
          if (!res.ok) throw new Error("Failed to fetch master locations");
          const data = await res.json();
          resolutionCache.clear();
          indexedSearchStrings = [];
          set({ locations: data, isLoaded: true });
        } catch (err) {
          console.error("Master Data Fetch Error:", err);
        }
      },
      
      findSuggestion: (type, rawValue, parentValue) => {
        const { locations } = get();
        if (!rawValue || rawValue.trim() === '' || locations.length === 0) return null;
        
        const target = rawValue.toLowerCase().trim();
        let candidates = locations;
        
        if (parentValue) {
           const pTarget = parentValue.toLowerCase().trim();
           const filtered = candidates.filter(l => {
                const sub = (type === 'kabupaten' ? l.provinsi : (type === 'kecamatan' ? l.kabupaten : l.kecamatan)).toLowerCase();
                return sub === pTarget;
           });
           if (filtered.length > 0) candidates = filtered;
        }

        const uniqueNames = Array.from(new Set(candidates.map(l => l[type]).filter(Boolean))) as string[];
        const targetTokens = target.split(/[\s-]+/).filter(t => t.length >= 2);
        
        let bestMatch: string | null = null;
        let bestScore = -1;
        
        for (const name of uniqueNames) {
           const cleanName = name.toLowerCase().trim();
           if (cleanName === target) return name;
           
           let score = 0;
           const dist = levenshtein(target, cleanName);
           const maxAllowed = Math.max(1, Math.floor(cleanName.length * 0.3));
           
           if (dist <= maxAllowed) {
               score = 100 - dist;
           } else if (targetTokens.length > 0) {
               const hits = targetTokens.filter(tt => cleanName.includes(tt)).length;
               if (hits > 0 && (hits === targetTokens.length || hits >= 2)) {
                   score = 50 + (hits * 10);
               }
           }
           
           if (score > bestScore) {
              bestScore = score;
              bestMatch = name;
           }
        }

        return bestScore >= 50 ? bestMatch : null;
      },

      resolveHierarchy: (input) => {
        const { locations } = get();
        if (locations.length === 0) return null;

        // Cache check
        const cacheKey = `${input.provinsi}|${input.kabupaten}|${input.kecamatan}|${input.desa}`;
        if (resolutionCache.has(cacheKey)) return resolutionCache.get(cacheKey)!;

        // One-time Indexing check (Very important for performance)
        if (indexedSearchStrings.length !== locations.length) {
            indexedSearchStrings = locations.map(loc => 
                (loc.provinsi + " " + loc.kabupaten + " " + loc.kecamatan + " " + loc.desa).toLowerCase()
            );
        }

        const clean = (s: string) => (s || '').toLowerCase().trim();
        const iProv = clean(input.provinsi || '');
        const iKab = clean(input.kabupaten || '');
        const iKec = clean(input.kecamatan || '');
        const iDesa = clean(input.desa || '');

        if (!iKab && !iKec && !iDesa) return null;

        const getTokens = (s: string) => s.split(/[\s-]+/).filter(t => t.length >= 2);
        const tokens = {
            prov: getTokens(iProv),
            kab: getTokens(iKab),
            kec: getTokens(iKec),
            desa: getTokens(iDesa)
        };
        const allInputTokens = [...tokens.prov, ...tokens.kab, ...tokens.kec, ...tokens.desa];
        if (allInputTokens.length === 0) return null;

        const isConsonantMatch = (input: string, target: string) => {
            if (input.length < 3) return false;
            const consonants = target.replace(/[aeiou\s]/g, '');
            const inputCons = input.replace(/[aeiou\s]/g, '');
            return consonants.includes(inputCons) || inputCons.includes(consonants);
        };

        let bestMatch: LocationMaster | null = null;
        let bestScore = -1;

        // ACCELERATION: Filter search space using pre-calculated strings
        const finalists: number[] = [];
        for (let i = 0; i < indexedSearchStrings.length; i++) {
            const searchStr = indexedSearchStrings[i];
            let hasAnyToken = false;
            for (const t of allInputTokens) {
                if (searchStr.includes(t)) {
                    hasAnyToken = true;
                    break;
                }
            }
            if (hasAnyToken) finalists.push(i);
        }

        // If even with tokens we have too many, or 0, we can safely prune.
        // But usually token match reduces 83k to <200.
        for (const idx of finalists) {
            const loc = locations[idx];
            const dbNames = {
                prov: loc.provinsi.toLowerCase(),
                kab: loc.kabupaten.toLowerCase(),
                kec: loc.kecamatan.toLowerCase(),
                desa: loc.desa.toLowerCase()
            };

            let score = 0;
            let hits = { prov: 0, kab: 0, kec: 0, desa: 0 };

            const calcHits = (toks: string[], dbStr: string, rawInput: string) => {
                if (!rawInput) return 0;
                let h = 0;
                for (const t of toks) {
                    if (dbStr.includes(t)) h++;
                    else {
                        // Limit Levenshtein calls to prevent freeze
                        for (const word of dbStr.split(/\s+/)) {
                            if (word.length >= 4 && t.length >= 4 && levenshtein(t, word) <= 1) { h++; break; }
                        }
                    }
                }
                if (h === 0 && isConsonantMatch(rawInput, dbStr)) h = 0.5; 
                return h;
            };

            hits.desa = calcHits(tokens.desa, dbNames.desa, iDesa);
            hits.kec = calcHits(tokens.kec, dbNames.kec, iKec);
            hits.kab = calcHits(tokens.kab, dbNames.kab, iKab);
            hits.prov = calcHits(tokens.prov, dbNames.prov, iProv);

            if (dbNames.desa === iDesa) score += 120;
            else if (hits.desa > 0) score += 40 + (hits.desa * 25);

            if (dbNames.kec === iKec) score += 100;
            else if (hits.kec > 0) score += 30 + (hits.kec * 25);

            if (dbNames.kab === iKab) score += 80;
            else if (hits.kab > 0) score += 25 + (hits.kab * 25);

            if (dbNames.prov === iProv) score += 50;
            else if (hits.prov > 0) score += 15 + (hits.prov * 20);

            const hitCount = [hits.prov > 0, hits.kab > 0, hits.kec > 0, hits.desa > 0].filter(Boolean).length;
            if (hitCount >= 3) score += 80;
            else if (hitCount >= 2) score += 40;

            if (hits.kab > 0 && hits.kec > 0) score += 40;
            if (hits.kec > 0 && hits.desa > 0) score += 50;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = loc;
            }
        }

        const result = bestScore >= 60 ? bestMatch : null;
        resolutionCache.set(cacheKey, result);
        return result;
      }
    }),
    {
      name: 'bast-master-data',
    }
  )
);
