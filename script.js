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

// Utility: parse date string to Date
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr);
}

// Load all JSONs
async function loadData() {
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
  companyArray.forEach(c => {
    companies[c.id] = c;
  });

  calculateLevels();
  renderCharacter();
}
function calculateLevels() {
  // Reset attribute levels
  attributes.forEach(attr => {
    attr.level = 0;
    attr.exp = 0;
  });

  let allPeriods = [];

  // Helper: merge overlapping periods
  function mergePeriods(periods) {
    if (periods.length === 0) return [];
    // sort by start date
    periods.sort((a, b) => a.from - b.from);
    const merged = [periods[0]];
    for (let i = 1; i < periods.length; i++) {
      const last = merged[merged.length - 1];
      if (periods[i].from <= last.to) {
        // overlap: extend the end date
        last.to = new Date(Math.max(last.to, periods[i].to));
      } else {
        merged.push({...periods[i]});
      }
    }
    return merged;
  }

  // Process each attribute
  attributes.forEach(attr => {
    let periods = [];

    // Add attribute's own periods
    (experience.attribute[attr.id] || []).forEach(p => {
      periods.push({from: parseDate(p.from), to: parseDate(p.to)});
    });

    // Add periods from skills of this attribute
    skills.filter(s => s.attribute === attr.id).forEach(skill => {
      (experience.skill[skill.id] || []).forEach(p => {
        periods.push({from: parseDate(p.from), to: parseDate(p.to)});
      });
    });

    // Merge overlapping periods
    const merged = mergePeriods(periods);

    // Calculate total experience in years
    let totalYears = 0;
    merged.forEach(p => {
      totalYears += (p.to - p.from) / (1000 * 60 * 60 * 24 * 365.25);
      allPeriods.push(p); // for character level
    });

    attr.exp = totalYears;
    attr.level = Math.floor(totalYears);
    attr.progress = totalYears - attr.level;
  });

  // Character level: merge all periods to avoid double counting
  const mergedAll = mergePeriods(allPeriods);
  let totalCharYears = 0;
  mergedAll.forEach(p => {
    totalCharYears += (p.to - p.from) / (1000 * 60 * 60 * 24 * 365.25);
  });
  characterLevel = totalCharYears;

  // Calculate skill levels individually (ignore overlap)
  skills.forEach(skill => {
    let totalExp = 0;
    (experience.skill[skill.id] || []).forEach(p => {
      const from = parseDate(p.from);
      const to = parseDate(p.to);
      totalExp += (to - from) / (1000 * 60 * 60 * 24 * 365.25);
    });
    skill.exp = totalExp;
    skill.level = Math.floor(totalExp);
    skill.progress = totalExp - skill.level;
  });
}


// Render character slots, attributes, and level
function renderCharacter() {
  const charLevelDiv = document.getElementById("character-level");
  charLevelDiv.innerHTML = `
    <strong>Character Level:</strong> ${Math.floor(characterLevel)}
    <div class="progress"><div class="progress-fill" style="width:${(characterLevel % 1) * 100}%"></div></div>
  `;

  const attrContainer = document.getElementById("attributes");
  attrContainer.innerHTML = "";
  attributes.forEach(attr => {
    const div = document.createElement("div");
    div.className = "attribute";
    div.textContent = `${attr.name} (Level ${attr.level})`;
    const prog = document.createElement("div");
    prog.className = "progress";
    prog.innerHTML = `<div class="progress-fill" style="width:${attr.progress * 100}%"></div>`;
    div.appendChild(prog);

    div.addEventListener("click", () => showSkillTree(attr));
    attrContainer.appendChild(div);
  });
}

// Show skill tree for an attribute
function showSkillTree(attr) {
  document.getElementById("skill-detail-view").classList.add("hidden");
  document.getElementById("attributes").classList.add("hidden");
  document.getElementById("skill-view").classList.remove("hidden");
  document.getElementById("skill-headline").textContent = attr.name;

  const skillContainer = document.getElementById("skills");
  skillContainer.innerHTML = "";

  const attrSkills = skills.filter(s => s.attribute === attr.id);
  attrSkills.forEach(skill => {
    const div = document.createElement("div");
    div.className = "skill";
    div.textContent = `${skill.name} (Level ${skill.level})`;

    const prog = document.createElement("div");
    prog.className = "progress";
    prog.innerHTML = `<div class="progress-fill" style="width:${skill.progress * 100}%"></div>`;
    div.appendChild(prog);

    div.addEventListener("click", () => showSkillDetail(skill));
    skillContainer.appendChild(div);
  });
}

// Show skill details with periods and companies
function showSkillDetail(skill) {
  document.getElementById("skill-view").classList.add("hidden");
  const detailView = document.getElementById("skill-detail-view");
  detailView.classList.remove("hidden");

  const container = document.getElementById("skill-detail");
  container.innerHTML = `<h3>${skill.name} Details</h3>`;

  const periods = experience.skill[skill.id] || [];
  periods.forEach(p => {
    const div = document.createElement("div");
    div.className = "skill-period";

    const from = p.from || "N/A";
    const to = p.to || "Present";
    const companyName = companies[p.company] ? companies[p.company].name : "Unknown";

    div.innerHTML = `
      <span class="dates">${from} → ${to}</span>
      <span class="company">${companyName}</span>
    `;
    container.appendChild(div);
  });
}


// Back button handlers
document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("skill-view").classList.add("hidden");
  document.getElementById("attributes").classList.remove("hidden");
});

document.getElementById("back-skill-btn").addEventListener("click", () => {
  document.getElementById("skill-detail-view").classList.add("hidden");
  document.getElementById("skill-view").classList.remove("hidden");
});

// Initialize
loadData();
