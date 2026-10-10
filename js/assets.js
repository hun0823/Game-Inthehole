import { BALLS } from "./balls.js";
import { ballCopy, planetName } from "./i18n.js";
import { PLANET_BALL, PLANET_ORDER } from "./themes.js";
import { shotBall, shotCompare, shotGoal, shotPlanet } from "./showcase.js";

const planetBody = document.querySelector("#planet-table tbody");
const ballBody = document.querySelector("#ball-table tbody");
const closeups = document.getElementById("closeup-row");
const compareGrid = document.getElementById("compare-grid");

const COMPARE = [
  ["ball", "baseball", "야구공", "Baseball"],
  ["ball", "tennis", "테니스공", "Tennis"],
  ["ball", "melon", "수박", "Watermelon"],
  ["ball", "oak", "오크", "Oak"],
  ["planet", "wood", "나무", "Wood"],
  ["planet", "desert", "사막", "Desert"],
  ["planet", "ocean", "바다", "Ocean"],
  ["planet", "lava", "용암", "Lava"],
];
const statusEl = document.getElementById("sheet-status");

function cell(label, node) {
  const td = document.createElement("td");
  td.dataset.label = label;
  if (typeof node === "string") td.textContent = node;
  else td.append(node);
  return td;
}

function img(alt) {
  const el = document.createElement("img");
  el.alt = alt;
  el.width = 120;
  el.height = 120;
  return el;
}

function planetRows() {
  for (const id of PLANET_ORDER) {
    const tr = document.createElement("tr");
    const picture = img(planetName("en", id));
    picture.dataset.planet = id;
    const rewardId = PLANET_BALL[id];
    const reward = `${ballCopy("ko", rewardId).name} · ${ballCopy("en", rewardId).name}`;
    tr.append(
      cell("Render", picture),
      cell("한국어", planetName("ko", id)),
      cell("English", planetName("en", id)),
      cell("Reward set", reward)
    );
    tr.querySelector("td:nth-child(2)").className = "name-ko";
    tr.querySelector("td:nth-child(3)").className = "name-en";
    planetBody.append(tr);
  }
}

function ballRows() {
  for (const ball of BALLS) {
    const tr = document.createElement("tr");
    const ballImg = img(ballCopy("en", ball.id).name);
    const goalImg = img(`${ballCopy("en", ball.id).name} goal`);
    ballImg.dataset.ball = ball.id;
    goalImg.dataset.goal = ball.id;
    const ko = ballCopy("ko", ball.id);
    const en = ballCopy("en", ball.id);
    const effect = document.createElement("div");
    const koP = document.createElement("p");
    koP.className = "blurb";
    koP.textContent = ko.blurb;
    const enP = document.createElement("p");
    enP.className = "blurb";
    enP.textContent = en.blurb;
    effect.append(koP, enP);
    const price = `${ball.price} ★`;
    tr.append(
      cell("Ball", ballImg),
      cell("Goal", goalImg),
      cell("한국어", ko.name),
      cell("English", en.name),
      cell("Price", price),
      cell("Effect", effect)
    );
    tr.querySelector("td:nth-child(3)").className = "name-ko";
    tr.querySelector("td:nth-child(4)").className = "name-en";
    tr.querySelector("td:nth-child(5)").className = "price";
    ballBody.append(tr);
  }
}

function closeupRow() {
  for (const id of ["baseball", "tennis", "melon"]) {
    const figure = document.createElement("figure");
    const picture = document.createElement("img");
    picture.alt = ballCopy("en", id).name;
    picture.dataset.closeup = id;
    const cap = document.createElement("figcaption");
    cap.textContent = `${ballCopy("ko", id).name} · ${ballCopy("en", id).name}`;
    figure.append(picture, cap);
    closeups.append(figure);
  }
}

function compareCards() {
  for (const [kind, id, ko, en] of COMPARE) {
    const card = document.createElement("article");
    card.className = "compare-card";
    const title = document.createElement("h3");
    title.textContent = `${ko} · ${en}`;
    const pair = document.createElement("div");
    pair.className = "compare-pair";
    for (const label of ["Before", "After"]) {
      const figure = document.createElement("figure");
      const picture = document.createElement("img");
      picture.alt = `${en} ${label}`;
      picture.dataset.compare = `${kind}|${id}|${label}`;
      const cap = document.createElement("figcaption");
      cap.textContent = label === "Before" ? "Before · 전" : "After · 후";
      figure.append(picture, cap);
      pair.append(figure);
    }
    card.append(title, pair);
    compareGrid.append(card);
  }
}

async function fill() {
  planetRows();
  ballRows();
  closeupRow();
  compareCards();
  for (const el of document.querySelectorAll("[data-planet]")) {
    el.src = await shotPlanet(el.dataset.planet, 180);
  }
  for (const el of document.querySelectorAll("[data-ball]")) {
    el.src = await shotBall(el.dataset.ball, 160);
  }
  for (const el of document.querySelectorAll("[data-goal]")) {
    el.src = await shotGoal(el.dataset.goal, 160);
  }
  for (const el of document.querySelectorAll("[data-closeup]")) {
    el.src = await shotBall(el.dataset.closeup, 320);
  }
  const pairs = new Map();
  for (const [kind, id] of COMPARE) {
    pairs.set(`${kind}|${id}`, await shotCompare(kind, id, 360));
  }
  for (const el of document.querySelectorAll("[data-compare]")) {
    const [kind, id, label] = el.dataset.compare.split("|");
    const shot = pairs.get(`${kind}|${id}`);
    el.src = label === "Before" ? shot.before : shot.after;
  }
  statusEl.textContent = "ready";
}

fill().catch((err) => {
  statusEl.textContent = err && err.message ? err.message : "failed";
});
