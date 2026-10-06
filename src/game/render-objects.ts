import type { WorldObject } from "./objects";
import { drawSprite } from "./assets";

export function drawObject(
  c: CanvasRenderingContext2D,
  o: WorldObject,
  camera: number,
  tick: number,
  time: number,
) {
  c.save();
  c.translate(o.x - camera, o.y);
  if (o.role === "core") {
    if (o.dead) {
      c.globalAlpha = Math.max(0, 1 - o.death / 0.6);
      c.strokeStyle = "#f0bc32";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 25 + o.death * 65, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      return;
    }
    const pulse = 1 + Math.sin(tick * 5) * 0.06;
    if (o.kind === "orb" && drawSprite(c, "core", -31, -34, 62)) {
      c.strokeStyle = "#f8dc78";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, 38 * pulse, tick, tick + 3);
      c.stroke();
      c.font = "800 10px Arial";
      c.textAlign = "center";
      c.fillStyle = "#ffdf7e";
      c.fillText("CORE", 0, -44);
      c.restore();
      return;
    }
    if (
      o.kind === "fracture" &&
      drawSprite(c, "fracture", -o.width / 2, o.floor + 28 - o.y, o.width)
    ) {
      c.strokeStyle = "#ffe070";
      c.lineWidth = 4;
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.moveTo(-10, -45 + i * 12);
        c.lineTo(0, -36 + i * 12);
        c.lineTo(10, -45 + i * 12);
        c.stroke();
      }
      c.font = "800 10px Arial";
      c.textAlign = "center";
      c.fillStyle = "#ffe070";
      c.fillText("CRASH CORE", 0, -57);
      c.restore();
      return;
    }
    if (o.kind === "orb") {
      c.scale(pulse, pulse);
      c.fillStyle = "#fff7c6";
      c.strokeStyle = "#a5791e";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 23, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = "#e5b432";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 31, tick, tick + 4.6);
      c.stroke();
      c.fillStyle = "#efb82e";
      c.beginPath();
      c.moveTo(0, -12);
      c.lineTo(12, 0);
      c.lineTo(0, 12);
      c.lineTo(-12, 0);
      c.closePath();
      c.fill();
    } else {
      c.fillStyle = "#283d42";
      c.beginPath();
      c.roundRect(-o.width / 2, -8, o.width, 18, 4);
      c.fill();
      c.fillStyle = "#efbb3b";
      c.fillRect(-o.width / 2 + 4, -6, o.width - 8, 5);
      if (o.kind === "impact") drawSprite(c, "core", -18, -34, 36);
      c.strokeStyle = "#e7b233";
      c.lineWidth = 4;
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.moveTo(-10, -48 + i * 12);
        c.lineTo(0, -39 + i * 12);
        c.lineTo(10, -48 + i * 12);
        c.stroke();
      }
      if (o.kind === "fracture") {
        c.strokeStyle = "#7d6129";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-25, 9);
        c.lineTo(-7, 17);
        c.lineTo(4, 5);
        c.lineTo(22, 17);
        c.stroke();
      }
    }
    c.font = "800 10px Arial";
    c.textAlign = "center";
    c.fillStyle = "#a27b21";
    c.fillText(
      o.kind === "orb"
        ? "CORE"
        : o.kind === "fracture"
          ? "CRASH CORE"
          : "IMPACT CORE",
      0,
      o.kind === "orb" ? -40 : -58,
    );
  } else if (o.kind === "gate") {
    const top = -o.height / 2,
      h = o.height;
    c.strokeStyle = "#39494b";
    c.lineWidth = 5;
    c.strokeRect(-o.width / 2 - 4, top, o.width + 8, h);
    const opened = o.open ? Math.min(1, (time - o.openedAt) / 0.32) : 0;
    c.save();
    c.beginPath();
    c.rect(-o.width / 2, top, o.width, h);
    c.clip();
    c.translate(0, -h * opened);
    c.fillStyle = "#344449";
    c.fillRect(-o.width / 2, top, o.width, h);
    for (let y = top; y < top + h; y += 22) {
      c.fillStyle = "#d8624f";
      c.fillRect(-o.width / 2, y, o.width, 5);
    }
    c.fillStyle = "#edbd3b";
    c.beginPath();
    c.arc(0, 0, 10, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#344449";
    c.lineWidth = 2;
    c.strokeRect(-4, -1, 8, 6);
    c.restore();
    c.font = "800 10px Arial";
    c.textAlign = "center";
    c.fillStyle = o.open ? "#2a9c80" : "#d95b4b";
    c.fillText(o.open ? "OPEN" : "LOCKED", 0, top - 10);
  } else {
    c.fillStyle = "#303d41";
    c.strokeStyle = "#f26452";
    c.lineWidth = 3;
    if (o.kind === "spike") {
      if (
        drawSprite(
          c,
          "spike",
          -o.width / 2,
          o.height / 2 - (o.width * 633) / 1199,
          o.width,
        )
      ) {
        c.font = "800 10px Arial";
        c.textAlign = "center";
        c.fillStyle = "#ff8771";
        c.fillText("HAZARD", 0, -o.height / 2 - 12);
        c.restore();
        return;
      }
      for (let i = -1; i < 2; i++) {
        c.beginPath();
        c.moveTo(i * 21 - 11, o.height / 2);
        c.lineTo(i * 21, -o.height / 2);
        c.lineTo(i * 21 + 11, o.height / 2);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.fillStyle = "#e76250";
      c.fillRect(-o.width / 2, o.height / 2, o.width, 5);
    } else {
      c.fillRect(-o.width / 2, -o.height / 2, o.width, o.height);
      c.save();
      c.beginPath();
      c.rect(-o.width / 2, -o.height / 2, o.width, o.height);
      c.clip();
      c.strokeStyle = "#d65f4d";
      c.lineWidth = 8;
      for (let x = -o.width; x < o.width; x += 24) {
        c.beginPath();
        c.moveTo(x, -o.height / 2);
        c.lineTo(x - o.height, o.height / 2);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = "#303d41";
      c.lineWidth = 8;
      c.strokeRect(-o.width / 2, -o.height / 2, o.width, o.height);
    }
    c.font = "800 10px Arial";
    c.textAlign = "center";
    c.fillStyle = "#dd5b4b";
    c.fillText("HAZARD", 0, -o.height / 2 - 12);
  }
  c.restore();
}
