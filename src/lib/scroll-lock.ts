/** Shared, reference-counted lock: closing one overlay must not unlock another. */
let locks = 0;
let restore: (() => void) | undefined;

export function lockPageScroll() {
  if (locks++ === 0) {
    const root = document.documentElement;
    const body = document.body;
    const x = window.scrollX;
    const y = window.scrollY;
    const rootStyle = root.getAttribute("style");
    const bodyStyle = body.getAttribute("style");
    const gutter = Math.max(0, window.innerWidth - root.clientWidth);
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    // Desktop keeps its sticky layout; fixed body additionally stops iOS touch scrolling.
    const fixed = window.matchMedia("(pointer: coarse)").matches;
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (gutter) body.style.paddingRight = `${padding + gutter}px`;
    if (fixed) {
      body.style.position = "fixed";
      body.style.top = `${-y}px`;
      body.style.left = `${-x}px`;
      body.style.width = "100%";
    }
    restore = () => {
      if (rootStyle === null) root.removeAttribute("style"); else root.setAttribute("style", rootStyle);
      if (bodyStyle === null) body.removeAttribute("style"); else body.setAttribute("style", bodyStyle);
      // Restore immediately, even on a page configured for smooth scrolling.
      root.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      if (rootStyle === null) root.removeAttribute("style"); else root.setAttribute("style", rootStyle);
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) { restore?.(); restore = undefined; }
  };
}
