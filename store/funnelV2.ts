import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AnalysisResultV2, PhotoType, SkinConcern, SkinType } from "@/lib/v2/types";

export interface FunnelV2State {
  // Profile setup
  name: string;
  ageRange: string;
  gender: string | null;
  country: string;
  skinType: SkinType | null;
  skinConcerns: SkinConcern[];
  hairType: string | null;
  currentRoutine: string | null;
  consentGiven: boolean;

  // Capture — resumable (Design review journey storyboard: navigate-away-mid-flow must resume)
  currentSessionId: string | null;
  stepIndex: number; // 0-14, index into CAPTURE_STEPS
  photos: Partial<Record<PhotoType, string>>; // base64, same-session
  signedPhotos: Partial<Record<PhotoType, string>>; // signed URLs, cross-session

  analysisResult: AnalysisResultV2 | null;

  hasHydrated: boolean;
}

interface FunnelV2Actions {
  setProfile: (data: Partial<Pick<FunnelV2State,
    "name" | "ageRange" | "gender" | "country" | "skinType" | "skinConcerns" | "hairType" | "currentRoutine" | "consentGiven"
  >>) => void;
  setSessionId: (id: string) => void;
  setStepIndex: (index: number) => void;
  setPhoto: (type: PhotoType, dataUrl: string) => void;
  setSignedPhoto: (type: PhotoType, url: string) => void;
  setAnalysisResult: (r: AnalysisResultV2) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  reset: () => void;
  resetPhotosOnly: () => void;
}

const initialState: FunnelV2State = {
  name: "",
  ageRange: "",
  gender: null,
  country: "",
  skinType: null,
  skinConcerns: [],
  hairType: null,
  currentRoutine: null,
  consentGiven: false,
  currentSessionId: null,
  stepIndex: 0,
  photos: {},
  signedPhotos: {},
  analysisResult: null,
  hasHydrated: false,
};

export const useFunnelV2Store = create<FunnelV2State & FunnelV2Actions>()(
  persist(
    (set) => ({
      ...initialState,
      setProfile: (data) => set(data),
      setSessionId: (currentSessionId) => set({ currentSessionId }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      setPhoto: (type, dataUrl) => set((state) => ({ photos: { ...state.photos, [type]: dataUrl } })),
      setSignedPhoto: (type, url) => set((state) => ({ signedPhotos: { ...state.signedPhotos, [type]: url } })),
      setAnalysisResult: (analysisResult) => set({ analysisResult }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      reset: () => set({ ...initialState, hasHydrated: true }),
      resetPhotosOnly: () => set({
        currentSessionId: null, stepIndex: 0, photos: {}, signedPhotos: {}, analysisResult: null,
      }),
    }),
    {
      name: "percept-v2-funnel", // deliberately separate key from the legacy "percept-funnel"
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, clear: () => {}, key: () => null } as unknown as Storage)
      ),
      // Raw captured photos are full-resolution base64 data URLs — persisting
      // them grows this blob into multiple MB within a handful of steps and
      // can hit localStorage's quota (especially on iOS Safari), silently
      // breaking every subsequent write once the browser starts rejecting
      // setItem calls. Photos are already durably saved to Supabase Storage
      // the moment each step completes, so nothing is lost by keeping the
      // in-memory copy out of the persisted blob — a refresh mid-capture just
      // means re-shooting the current step's photo, not losing prior ones.
      partialize: (state) => {
        const { photos: _photos, signedPhotos: _signedPhotos, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
