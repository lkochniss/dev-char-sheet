let attributes, skills, experiences;
let skillYears = {};
let attrYears = {};
let charLevel = 0;
let charFraction = 0;

async function loadData() {
  [attributes, skills, experiences] = await Promise.all([
    fetch("data/attributes.json").then(r => r.json()),
    fetch("data/skills.json").then(r => r.json()),
    fetch("data/experience.json").then(r => r.json())
  ]);

  calculateLevels();
  renderAttributes();
  renderCharacterLevel();
}

// Hilfsfunktion: Merge overlapping intervals
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.from - b.from);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i].from <= last.to) {
      last.to = new Date(Math.max(last.to, intervals[i].to));
    } else {
      merged.push(intervals[i]);
    }
  }
  return merged;
}

function calculateLevels() {
  const today = new Date();
  skillYears = {};
  attrYears = {};
  let minFrom = today;

  // 1️⃣ Skills-Level berechnen
  for (const [skillId, periods] of Object.entries(experiences.skill)) {
    let total = 0;
    periods.forEach(p => {
      const from = new Date(p.from);
      const to = p.to ? new Date(p.to) : today;
      if (from < minFrom) minFrom = from;
      total += (to - from) / (1000 * 60 * 60 * 24 * 365);
    });
    skillYears[skillId] = total;
  }

  // 2️⃣ Attribute-Level berechnen (Skills + direct Attribute)
  attributes.forEach(attr => {
    const intervals = [];

    // direkte Attribute-Experience
    if (experiences.attribute[attr.id]) {
      experiences.attribute[attr.id].forEach(p => {
        const from = new Date(p.from);
        const to = p.to ? new Date(p.to) : today;
        intervals.push({ from, to });
        if (from < minFrom) minFrom = from;
      });
    }

    // alle Skills des Attributes
    skills.filter(s => s.attribute === attr.id).forEach(skill => {
      const skillPeriods = experiences.skill[skill.id] || [];
      skillPeriods.forEach(p => {
        const from = new Date(p.from);
        const to = p.to ? new Date(p.to) : today;
        intervals.push({ from, to });
      });
    });

    const merged = mergeIntervals(intervals);
    let totalYears = 0;
    merged.forEach(i => {
      totalYears += (i.to - i.from) / (1000 * 60 * 60 * 24 * 365);
    });

    attrYears[attr.id] = totalYears;
  });

  // 3️⃣ Character-Level berechnen
  const totalYears = (today - minFrom) / (1000 * 60 * 60 * 24 * 365);
  charLevel = Math.floor(totalYears);
  charFraction = totalYears - charLevel;

  // Attribute-Level niemals größer als Character-Level
  for (let key in attrYears) {
    if (attrYears[key] > totalYears) attrYears[key] = totalYears;
  }
}

function renderCharacterLevel() {
  const container = document.getElementById("character-level");
  container.innerHTML = `
    <strong>Character Level: ${charLevel}</strong>
    <div class="progress">
      <div class="progress-fill" style="width:${Math.round(charFraction*100)}%"></div>
    </div>
  `;
}

function renderAttributes() {
  const container = document.getElementById("attributes");
  container.innerHTML = "";

  attributes.forEach(attr => {
    const yrs = attrYears[attr.id] || 0;
    const div = document.createElement("div");
    div.className = "attribute";
    div.innerHTML = `
      <strong>${attr.name}</strong> – Lvl ${Math.floor(yrs)}
      ${renderProgress(yrs % 1)}
    `;
    div.addEventListener("click", () => showSkillView(attr));
    container.appendChild(div);
  });
}

function showSkillView(attr) {
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("skill-view").classList.remove("hidden");
  document.getElementById("skill-headline").innerText = `Skills: ${attr.name}`;

  const container = document.getElementById("skills");
  container.innerHTML = "";

  skills.filter(s => s.attribute === attr.id).forEach(skill => {
    const yrs = skillYears[skill.id] || 0;
    const div = document.createElement("div");
    div.className = "skill";
    div.innerHTML = `
      <span>${skill.name} – Lvl ${Math.floor(yrs)}</span>
      ${renderProgress(yrs % 1)}
    `;
    container.appendChild(div);
  });
}

function renderProgress(fraction) {
  const percent = Math.min(Math.round(fraction * 100), 100); // Max 100%
  return `
    <div class="progress">
      <div class="progress-fill" style="width:${percent}%"></div>
    </div>
  `;
}

document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("skill-view").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");
});

loadData();
