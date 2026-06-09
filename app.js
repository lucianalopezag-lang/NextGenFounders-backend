const API = "https://nextgenfounders-backend-production.up.railway.app";
let currentUserRole  = "";
let currentUserId    = null;
let currentUserName  = "";
let currentXP        = 0;
let selectedCategoryId = null;
let notifications    = [];

// ─── LEVELS ──────────────────────────────────────────────────────────────────
function getLevel(xp) {
  if (xp >= 601) return { name: "Visionary", emoji: "🔥", min: 601, next: null  };
  if (xp >= 301) return { name: "Founder",   emoji: "🚀", min: 301, next: 601   };
  if (xp >= 101) return { name: "Builder",   emoji: "⚡", min: 101, next: 301   };
  return               { name: "Seedling",  emoji: "🌱", min: 0,   next: 100   };
}

function updateLevelUI(xp) {
  currentXP = xp;
  const lvl  = getLevel(xp);
  const badge = `${lvl.emoji} ${lvl.name}`;

  ["level-badge","challenge-level-badge","profile-level-badge"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = badge;
  });

  ["xp-display","challenge-xp-display"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = xp + " XP";
  });

  const pct = lvl.next
    ? Math.min(((xp - lvl.min) / (lvl.next - lvl.min)) * 100, 100)
    : 100;

  ["xp-fill","challenge-xp-fill"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.width = pct + "%";
  });

  const nextEl = document.getElementById("xp-next");
  if (nextEl) {
    nextEl.innerText = lvl.next
      ? `${lvl.next - xp} XP to next level`
      : "Max level reached 🔥";
  }

  const statXP = document.getElementById("stat-xp");
  if (statXP) statXP.innerText = xp;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function addNotification(msg) {
  notifications.unshift({ msg, time: new Date().toLocaleTimeString() });
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.classList.remove("hidden");
    badge.innerText = notifications.length;
  }
}

function openNotifications() {
  showPage("notifications-page");
  const c = document.getElementById("notifications-container");
  c.innerHTML = notifications.length
    ? notifications.map(n => `
        <div class="notif-card">
          <p>${n.msg}</p>
          <small>${n.time}</small>
        </div>`).join("")
    : `<p class="empty-state">No notifications yet 🔔</p>`;
  const badge = document.getElementById("notif-badge");
  if (badge) badge.classList.add("hidden");
  notifications = [];
}

function closeNotifications() { closePage("notifications-page"); }

// ─── PAGE HELPERS ─────────────────────────────────────────────────────────────
function showPage(id) {
  document.getElementById("dashboard").style.display = "none";
  document.getElementById(id).classList.remove("hidden");
}

function closePage(id) {
  document.getElementById(id).classList.add("hidden");
  document.getElementById("dashboard").style.display = "block";
}

function scrollToAuth() {
  document.getElementById("auth-section").scrollIntoView({ behavior: "smooth" });
}

// ─── LOAD USER ────────────────────────────────────────────────────────────────
async function loadUser() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res  = await fetch(API + "/me", { headers: { authorization: token } });
    const user = await res.json();

    currentUserRole = user.role;
    currentUserId   = user.id;
    currentUserName = user.name || "Founder";

    document.getElementById("welcome-name").innerText  = `Welcome back, ${currentUserName} ✨`;
    document.getElementById("welcome-meta").innerText  = `Founder from ${user.country}`;
    document.getElementById("profile-name").innerText  = currentUserName;
    document.getElementById("profile-country").innerText = `📍 ${user.country}`;
    document.getElementById("profile-avatar").innerText  = currentUserName.charAt(0).toUpperCase();
    document.getElementById("compose-avatar").innerText  = currentUserName.charAt(0).toUpperCase();

    if (user.role === "admin") {
      document.getElementById("admin-btn").classList.remove("hidden");
    }
    await loadProgress();
  } catch(e) { console.error("loadUser error:", e); }
}

async function loadProgress() {
  const token = localStorage.getItem("token");
  try {
    const res  = await fetch(API + "/progress", { headers: { authorization: token } });
    const data = await res.json();
    updateLevelUI(data.xp || 0);
  } catch(e) { console.error("loadProgress error:", e); }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
if (localStorage.getItem("token")) {
  document.querySelector(".auth-section").style.display = "none";
  document.getElementById("hero").style.display         = "none";
  document.getElementById("navbar").style.display       = "none";
  document.getElementById("dashboard").classList.remove("hidden");
  loadUser();
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
async function register() {
  try {
    const res  = await fetch(API + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:     document.getElementById("name").value,
        email:    document.getElementById("email").value,
        password: document.getElementById("password").value,
        age:      document.getElementById("age").value,
        country:  document.getElementById("country").value
      })
    });
    const data = await res.text();
    document.getElementById("register-result").innerText = data;
  } catch(e) {
    document.getElementById("register-result").innerText = "Error registering. Try again.";
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function login() {
  try {
    const res = await fetch(API + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:    document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value
      })
    });
    if (!res.ok) {
      document.getElementById("login-result").innerText = await res.text();
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    document.querySelector(".auth-section").style.display = "none";
    document.getElementById("hero").style.display         = "none";
    document.getElementById("navbar").style.display       = "none";
    document.getElementById("dashboard").classList.remove("hidden");
    loadUser();
  } catch(e) {
    document.getElementById("login-result").innerText = "Error logging in. Try again.";
  }
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("completedChallenges");
  localStorage.removeItem("journalEntries");
  location.reload();
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
async function openProfile() {
  showPage("profile-page");
  const token = localStorage.getItem("token");
  try {
    const [progressRes, postsRes] = await Promise.all([
      fetch(API + "/progress", { headers: { authorization: token } }),
      fetch(API + "/posts")
    ]);
    const progress = await progressRes.json();
    const allPosts = await postsRes.json();
    const myPosts  = allPosts.filter(p => p.user_name === currentUserName);

    updateLevelUI(progress.xp || 0);
    document.getElementById("stat-xp").innerText    = progress.xp || 0;
    document.getElementById("stat-posts").innerText = myPosts.length;

    const completed = JSON.parse(localStorage.getItem("completedChallenges") || "[]");
    document.getElementById("stat-challenges").innerText = completed.length;

    const lvl = getLevel(progress.xp || 0);
    document.getElementById("profile-level-badge").innerText = `${lvl.emoji} ${lvl.name}`;

    document.getElementById("profile-posts").innerHTML = myPosts.length
      ? myPosts.map(p => `
          <div class="tweet-card">
            <div class="tweet-avatar">${currentUserName.charAt(0).toUpperCase()}</div>
            <div class="tweet-body">
              <div class="tweet-meta">
                <strong>${currentUserName}</strong>
                <span class="tweet-level">${lvl.emoji} ${lvl.name}</span>
              </div>
              <p class="tweet-text">${p.content}</p>
              ${p.link ? `<a href="${p.link}" target="_blank" class="tweet-link">↗ ${p.link}</a>` : ""}
            </div>
          </div>`).join("")
      : `<p class="empty-state">No posts yet. Share something with the community! 🚀</p>`;
  } catch(e) { console.error("openProfile error:", e); }
}

function closeProfile() { closePage("profile-page"); }

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
async function openAnnouncements() {
  showPage("announcements-page");
  try {
    const res   = await fetch(API + "/announcements");
    const items = await res.json();
    document.getElementById("announcements-container").innerHTML = items.length
      ? items.map(item => `
          <div class="announce-card">
            ${item.image ? `<img src="${item.image}" class="announce-img" onerror="this.style.display='none'">` : ""}
            <div class="announce-body">
              <h2>${item.title}</h2>
              <p>${item.content}</p>
              <small>${item.date}</small>
              ${currentUserRole === "admin"
                ? `<button onclick="deleteAnnouncement(${item.id})" class="delete-btn">Delete</button>`
                : ""}
            </div>
          </div>`).join("")
      : `<p class="empty-state">No announcements yet.</p>`;
  } catch(e) { console.error("openAnnouncements error:", e); }
}

function closeAnnouncements() { closePage("announcements-page"); }

async function createAnnouncement() {
  const token = localStorage.getItem("token");
  try {
    const res  = await fetch(API + "/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({
        title:   document.getElementById("announcementTitle").value,
        content: document.getElementById("announcementContent").value,
        image:   document.getElementById("announcementImage").value,
        date:    document.getElementById("announcementDate").value
      })
    });
    const data = await res.json();
    alert(data.message || "Announcement published!");
    document.getElementById("announcementTitle").value   = "";
    document.getElementById("announcementContent").value = "";
    document.getElementById("announcementImage").value   = "";
    document.getElementById("announcementDate").value    = "";
  } catch(e) { alert("Error creating announcement."); }
}

async function deleteAnnouncement(id) {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/announcements/" + id, {
      method: "DELETE",
      headers: { authorization: token }
    });
    openAnnouncements();
  } catch(e) { console.error(e); }
}

// ─── COMMUNITY (TWITTER STYLE) ────────────────────────────────────────────────
async function openCommunity() {
  showPage("community-page");
  try {
    const res   = await fetch(API + "/posts");
    const posts = await res.json();

    document.getElementById("posts-container").innerHTML = posts.length
      ? posts.map(post => {
          const initial = (post.user_name || "F").charAt(0).toUpperCase();
          return `
            <div class="tweet-card" id="post-card-${post.id}">
              <div class="tweet-avatar">${initial}</div>
              <div class="tweet-body">
                <div class="tweet-meta">
                  <strong>${post.user_name || "Founder"}</strong>
                  ${currentUserRole === "admin"
                    ? `<button onclick="deletePost(${post.id})" class="delete-btn small">Delete</button>`
                    : ""}
                </div>
                <p class="tweet-text">${post.content}</p>
                ${post.link
                  ? `<a href="${post.link}" target="_blank" class="tweet-link">↗ ${post.link}</a>`
                  : ""}
                <div class="tweet-actions">
                  <button onclick="likePost(${post.id})" class="like-btn">❤️ ${post.likes || 0}</button>
                  <button onclick="toggleReplies(${post.id})" class="reply-toggle-btn">💬 Replies</button>
                </div>
                <div id="replies-${post.id}" class="replies-section hidden-replies">
                  <div class="reply-compose">
                    <input id="reply-input-${post.id}" placeholder="Write a reply..." class="reply-input">
                    <button onclick="createReply(${post.id})" class="pill-btn burgundy small">Reply</button>
                  </div>
                  <div id="replies-list-${post.id}"></div>
                </div>
              </div>
            </div>`;
        }).join("")
      : `<p class="empty-state">No posts yet. Be the first! 🚀</p>`;

    posts.forEach(post => loadReplies(post.id));
  } catch(e) { console.error("openCommunity error:", e); }
}

function closeCommunity() { closePage("community-page"); }

async function createPost() {
  const token   = localStorage.getItem("token");
  const content = document.getElementById("postContent").value.trim();
  if (!content) return;
  try {
    await fetch(API + "/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({
        content,
        link: document.getElementById("postLink").value
      })
    });
    document.getElementById("postContent").value = "";
    document.getElementById("postLink").value    = "";
    await openCommunity();
    await loadProgress();
  } catch(e) { console.error("createPost error:", e); }
}

async function likePost(id) {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/posts/" + id + "/like", {
      method: "POST",
      headers: { authorization: token }
    });
    await openCommunity();
  } catch(e) { console.error(e); }
}

async function deletePost(id) {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/posts/" + id, {
      method: "DELETE",
      headers: { authorization: token }
    });
    await openCommunity();
  } catch(e) { console.error(e); }
}

async function createReply(postId) {
  const token   = localStorage.getItem("token");
  const content = document.getElementById(`reply-input-${postId}`).value.trim();
  if (!content) return;
  try {
    await fetch(API + "/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({ post_id: postId, content })
    });
    document.getElementById(`reply-input-${postId}`).value = "";
    await loadReplies(postId);
    addNotification(`💬 Someone replied to a post!`);
  } catch(e) { console.error(e); }
}

async function loadReplies(postId) {
  try {
    const res     = await fetch(API + "/replies/" + postId);
    const replies = await res.json();
    const el      = document.getElementById(`replies-list-${postId}`);
    if (!el) return;
    el.innerHTML = replies.length
      ? replies.map(r => `
          <div class="reply-card">
            <div class="reply-avatar">${(r.user_name || "F").charAt(0).toUpperCase()}</div>
            <div>
              <strong>${r.user_name || "Founder"}</strong>
              <p>${r.content}</p>
            </div>
          </div>`).join("")
      : "";
  } catch(e) { console.error(e); }
}

function toggleReplies(postId) {
  const el = document.getElementById(`replies-${postId}`);
  if (el) el.classList.toggle("show-replies");
}

// ─── RESOURCES (WITH CATEGORIES) ─────────────────────────────────────────────
async function openResources() {
  showPage("resources-page");
  if (currentUserRole === "admin") {
    document.getElementById("admin-category-form").classList.remove("hidden");
    document.getElementById("admin-resource-form").classList.remove("hidden");
  }
  await loadCategories();
}

async function loadCategories() {
  try {
    const res  = await fetch(API + "/categories");
    const cats = await res.json();

    const tabs = document.getElementById("categories-tabs");
    if (!cats.length) {
      tabs.innerHTML = "";
      document.getElementById("resources-container").innerHTML =
        `<p class="empty-state">No categories yet. Check back soon!</p>`;
      return;
    }

    tabs.innerHTML = cats.map(c => `
      <button class="category-tab" onclick="selectCategory(${c.id})" id="tab-${c.id}">
        ${c.icon || "📁"} ${c.title}
      </button>`).join("");

    await selectCategory(cats[0].id);
  } catch(e) {
    document.getElementById("resources-container").innerHTML =
      `<p class="empty-state">Could not load categories.</p>`;
  }
}

async function selectCategory(id) {
  selectedCategoryId = id;
  document.querySelectorAll(".category-tab").forEach(t => t.classList.remove("active"));
  const tab = document.getElementById(`tab-${id}`);
  if (tab) tab.classList.add("active");
  await loadResources(id);
}

async function loadResources(categoryId) {
  try {
    const res     = await fetch(API + "/lessons/" + categoryId);
    const lessons = await res.json();
    document.getElementById("resources-container").innerHTML = lessons.length
      ? lessons.map(l => `
          <div class="resource-card">
            <div class="resource-header" onclick="toggleResource(${l.id})">
              <h2>${l.title}</h2>
              <span id="arrow-${l.id}" class="arrow-icon">+</span>
            </div>
            <div id="resource-${l.id}" class="resource-body hidden-replies">
              <p>${l.content.replace(/\n/g, "<br>")}</p>
              ${l.link
                ? `<a href="${l.link}" target="_blank" class="tweet-link">↗ Open Resource</a>`
                : ""}
              ${currentUserRole === "admin"
                ? `<button onclick="deleteLesson(${l.id})" class="delete-btn">Delete</button>`
                : ""}
            </div>
          </div>`).join("")
      : `<p class="empty-state">No resources in this category yet.</p>`;
  } catch(e) { console.error(e); }
}

function toggleResource(id) {
  const body  = document.getElementById(`resource-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (!body) return;
  body.classList.toggle("show-replies");
  arrow.innerText = body.classList.contains("show-replies") ? "−" : "+";
}

function closeResources() { closePage("resources-page"); }

async function createCategory() {
  const token = localStorage.getItem("token");
  const name  = document.getElementById("newCategoryName").value.trim();
  const icon  = document.getElementById("newCategoryIcon").value.trim();
  if (!name) return;
  try {
    await fetch(API + "/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({ title: name, icon })
    });
    document.getElementById("newCategoryName").value = "";
    document.getElementById("newCategoryIcon").value = "";
    await loadCategories();
  } catch(e) { console.error(e); }
}

async function createCategoryFromAdmin() {
  const token = localStorage.getItem("token");
  const name  = document.getElementById("adminCategoryName").value.trim();
  const icon  = document.getElementById("adminCategoryIcon").value.trim();
  if (!name) return;
  try {
    await fetch(API + "/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({ title: name, icon })
    });
    alert("Category created!");
    document.getElementById("adminCategoryName").value = "";
    document.getElementById("adminCategoryIcon").value = "";
  } catch(e) { alert("Error creating category."); }
}

async function createResource() {
  const token = localStorage.getItem("token");
  const title = document.getElementById("resTitle").value.trim();
  if (!title) return;
  try {
    await fetch(API + "/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({
        module_id: selectedCategoryId,
        title,
        content: document.getElementById("resContent").value,
        link:    document.getElementById("resLink").value
      })
    });
    document.getElementById("resTitle").value   = "";
    document.getElementById("resContent").value = "";
    document.getElementById("resLink").value    = "";
    await loadResources(selectedCategoryId);
  } catch(e) { console.error(e); }
}

async function createResourceFromAdmin() {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({
        module_id: document.getElementById("adminResCategoryId").value,
        title:     document.getElementById("adminResTitle").value,
        content:   document.getElementById("adminResContent").value,
        link:      document.getElementById("adminResLink").value
      })
    });
    alert("Resource published!");
    document.getElementById("adminResTitle").value      = "";
    document.getElementById("adminResContent").value    = "";
    document.getElementById("adminResLink").value       = "";
    document.getElementById("adminResCategoryId").value = "";
  } catch(e) { alert("Error publishing resource."); }
}

async function deleteLesson(id) {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/lessons/" + id, {
      method: "DELETE",
      headers: { authorization: token }
    });
    if (selectedCategoryId) await loadResources(selectedCategoryId);
  } catch(e) { console.error(e); }
}

// ─── CHALLENGES ───────────────────────────────────────────────────────────────
async function openChallenges() {
  showPage("challenges-page");
  await loadProgress();
  await loadChallenges();
}

async function loadChallenges() {
  try {
    const res        = await fetch(API + "/challenges");
    const challenges = await res.json();
    const completed  = JSON.parse(localStorage.getItem("completedChallenges") || "[]");

    document.getElementById("challenges-container").innerHTML = challenges.length
      ? challenges.map(c => {
          const done = completed.includes(c.id);
          return `
            <div class="challenge-card ${done ? "completed" : "active"}" onclick="openChallengeDetail(${c.id})">
              <div class="challenge-icon-big">${c.icon || "🏆"}</div>
              <h3>${c.title}</h3>
              <p class="xp-reward">+${c.xp} XP</p>
              ${done
                ? `<span class="done-badge">✅ Completed</span>`
                : `<span class="todo-badge">Tap to start →</span>`}
            </div>`;
        }).join("")
      : `<p class="empty-state">No challenges yet. Check back soon!</p>`;
  } catch(e) { console.error(e); }
}

async function openChallengeDetail(id) {
  try {
    const res        = await fetch(API + "/challenges");
    const challenges = await res.json();
    const c          = challenges.find(ch => ch.id == id);
    if (!c) return;

    document.getElementById("dashboard").style.display         = "none";
    document.getElementById("challenges-page").style.display   = "none";
    document.getElementById("challenge-detail-page").classList.remove("hidden");

    const completed = JSON.parse(localStorage.getItem("completedChallenges") || "[]");
    const done      = completed.includes(c.id);

    let resourceHtml = "";
    if (c.resource_id) {
      try {
        const rRes = await fetch(API + "/lessons/resource/" + c.resource_id);
        if (rRes.ok) {
          const r = await rRes.json();
          resourceHtml = `
            <div class="challenge-resource-box">
              <h3>📚 Related Resource: ${r.title}</h3>
              <p>${r.content ? r.content.replace(/\n/g, "<br>") : ""}</p>
              ${r.link ? `<a href="${r.link}" target="_blank" class="tweet-link">↗ Open Resource</a>` : ""}
            </div>`;
        }
      } catch(e) {}
    }

    document.getElementById("challenge-detail-content").innerHTML = `
      <div class="challenge-detail-hero">
        <span class="challenge-icon-xl">${c.icon || "🏆"}</span>
        <h1>${c.title}</h1>
        <p class="xp-reward big">+${c.xp} XP</p>
      </div>
      ${c.description
        ? `<div class="challenge-desc"><h3>Your Task</h3><p>${c.description}</p></div>`
        : ""}
      ${resourceHtml}
      ${!done
        ? `<button onclick="completeChallenge(${c.id})" class="pill-btn burgundy full-width">
             Mark as Complete ✅
           </button>`
        : `<div class="done-banner">✅ Challenge Completed! Great work, Founder.</div>`}`;
  } catch(e) { console.error(e); }
}

function closeChallengeDetail() {
  document.getElementById("challenge-detail-page").classList.add("hidden");
  const cp = document.getElementById("challenges-page");
  cp.classList.remove("hidden");
  cp.style.display = "block";
}

function closeChallenges() { closePage("challenges-page"); }

async function completeChallenge(id) {
  const token     = localStorage.getItem("token");
  let completed   = JSON.parse(localStorage.getItem("completedChallenges") || "[]");
  if (completed.includes(id)) { alert("Already completed!"); return; }
  completed.push(id);
  localStorage.setItem("completedChallenges", JSON.stringify(completed));
  try {
    await fetch(API + "/complete-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({ challenge: String(id) })
    });
  } catch(e) { console.error(e); }
  await loadProgress();
  addNotification("🏆 Challenge completed! XP added to your profile.");
  closeChallengeDetail();
  await loadChallenges();
}

async function createChallenge() {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: token },
      body: JSON.stringify({
        title:       document.getElementById("challengeTitle").value,
        icon:        document.getElementById("challengeIcon").value,
        xp:          document.getElementById("challengeXP").value,
        description: document.getElementById("challengeDescription").value,
        resource_id: document.getElementById("challengeResourceId").value || null
      })
    });
    alert("Challenge created!");
    document.getElementById("challengeTitle").value       = "";
    document.getElementById("challengeIcon").value        = "";
    document.getElementById("challengeXP").value          = "";
    document.getElementById("challengeDescription").value = "";
    document.getElementById("challengeResourceId").value  = "";
  } catch(e) { alert("Error creating challenge."); }
}

async function deleteChallenge(id) {
  const token = localStorage.getItem("token");
  try {
    await fetch(API + "/challenges/" + id, {
      method: "DELETE",
      headers: { authorization: token }
    });
    await loadChallenges();
  } catch(e) { console.error(e); }
}

// ─── JOURNAL ──────────────────────────────────────────────────────────────────
function openJournal() {
  showPage("journal-page");
  loadJournalEntries();
}

function closeJournal() { closePage("journal-page"); }

function saveJournalEntry() {
  const title   = document.getElementById("journalTitle").value.trim();
  const content = document.getElementById("journalContent").value.trim();
  if (!title && !content) return;
  const entries = JSON.parse(localStorage.getItem("journalEntries") || "[]");
  entries.unshift({
    id:      Date.now(),
    title:   title || "Untitled",
    content,
    date:    new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
  });
  localStorage.setItem("journalEntries", JSON.stringify(entries));
  document.getElementById("journalTitle").value   = "";
  document.getElementById("journalContent").value = "";
  loadJournalEntries();
}

function loadJournalEntries() {
  const entries = JSON.parse(localStorage.getItem("journalEntries") || "[]");
  document.getElementById("journal-entries").innerHTML = entries.length
    ? entries.map(e => `
        <div class="journal-card">
          <div class="journal-header">
            <h3>${e.title}</h3>
            <div class="journal-actions">
              <small>${e.date}</small>
              <button onclick="deleteJournalEntry(${e.id})" class="delete-btn small">Delete</button>
            </div>
          </div>
          <p>${e.content.replace(/\n/g, "<br>")}</p>
        </div>`).join("")
    : `<p class="empty-state">No entries yet. Start writing your founder journey! 📓</p>`;
}

function deleteJournalEntry(id) {
  let entries = JSON.parse(localStorage.getItem("journalEntries") || "[]");
  entries     = entries.filter(e => e.id !== id);
  localStorage.setItem("journalEntries", JSON.stringify(entries));
  loadJournalEntries();
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
async function openAdmin() {
  showPage("admin-panel");
  const token = localStorage.getItem("token");
  try {
    const res   = await fetch(API + "/users", { headers: { authorization: token } });
    const users = await res.json();
    document.getElementById("users-list").innerHTML = users.map(u => `
      <div class="user-card">
        <div class="user-avatar">${(u.name || "F").charAt(0).toUpperCase()}</div>
        <div>
          <strong>${u.name}</strong>
          <p>${u.email}</p>
          <p>📍 ${u.country} · <em>${u.role}</em></p>
        </div>
      </div>`).join("");
  } catch(e) { console.error(e); }
}

function closeAdmin() { closePage("admin-panel"); }