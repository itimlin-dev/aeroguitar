"use strict";
const byId = id => document.getElementById(id);
const storageKey = "aeroguitar-practice-v1";
function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}
const saved = readSaved();
let practiceOnly = false;
let selected = tracks[0];
const filters = ["search", "group", "category", "chord", "video"];
const dialog = byId("player");
const offlineFile = location.protocol === "file:";
function belongsToGroup(track, group) {
  return !group || track.AG_No.split("-")[0] === group;
}

function trackCategories(track) {
  return track["AG Chord"].split(";").map(category => category.trim()).filter(Boolean);
}

function chordLabel(track) {
  return "AG和弦：" + (trackCategories(track).join("、") || "未提供");
}

function updateCategories() {
  const group = byId("group").value;
  const select = byId("category");
  const groupTracks = tracks.filter(track => belongsToGroup(track, group));
  const categories = [...new Set(groupTracks.flatMap(trackCategories))]
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  select.replaceChildren(new Option("全部", ""));
  for (const category of categories) select.add(new Option(category, category));
  if (groupTracks.some(track => !trackCategories(track).length)) select.add(new Option("未分類", "_"));
  select.value = "";
}

function chartTitle(track) {
  return "和弦譜：" + (track.AG_No || "未提供");
}

function normalize(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function matches(track) {
  const query = normalize(byId("search").value);
  const category = byId("category").value;
  const group = byId("group").value;
  return (!practiceOnly || saved.has(track.ID)) &&
    (!query || [track.Title, track.Artists, track.ID, track.AG_No, chartTitle(track)]
      .some(value => normalize(value).includes(query))) &&
    (!category || (category === "_" ? !trackCategories(track).length : trackCategories(track).includes(category))) &&
    belongsToGroup(track, group) &&
    (!byId("chord").checked || Boolean(track.Chord)) &&
    (!byId("video").checked || Boolean(track.videoId));
}

function textNode(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderMetrics(id, entries) {
  const metrics = entries.map(([label, value]) => {
    const metric = textNode("div", "", "metric");
    metric.append(textNode("small", label), textNode("strong", value || "未提供"));
    return metric;
  });
  byId(id).replaceChildren(...metrics);
}

function renderDetail() {
  byId("detail").hidden = !selected;
  if (!selected) return;
  byId("detail-title").textContent = chartTitle(selected);
  byId("detail-player").textContent = [selected.ID, selected.Artists].filter(Boolean).join(" · ");
  renderMetrics("detail-metrics", [["調性", selected.Key], ["Capo", selected.Capo], ["BPM", selected.BPM]]);
  byId("detail-chord").textContent = chordLabel(selected);
  byId("detail-chord-record").textContent = selected.Chord || "未提供";
  byId("save").textContent = saved.has(selected.ID) ? "移出練習清單" : "＋ 加入練習清單";
  byId("play").hidden = !selected.videoId;
  byId("extra").replaceChildren(...[["鼓組", selected.Drum], ["備註", selected.Remark]]
    .filter(([, value]) => value).flatMap(([label, value]) =>
      [textNode("dt", label), textNode("dd", value)]));
  byId("save-status").textContent = "";
}

function markSelection() {
  for (const row of byId("rows").rows) {
    const current = row.dataset.track === selected?.ID;
    row.dataset.selected = String(current);
    row.querySelector("button").setAttribute("aria-pressed", String(current));
  }
}

function render() {
  const results = tracks.filter(matches);
  if (!results.includes(selected)) selected = results[0];
  byId("count").textContent = results.length + " 筆曲目";
  byId("empty").hidden = Boolean(results.length);
  byId("empty").textContent = practiceOnly && !saved.size ? "練習清單目前是空的。" : "沒有符合條件的曲目。";
  const rows = results.map(track => {
    const row = document.createElement("tr");
    row.dataset.track = track.ID;
    const title = textNode("button", track.Title, "song");
    title.append(textNode("small", [track.ID, track.AG_No].filter(Boolean).join(" · ")));
    title.addEventListener("click", () => {
      selected = track;
      markSelection();
      renderDetail();
      if (matchMedia("(max-width:780px)").matches) {
        byId("detail").focus({preventScroll:true});
        byId("detail").scrollIntoView({block:"start"});
      }
    });
    const heading = document.createElement("td");
    heading.append(title);
    row.append(heading, textNode("td", trackCategories(track).join("、") || "未分類"), textNode("td", track.Artists || "—"));
    return row;
  });
  byId("rows").replaceChildren(...rows);
  markSelection();
  renderDetail();
}

function setView(practice) {
  practiceOnly = practice;
  byId("all").setAttribute("aria-pressed", String(!practice));
  byId("practice").setAttribute("aria-pressed", String(practice));
  for (const id of filters) {
    const control = byId(id);
    if (control.type === "checkbox") control.checked = false;
    else control.value = "";
  }
  updateCategories();
  render();
}

for (const id of filters) {
  byId(id).addEventListener(id === "search" ? "input" : "change", () => {
    if (id === "group") updateCategories();
    render();
  });
}
byId("all").addEventListener("click", () => setView(false));
byId("practice").addEventListener("click", () => setView(true));
byId("save").addEventListener("click", () => {
  const id = selected.ID;
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  let status = saved.has(id) ? "已加入練習清單。" : "已移出練習清單。";
  try {
    localStorage.setItem(storageKey, JSON.stringify([...saved]));
  } catch {
    status += " 瀏覽器目前無法保存，這次的變更只在本次開啟期間有效。";
  }
  if (practiceOnly) {
    render();
    (selected ? byId("save") : byId("practice")).focus();
  } else {
    renderDetail();
    byId("save-status").textContent = status;
  }
});
let youtubeApi;
let youtubePlayer;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApi) {
    youtubeApi = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      const timeout = window.setTimeout(() => finish(new Error("YouTube API timeout")), 12000);
      function finish(error) {
        window.clearTimeout(timeout);
        delete window.onYouTubeIframeAPIReady;
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve(window.YT);
        }
      }
      script.addEventListener("error", () => finish(new Error("YouTube API unavailable")));
      window.onYouTubeIframeAPIReady = () => finish();
      document.head.append(script);
    }).catch(error => {
      youtubeApi = undefined;
      throw error;
    });
  }
  return youtubeApi;
}

function playbackError(code) {
  switch (code) {
    case 101:
    case 150:
      return "這部影片的擁有者限制嵌入播放，請使用下方連結前往 YouTube。";
    case 100:
      return "YouTube 找不到這部影片。影片可能已移除或設為私人。";
    case 153:
      return "YouTube 未收到網頁來源資訊。請確認是從本機網址開啟曲庫。";
    default:
      return "YouTube 無法在此播放這部影片，可使用下方連結前往 YouTube。";
  }
}

function mountYouTube(track) {
  const frame = byId("frame");
  const note = byId("video-note");
  const iframe = document.createElement("iframe");
  const url = new URL("https://www.youtube-nocookie.com/embed/" + track.videoId);
  url.search = new URLSearchParams({autoplay: "1", enablejsapi: "1", origin: location.origin});
  iframe.title = "YouTube 練習影片";
  iframe.src = url.href;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  frame.replaceChildren(iframe);
  note.textContent = "若影片無法在此播放，可使用上方連結前往 YouTube。";
  loadYouTubeApi().then(api => {
    if (!dialog.open || iframe.parentNode !== frame) return;
    youtubePlayer = new api.Player(iframe, {
      events: {
        onError: ({data}) => {
          if (!dialog.open || iframe.parentNode !== frame) return;
          const message = textNode("p", playbackError(data), "player-error");
          message.setAttribute("role", "status");
          youtubePlayer?.destroy();
          youtubePlayer = undefined;
          frame.replaceChildren(message);
          note.textContent = "";
        }
      }
    });
  }).catch(() => {
    if (dialog.open && iframe.parentNode === frame) {
      note.textContent = "無法讀取 YouTube 播放狀態。若影片沒有播放，可使用上方連結。";
    }
  });
}

byId("play").addEventListener("click", () => {
  const track = selected;
  if (!track?.videoId) return;
  byId("player-title").textContent = track.Title;
  byId("player-chart").textContent = chartTitle(track);
  byId("player-name").textContent = track.Artists || "";
  byId("player-chord").textContent = chordLabel(track);
  byId("player-chord-record").textContent = track.Chord || "未提供";
  renderMetrics("player-metrics", [["Capo", track.Capo], ["BPM", track.BPM]]);
  byId("video-link").href = track.Youtube_URL;
  dialog.showModal();
  if (offlineFile) {
    byId("video-note").textContent = "要在曲庫內播放，請解壓縮後執行 Start_AeroGuitar.cmd，並從開啟的本機網址進入。";
  } else {
    mountYouTube(track);
  }
});
byId("close-player").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  youtubePlayer?.destroy();
  youtubePlayer = undefined;
  byId("frame").replaceChildren();
});
updateCategories();
render();
