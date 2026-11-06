import { test, expect } from "vitest";
import { chromium } from "playwright";
import { fillWorkdaySkills } from "../../packages/job-sites/workday/skills.ts";

test("selects exact resume skills and does not duplicate selected skills", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<section data-automation-id="skillsSection"><h2>Skills</h2><div id="tokens"><span data-skill-token>JavaScript</span></div><input role="combobox" aria-label="Search skills"><div id="options"></div></section><script>
    document.querySelector('input').oninput=e=>{const box=document.querySelector('#options');box.innerHTML='';if(e.target.value==='TypeScript'){const option=document.createElement('div');option.role='option';option.textContent='TypeScript';option.onclick=()=>{const token=document.createElement('span');token.dataset.skillToken='';token.textContent='TypeScript';document.querySelector('#tokens').append(token);box.innerHTML='';};box.append(option);}};</script>`);
    const skills = ["JavaScript", "TypeScript", "typescript"];
    expect((await fillWorkdaySkills(page, skills)).unresolved).toEqual([]);
    expect((await fillWorkdaySkills(page, skills)).unresolved).toEqual([]);
    expect(await page.locator("[data-skill-token]").allTextContents()).toEqual([
      "JavaScript",
      "TypeScript",
    ]);
  } finally {
    await browser.close();
  }
}, 30_000);

test("presses Enter before choosing a Workday skill checkbox", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<section data-automation-id="skillsSection"><label>Type to Add Skills<input></label><div id="tokens"></div><div id="options"></div></section><script>
 document.querySelector('input').onkeydown=e=>{if(e.key==='Enter'&&e.target.value==='Python'){document.querySelector('#options').innerHTML='<label>Python<input type="checkbox"></label>';document.querySelector('input[type=checkbox]').onchange=()=>{document.querySelector('#tokens').innerHTML='<span data-skill-token>Python</span>';document.querySelector('#options').innerHTML='';};}};</script>`);
    expect(await fillWorkdaySkills(page, ["Python"])).toEqual({
      filled: ["skill: Python"],
      unresolved: [],
    });
    expect(await page.locator("[data-skill-token]").innerText()).toBe("Python");
    expect(await fillWorkdaySkills(page, ["Python"])).toEqual({
      filled: ["skill: Python"],
      unresolved: [],
    });
  } finally {
    await browser.close();
  }
});

test("recognizes a skill committed directly by Enter", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<section data-automation-id="skillsSection"><label>Type to Add Skills<input></label><div id="tokens"></div></section><script>document.querySelector('input').onkeydown=e=>{if(e.key==='Enter'){document.querySelector('#tokens').innerHTML='<span data-skill-token>Python</span>';e.target.value='';}};</script>`,
    );
    expect(await fillWorkdaySkills(page, ["Python"])).toEqual({
      filled: ["skill: Python"],
      unresolved: [],
    });
  } finally {
    await browser.close();
  }
});

test("removes repeated Workday selected items before retrying", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<section data-automation-id="skillsSection"><input role="combobox"><ul data-automation-id="selectedItemList"><li data-automation-id="selectedItem"><button data-automation-id="DELETE_charm" onclick="this.parentElement.remove()">×</button><p data-automation-label="Python">Python</p></li><li data-automation-id="selectedItem"><button data-automation-id="DELETE_charm" onclick="this.parentElement.remove()">×</button><p data-automation-label="Python">Python</p></li></ul></section>`,
    );
    expect((await fillWorkdaySkills(page, ["Python"])).unresolved).toEqual([]);
    expect(
      await page.locator('[data-automation-id="selectedItem"]').count(),
    ).toBe(1);
  } finally {
    await browser.close();
  }
});
