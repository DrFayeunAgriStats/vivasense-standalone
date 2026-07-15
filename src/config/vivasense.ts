/**
 * VivaSense backend URL configuration.
 * Single source of truth for all API base URLs.
 */

export const ANOVA_API_BASE = import.meta.env.VITE_API_URL || "https://vivasense-backend-r-production.up.railway.app";
export const GENETICS_API_BASE = import.meta.env.VITE_API_URL || "https://vivasense-backend-r-production.up.railway.app";

/** @deprecated Use ANOVA_API_BASE instead */
export const ANOVA_BASE = ANOVA_API_BASE;
