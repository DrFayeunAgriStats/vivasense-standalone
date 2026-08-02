/**
 * VivaSense brand logo — the single, canonical way to render the logo anywhere
 * in the app. Renders one of the six approved lockup SVGs unmodified (no
 * recoloring, no stretching). Size it by setting ONE dimension via className
 * (e.g. `h-7`); the native aspect ratio is preserved by the <img>.
 *
 *   theme "standard" → dark-green wordmark (use on light backgrounds)
 *   theme "dark"     → green icon + white wordmark (use on dark UI surfaces)
 *   theme "white"    → all white (use on brand-green / photo backgrounds)
 */
import type { ImgHTMLAttributes } from "react";

import hStandard from "@/assets/brand/lockup-horizontal-standard.svg";
import hDark from "@/assets/brand/lockup-horizontal-onDarkUI.svg";
import hWhite from "@/assets/brand/lockup-horizontal-allWhite.svg";
import sStandard from "@/assets/brand/lockup-stacked-standard.svg";
import sDark from "@/assets/brand/lockup-stacked-onDarkUI.svg";
import sWhite from "@/assets/brand/lockup-stacked-allWhite.svg";

export type LogoLayout = "horizontal" | "stacked";
export type LogoTheme = "standard" | "dark" | "white";

const SOURCES: Record<LogoLayout, Record<LogoTheme, string>> = {
  horizontal: { standard: hStandard, dark: hDark, white: hWhite },
  stacked: { standard: sStandard, dark: sDark, white: sWhite },
};

export interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  layout?: LogoLayout;
  theme?: LogoTheme;
}

export function Logo({
  layout = "horizontal",
  theme = "standard",
  alt = "VivaSense",
  className,
  ...rest
}: LogoProps) {
  return <img src={SOURCES[layout][theme]} alt={alt} className={className} {...rest} />;
}

export default Logo;
