import type { Settings, Template } from "./types";

export function pose(
  template: Template,
  phase: number,
  intensity: number,
  speed: number,
) {
  // Whole-number cycles keep every template seamless for any selected speed.
  const a = phase * Math.PI * 2;
  const wave = a * Math.max(1, Math.round(speed * 3));
  switch (template) {
    case "shake":
      return {
        x: Math.sin(wave) * 22 * intensity,
        y: 0,
        r: Math.sin(wave) * 0.3 * intensity,
        s: 1,
      };
    case "dance":
      return {
        x: Math.sin(wave) * 13 * intensity,
        y: -Math.pow(Math.sin(wave), 2) * 35 * intensity,
        r: Math.sin(wave) * 0.2 * intensity,
        s: 1 + Math.cos(wave * 2) * 0.07 * intensity,
      };
    case "rise":
      return {
        x: Math.sin(a) * 18 * intensity,
        y: (Math.cos(a) - 1) * 35 * intensity,
        r: Math.sin(a * Math.max(1, Math.round(speed))) * Math.PI * intensity,
        s: 1 - (1 - Math.cos(a)) * 0.15 * intensity,
      };
    case "twitch":
      return {
        x: (Math.sin(wave * 3) + Math.sin(wave * 7)) * 7 * intensity,
        y: Math.sin(wave * 5) * 10 * intensity,
        r: Math.cos(wave * 4) * 0.13 * intensity,
        s: 1 + Math.sin(wave * 6) * 0.035 * intensity,
      };
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  subject: HTMLCanvasElement,
  settings: Settings,
  phase: number,
  animate = true,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width / 320, height / 320);
  if (settings.background !== "transparent") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, 320, 320);
  }
  const p = animate
    ? pose(settings.template, phase, settings.intensity, settings.speed)
    : { x: 0, y: 0, r: 0, s: 1 };
  ctx.save();
  ctx.translate(160 + settings.x + p.x, 158 + settings.y + p.y);
  ctx.rotate((settings.rotation * Math.PI) / 180 + p.r);
  ctx.scale(settings.scale * p.s, settings.scale * p.s);
  ctx.drawImage(subject, -125, -125, 250, 250);
  ctx.restore();
  if (settings.caption) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${settings.textSize}px system-ui, sans-serif`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#252525";
    ctx.strokeText(settings.caption, 160, 287, 290);
    ctx.fillStyle = settings.textColor;
    ctx.fillText(settings.caption, 160, 287, 290);
  }
  ctx.restore();
}

export function canvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

export function demoSubject() {
  const c = canvas();
  const g = c.getContext("2d")!;
  // Original, locally drawn mascot. No network image or font dependency.
  g.fillStyle = "#222222";
  g.beginPath();
  g.ellipse(259, 378, 132, 102, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fdfbf4";
  g.beginPath();
  g.ellipse(260, 376, 86, 86, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#222222";
  [
    [151, 128],
    [366, 128],
  ].forEach(([x, y]) => {
    g.beginPath();
    g.arc(x, y, 55, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#fdfbf4";
  g.beginPath();
  g.ellipse(260, 229, 157, 134, -0.05, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#222222";
  [
    [193, 219, 0.4],
    [324, 219, -0.4],
  ].forEach(([x, y, r]) => {
    g.beginPath();
    g.ellipse(x, y, 37, 49, r, 0, Math.PI * 2);
    g.fill();
  });
  g.strokeStyle = "#fff";
  g.lineWidth = 9;
  g.lineCap = "round";
  [
    [184, 209],
    [311, 207],
  ].forEach(([x, y]) => {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 18, y - 1);
    g.stroke();
  });
  g.fillStyle = "#e3958e";
  [
    [161, 267],
    [354, 267],
  ].forEach(([x, y]) => {
    g.beginPath();
    g.ellipse(x, y, 24, 12, 0, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#222222";
  g.beginPath();
  g.ellipse(260, 264, 16, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#222222";
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(225, 295);
  g.quadraticCurveTo(260, 330, 298, 287);
  g.stroke();
  return c;
}
