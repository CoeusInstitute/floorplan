// The Coeus Institute appearance: the colours, fonts and logo arrive as a sheet in the page head
// (scripts/lib/brand.mjs). What a sheet can't reach is done here: the tab icon, and the logo's name.
(() => {
  const SC = window.Floorplan;
  if (!SC) return;
  const icon = /url\("?(data:image\/png;base64,[A-Za-z0-9+/=]+)"?\)/.exec(getComputedStyle(document.documentElement).getPropertyValue('--brand-favicon'));
  const link = document.querySelector('link[rel="icon"]');
  if (icon && link) link.href = icon[1];
  const mark = document.querySelector('.brand > .mark');
  const name = SC.graph?.project?.name;
  if (mark && name) { mark.alt = name; mark.title = name; }
})();
