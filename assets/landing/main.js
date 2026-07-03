const grid = document.querySelector("#game-grid");

const palettes = [
  ["#2563eb", "#38bdf8"],
  ["#7c3aed", "#c084fc"],
  ["#db2777", "#f9a8d4"],
  ["#ea580c", "#facc15"],
  ["#059669", "#86efac"],
  ["#0f766e", "#5eead4"],
];

function hashString(value) {
  return [...value].reduce((hash, character) => hash + character.charCodeAt(0), 0);
}

function getInitials(title) {
  return [...title.trim()].slice(0, 2).join("") || "?";
}

function createPlaceholder(game) {
  const placeholder = document.createElement("div");
  const [start, end] = palettes[hashString(game.id) % palettes.length];

  placeholder.className = "game-thumbnail placeholder-thumbnail";
  placeholder.style.setProperty("--placeholder-start", start);
  placeholder.style.setProperty("--placeholder-end", end);
  placeholder.textContent = getInitials(game.title);
  placeholder.setAttribute("aria-hidden", "true");

  return placeholder;
}

function createThumbnail(game) {
  if (!game.thumbnail) {
    return createPlaceholder(game);
  }

  const image = document.createElement("img");
  image.className = "game-thumbnail";
  image.src = game.thumbnail;
  image.alt = `${game.title}のサムネイル`;
  image.loading = "lazy";
  return image;
}

function createBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${status}`;
  badge.textContent = status === "coming-soon" ? "近日公開" : "公開中";
  return badge;
}

function createTags(tags = []) {
  const tagList = document.createElement("ul");
  tagList.className = "tag-list";

  tags.forEach((tag) => {
    const item = document.createElement("li");
    item.textContent = tag;
    tagList.append(item);
  });

  return tagList;
}

function createCard(game) {
  const isReleased = game.status === "released" && game.path;
  const card = document.createElement(isReleased ? "a" : "article");
  card.className = `game-card${isReleased ? "" : " is-disabled"}`;

  if (isReleased) {
    card.href = game.path;
    card.setAttribute("aria-label", `${game.title}を開く`);
  } else {
    card.setAttribute("aria-disabled", "true");
  }

  const body = document.createElement("div");
  body.className = "game-card-body";

  const title = document.createElement("h3");
  title.textContent = game.title;

  const description = document.createElement("p");
  description.className = "game-description";
  description.textContent = game.description;

  body.append(title, description, createBadge(game.status));

  if (Array.isArray(game.tags) && game.tags.length > 0) {
    body.append(createTags(game.tags));
  }

  card.append(createThumbnail(game), body);
  return card;
}

function renderGames(games) {
  if (!Array.isArray(games) || games.length === 0) {
    grid.innerHTML = '<p class="empty-message">表示できるゲームがまだありません。</p>';
    return;
  }

  grid.replaceChildren(...games.map(createCard));
}

function renderError() {
  grid.innerHTML = '<p class="error-message">ゲーム一覧を読み込めませんでした。時間をおいて再度お試しください。</p>';
}

async function loadGames() {
  try {
    const response = await fetch("games.json", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`Failed to load games.json: ${response.status}`);
    }

    const games = await response.json();
    renderGames(games);
  } catch (error) {
    console.error(error);
    renderError();
  }
}

document.addEventListener("DOMContentLoaded", loadGames);
