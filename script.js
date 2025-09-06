// Paths to JSON files
const ATTRIBUTES_JSON = "data/attributes.json";
const SKILLS_JSON = "data/skills.json";
const EXPERIENCE_JSON = "data/experience.json";
const COMPANIES_JSON = "data/companies.json";

let attributes = [];
let skills = [];
let experience = {};
let companies = {};
let characterLevel = 0;

// Parse date string
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d) ? new Date() : d;
}

// Create a progress bar element (0..100)
function createProgressBar(percent) {
  const safePct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const wrap = document.createElement("div");
  wrap.className = "progress-container";
  const fill = document.createElement("div");
  fill.className = "progress-bar";
  fill.style.width = safePct + "%";
  wrap.appendChild(fill);
  return wrap;
}

// Load data
async function loadData() {
  try {
    const [attrRes, skillRes, expRes, compRes] = await Promise.all([
      fetch(ATTRIBUTES_JSON),
      fetch(SKILLS_JSON),
      fetch(EXPERIENCE_JSON),
      fetch(COMPANIES_JSON)
    ]);
    attributes = await attrRes.json();
    skills = await skillRes.json();
    experience = await expRes.json();
    const companyArray = await compRes.json();
    companies = {};
    (companyArray || []).forEach(c => companies[c.id] = c);

    calculateLevels();
    renderCharacter();
    setupBackButtons();
  } catch (err) {
    console.error("Failed to load data:", err);
  }
}

// Calculate levels
function calculateLevels() {
  attributes.forEach(attr => { attr.level = 0; attr.exp = 0; attr.progress = 0; });
  let allPeriods = [];

  function mergePeriods(periods) {
    if (!periods || periods.length === 0) return [];
    const arr = periods.map(p => ({ from: p.from, to: p.to })).sort((a, b) => a.from - b.from);
    const merged = [ { from: arr[0].from, to: arr[0].to } ];
    for (let i=1;i<arr.length;i++) {
      const last = merged[merged.length-1];
      if (arr[i].from <= last.to) last.to = new Date(Math.max(last.to, arr[i].to));
      else merged.push({ from: arr[i].from, to: arr[i].to });
    }
    return merged;
  }

  // Attributes
  attributes.forEach(attr => {
    const periods = [];
    (experience.attribute && experience.attribute[attr.id] || []).forEach(p => {
      periods.push({ from: parseDate(p.from), to: parseDate(p.to) });
    });
    skills.filter(s => s.attribute===attr.id).forEach(skill => {
      (experience.skill && experience.skill[skill.id] || []).forEach(p => {
        periods.push({ from: parseDate(p.from), to: parseDate(p.to) });
      });
    });

    const merged = mergePeriods(periods);
    let totalYears = 0;
    merged.forEach(p => { if(p.from && p.to && p.to>p.from){ totalYears += (p.to-p.from)/(1000*60*60*24*365.25); allPeriods.push({from:p.from,to:p.to}); }});
    attr.exp = totalYears;
    attr.level = Math.floor(totalYears);
    attr.progress = totalYears - attr.level;
  });

  // Character level
  const mergedAll = mergePeriods(allPeriods);
  let totalCharYears = 0;
  mergedAll.forEach(p => { if(p.from && p.to && p.to>p.from) totalCharYears += (p.to-p.from)/(1000*60*60*24*365.25); });
  characterLevel = totalCharYears;

  // Skill levels
  skills.forEach(skill => {
    let totalExp = 0;
    (experience.skill && experience.skill[skill.id] || []).forEach(p => {
      const from = parseDate(p.from);
      const to = parseDate(p.to);
      if(from && to && to>from) totalExp += (to-from)/(1000*60*60*24*365.25);
    });
    skill.exp = totalExp;
    skill.level = Math.floor(totalExp);
    skill.progress = totalExp - skill.level;
  });
}

// Render character, attributes, skills
function renderCharacter() {
  const charLevelDiv = document.getElementById("character-level");
  if(!charLevelDiv) return;
  charLevelDiv.innerHTML = "";
  const h2 = document.createElement("h2");
  h2.textContent = "Character Level";
  charLevelDiv.appendChild(h2);
  charLevelDiv.appendChild(createProgressBar((characterLevel%1)*100));
  const levelText = document.createElement("div");
  levelText.id="level-text";
  levelText.textContent = `Level ${Math.floor(characterLevel)}`;
  charLevelDiv.appendChild(levelText);

  // Attributes
  const attrContainer = document.getElementById("attributes");
  attrContainer.innerHTML="";
  attributes.forEach(attr=>{
    const card = document.createElement("div");
    card.className="attribute";
    card.textContent=`${attr.name} (Level ${attr.level})`;
    card.appendChild(createProgressBar(attr.progress*100));
    card.addEventListener("click",()=>showSkillTree(attr));
    attrContainer.appendChild(card);
  });

  // Skill + Detail Views abhängig von Bildschirmbreite
  const skillView = document.getElementById("skill-view");
  const skillDetailView = document.getElementById("skill-detail-view");

  if (window.innerWidth < 769) {
    skillView.classList.add("hidden");
  } else {
    skillView.classList.remove("hidden");
  }
  skillDetailView.classList.add("hidden");
}

// Show skills
function showSkillTree(attr){
  const skillView = document.getElementById("skill-view");
  const attrContainer = document.getElementById("attributes-container");
  const detailView = document.getElementById("skill-detail-view"); // NEU
  const isDesktop = window.innerWidth >= 769;

  // Skill-Details immer schließen, wenn ein neues Attribut geöffnet wird
  detailView.classList.add("hidden"); // NEU

  // Aktives Attribut hervorheben
  document.querySelectorAll(".attribute").forEach(a=>a.classList.remove("active-attribute"));
  const card = Array.from(attrContainer.children).find(c=>c.textContent.startsWith(attr.name));
  if(card) card.classList.add("active-attribute");

  if(isDesktop){
    attrContainer.classList.remove("hidden");
    skillView.classList.remove("hidden");
  } else {
    attrContainer.classList.add("hidden");
    skillView.classList.remove("hidden");
    if(!isDesktop){
      document.getElementById("skill-headline").textContent = `${attr.name} Skills`;
    }
  }

  // Skills aufbauen
  const skillContainer=document.getElementById("skills");
  skillContainer.innerHTML="";
  skills.filter(s=>s.attribute===attr.id).forEach(skill=>{
    const div=document.createElement("div");
    div.className="skill";
    div.textContent=`${skill.name} (Level ${skill.level})`;
    div.appendChild(createProgressBar(skill.progress*100));
    div.addEventListener("click",()=>showSkillDetail(skill));
    skillContainer.appendChild(div);
  });
}

function formatMonthYear(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d)) return "N/A";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}.${year}`;
}

function showSkillDetail(skill){
  document.getElementById("skill-view").classList.add("hidden");
  const detailView=document.getElementById("skill-detail-view");
  detailView.classList.remove("hidden");

  const container=document.getElementById("skill-detail");
  container.innerHTML="";
  const h=document.createElement("h3");
  h.textContent=`${skill.name} Details`;
  container.appendChild(h);

  const periods = experience.skill[skill.id] || [];
  if(periods.length===0){ 
    container.appendChild(document.createElement("div")).textContent="No recorded periods."; 
    return; 
  }

  periods.forEach(p=>{
    const row=document.createElement("div"); 
    row.className="skill-period";

    const from = formatMonthYear(p.from);
    const to = p.to ? formatMonthYear(p.to) : "Present";
    const left=document.createElement("span"); 
    left.className="dates"; 
    left.textContent=`${from} → ${to}`;

    const right=document.createElement("span"); 
    right.className="company"; 
    right.textContent=companies[p.company] ? ` @ ${companies[p.company].name}` : " @ Unknown";

    row.appendChild(left); 
    row.appendChild(right); 
    container.appendChild(row);
  });
}

// Back buttons
function setupBackButtons(){
  const backBtn=document.getElementById("back-btn");
  const backSkillBtn=document.getElementById("back-skill-btn");

  if(backBtn){
    function updateBackBtnVisibility(){
      backBtn.style.display = window.innerWidth>=769?"none":"inline-block";
    }
    updateBackBtnVisibility();
    window.addEventListener("resize",updateBackBtnVisibility);
    backBtn.onclick=()=>{ document.getElementById("skill-view").classList.add("hidden"); document.getElementById("attributes-container").classList.remove("hidden"); };
  }

  if(backSkillBtn){
    backSkillBtn.style.display="inline-block";
    backSkillBtn.onclick=()=>{
      document.getElementById("skill-detail-view").classList.add("hidden");
      document.getElementById("skill-view").classList.remove("hidden"); // 👈 auch Desktop wieder sichtbar
    };
  }
}

function updateViewByWidth() {
  const isMobile = window.innerWidth < 769;
  const skillView = document.getElementById("skill-view");
  const attributes = document.getElementById("attributes-container");

  if (isMobile) {
    skillView.classList.add("hidden");
    attributes.classList.remove("hidden");
  } else {
    // Desktop: CSS regelt Sichtbarkeit, JS muss nichts setzen
    skillView.classList.remove("hidden"); 
    attributes.classList.remove("hidden");
  }
}

// Beim Laden
window.addEventListener("load", updateViewByWidth);
window.addEventListener("resize", updateViewByWidth);

// Initialize
loadData();
