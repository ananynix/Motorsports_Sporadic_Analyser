import f1LogoSrc from '../assets/f1@logotyp.us.png'

// f1@logotyp.us.png ships with a lot of transparent padding around the
// actual wordmark (measured directly from the file's pixel data: the
// visible mark occupies roughly the middle 22% of the image's height and
// 64% of its width, centered). Rendering the raw file at a fixed CSS
// height leaves the mark itself tiny with dead space above/below it --
// this crops down to just the mark by scaling the image up and shifting
// it inside an overflow-hidden box, using percentages (not fixed pixels)
// so it stays responsive to whatever height className the caller applies.
const IMG_ASPECT = 1200 / 857
const CROP = { top: 332 / 857, bottom: 524 / 857, left: 214 / 1200, right: 985 / 1200 }
const CROP_HEIGHT = CROP.bottom - CROP.top
const CROP_WIDTH = CROP.right - CROP.left

const wrapperAspectRatio = (IMG_ASPECT * CROP_WIDTH) / CROP_HEIGHT
const imgHeightPct = 100 / CROP_HEIGHT
const imgTopPct = (-CROP.top / CROP_HEIGHT) * 100
const imgWidthPct = 100 / CROP_WIDTH
const imgLeftPct = (-CROP.left / CROP_WIDTH) * 100

interface F1LogoProps {
  // Tailwind height utilities (e.g. "h-10 lg:h-12") -- width follows
  // automatically via the fixed aspect-ratio of the cropped mark.
  className?: string;
}

export const F1Logo = ({ className }: F1LogoProps) => (
  <span
    className={className}
    style={{ display: 'inline-block', position: 'relative', overflow: 'hidden', aspectRatio: wrapperAspectRatio }}
  >
    <img
      src={f1LogoSrc}
      alt="F1"
      style={{
        position: 'absolute',
        top: `${imgTopPct}%`,
        left: `${imgLeftPct}%`,
        height: `${imgHeightPct}%`,
        width: `${imgWidthPct}%`,
        maxWidth: 'none',
      }}
    />
  </span>
)
